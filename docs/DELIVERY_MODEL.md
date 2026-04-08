# Delivery Model

CrewOps V2 delivery katmanı, tüm task'ların tamamlanmasından production deployment'a kadar uzanan son mili yönetir. Bu süreçte her adım onay gerektirir, her deploy kaydedilir ve her release işlemi için rollback planı önceden hazır olmak zorundadır. Delivery katmanı, governance katmanının kurallarını deployment mekanizmalarıyla buluşturan köprüdür.

---

## Delivery Katmanının Amacı

Execution katmanı kodu üretir; governance katmanı kararları denetler; delivery katmanı ise üretileni gerçek dünyaya taşır. Bu katmanın varlık sebebi şudur: iyi yazılmış kod bile yanlış deployment prosedürüyle zarar verebilir. Delivery katmanı şu soruların cevabını sistematik olarak verir:

- Bu build staging'e gönderilmeye hazır mı?
- Staging başarılı oldu mu, UAT geçildi mi?
- Production'a çıkmak için tüm kapılar açık mı?
- Bir şeyler ters giderse nasıl geri dönülür?

Her sorunun cevabı bir kayıt üretir ve bu kayıtlar silinmez.

---

## Tam Release Akışı

```
PM Consolidation
    ↓
READY_FOR_HUMAN_REVIEW (PM özeti hazır)
    ↓ [İnsan Onayı]
APPROVED_FOR_STAGING
    ↓ [StagingDeployController tetiklenir]
STAGING_DEPLOYED
    ↓ [UAT/Doğrulama]
UAT_PASSED
    ↓ [İnsan Onayı: Production]
APPROVED_FOR_PRODUCTION
    ↓ [ProductionGateEnforcer final check]
PRODUCTION_DEPLOYED
    ↓ [Gözlem periyodu]
COMPLETED | ROLLBACK_REQUIRED
```

Her ok bir `AuditEvent` tetikler. Her köşeli parantez içindeki adım governance katmanıyla koordineli çalışır; `ApprovalGate` açık değilse geçiş gerçekleşmez.

### PM Consolidation

Geliştirme fazı tamamlandığında PM Review Engine tüm task çıktılarını özetler. Bu özet hem kullanıcıya gösterilen `ProjectSummary`'yi oluşturur hem de `ReleaseReadinessEvaluator`'ın staging checklist'ini karşıladığını doğrular.

### READY_FOR_HUMAN_REVIEW

`ReleaseReadinessEvaluator` staging ön kontrollerini geçti. Sistem insan onayı bekliyor. Bu noktada kullanıcıya yapılan işin özeti, değişen dosyalar ve risk listesi sunulur. İnsan "onayla" demeden bir sonraki adıma geçilemez.

### APPROVED_FOR_STAGING → STAGING_DEPLOYED

`Staging` tipinde `ApprovalGate` açılır ve onaylanır. `StagingDeployController` tetiklenir. Deploy tamamlandığında `DeploymentRecord` oluşturulur.

### UAT_PASSED

UAT (User Acceptance Testing) bir kullanıcı eylemidir: sisteme "staging'de test ettim, geçti" bilgisi girilir. Bu bilgi bir `ApprovalGate(Type: Custom, Label: "UAT")` kapanmasıyla kayıt altına alınır. Otomatik test sonuçlarıyla birleştirilebilir ancak son onay insana aittir.

### APPROVED_FOR_PRODUCTION

`Production` tipinde `ApprovalGate` açılır. Kullanıcı bu noktada rollback planını ve UAT sonuçlarını görerek onay verir.

### PRODUCTION_DEPLOYED → COMPLETED | ROLLBACK_REQUIRED

Production deploy tamamlandı. Bir gözlem penceresi açılır (yapılandırılabilir, varsayılan 1 saat). Gözlem süresinde kritik bir sorun yoksa proje `COMPLETED` olur. Sorun tespit edilirse `RollbackAuthority` devreye girer.

---

## ReleaseRequest Entity

```csharp
// Staging veya production'a deploy talebi
public class ReleaseRequest
{
    public Guid ReleaseId { get; private set; }
    public Guid ProjectId { get; private set; }
    public TargetEnvironment Environment { get; private set; } // Staging, Production
    public ReleaseStatus Status { get; private set; }
    public string RequestedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Guid? RollbackPlanId { get; private set; }  // Production için zorunlu
    public ApprovalGate[] ApprovalHistory { get; private set; }
}
```

`ReleaseRequest`, bir deploy sürecinin tüm geçmişini barındırır. `ApprovalHistory` dizisi, bu release için açılmış ve kapatılmış tüm gate'leri içerir. Bu dizi yalnızca büyür; eleman silinemez.

`RollbackPlanId` alanı staging için opsiyonel, production için zorunludur. `ProductionGateEnforcer` bu alanın dolu ve geçerli bir `RollbackPlan`'a işaret ettiğini doğrular; eksik veya süresi dolmuşsa geçişi engeller.

`ReleaseStatus` değerleri:

| Durum | Anlam |
|---|---|
| `Pending` | Oluşturuldu, onay bekleniyor |
| `Approved` | Gate açıldı, deploy bekliyor |
| `Deploying` | Deploy işlemi devam ediyor |
| `Deployed` | Başarıyla tamamlandı |
| `Failed` | Deploy başarısız oldu |
| `RolledBack` | Rollback tamamlandı |

---

## DeploymentRecord

Her deployment işlemi için oluşturulan immutable kayıttır. `ReleaseRequest` onaylandıktan sonra deploy başladığında oluşturulur; silinmez ve güncellenmez.

```csharp
public class DeploymentRecord
{
    public Guid DeploymentId { get; private set; }
    public Guid ReleaseId { get; private set; }
    public Guid ProjectId { get; private set; }
    public TargetEnvironment Environment { get; private set; }
    public string DeployedBy { get; private set; }
    public string ApproverUserId { get; private set; }
    public string GitCommitSha { get; private set; }
    public Guid? RollbackPlanId { get; private set; }
    public DeploymentOutcome Outcome { get; private set; } // Success, Failed, RolledBack
    public DateTimeOffset StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
}
```

`GitCommitSha` alanı, hangi commit'in deploy edildiğini kesin olarak belirler. Bu sayede "staging'de ne vardı, production'a ne gitti" sorusu her zaman yanıtlanabilir. Audit log'larında `DeploymentId` referansı kullanılarak tüm deployment geçmişi sorgulanabilir.

---

## StagingDeployController

Staging ortamına deploy işlemini yöneten kontrolcüdür. Deploy mekanizması pluggable olarak tasarlanmıştır: gerçek deploy adımı bir `IDeploymentProvider` implementasyonuna devredilir.

```csharp
public interface IDeploymentProvider
{
    Task<DeploymentResult> DeployAsync(DeploymentContext context, CancellationToken cancellationToken);
    TargetEnvironment SupportedEnvironment { get; }
}
```

Sağlanan yerleşik `IDeploymentProvider` implementasyonları:

| Provider | Kullanım Senaryosu |
|---|---|
| `ScriptDeploymentProvider` | Shell script tetikler (bash, PowerShell) |
| `WebhookDeploymentProvider` | CI/CD sistemine (GitHub Actions, Azure DevOps) HTTP webhook gönderir |
| `ManualDeploymentProvider` | Operatöre bildirim gönderir, kullanıcı manuel tamamlar |

`StagingDeployController`, deploy sonucunu `DeploymentRecord`'a yazar ve `AuditEvent(STAGING_DEPLOYED)` yayınlar. Deploy başarısızsa `ReleaseStatus.Failed` güncellenir; kullanıcıya bildirim gönderilir ve yeniden deneme seçeneği sunulur.

---

## ProductionGateEnforcer

Production deploy başlamadan önce double-check yapan son savunma hattıdır. `StagingDeployController`'dan farklı olarak `ProductionGateEnforcer` deploy mekanizmasını çalıştırmaz; yalnızca ön koşulların tamamını doğrular. Tek bir ön koşul bile karşılanmamışsa `ProductionGateException` fırlatır ve deploy bloklanır.

Kontrol sırası ve her adımda üretilen mesaj:

1. **Staging başarılı:** `DeploymentRecord` tablosunda bu proje için `Environment: Staging, Outcome: Success` kaydı var mı?
2. **UAT onaylandı:** `UAT` tipinde `ApprovalGate` `Approved` statüsünde mi?
3. **Rollback planı geçerli:** `RollbackPlanId` dolu mu ve `RollbackPlan.ValidUntil` geçmemiş mi?
4. **Risk gate'leri temiz:** Açık `High` veya `Critical` seviyeli `RiskItem` var mı?
5. **Final approval token:** `Production` tipinde `ApprovalGate` `Approved` statüsünde mi?

Herhangi bir kontrol başarısızsa `ProductionGateException` içinde hangi kontrollerin geçilemediğinin listesi döner. Bu exception loglanır, kullanıcıya gösterilir ve `AuditEvent` olarak kaydedilir.

---

## RollbackInitiator

Bir production deployment sorun yaşadığında `RollbackInitiator` devreye girer. Rollback başlatma yetkisi, tanımlı `RollbackPlan.ResponsibleParty` rolüne sahip kullanıcılara veya sistem yöneticisine aittir.

```csharp
public class RollbackInitiator
{
    public Task InitiateAsync(Guid releaseId, string reason, string initiatedBy);
}
```

Rollback adımları:

1. `ReleaseRequest.Status` → `RolledBack` güncellenir.
2. `ProjectStateMachine` `PRODUCTION_DEPLOYED → ROLLBACK_REQUIRED` geçişini yapar.
3. `RollbackRecord` oluşturulur: zaman damgası, gerekçe, initiator, bağlı `DeploymentRecord` referansı.
4. `AuditEvent(ROLLBACK_INITIATED)` yayınlanır; `RollbackPlan.RollbackSteps` payload'a eklenir.
5. Rollback adımları `IDeploymentProvider` aracılığıyla veya operatör tarafından manuel olarak uygulanır.
6. Tamamlandığında `ProjectStateMachine` `ROLLBACK_REQUIRED → ROLLED_BACK` geçişini yapar.
7. `AuditEvent(ROLLBACK_COMPLETED)` yayınlanır.

`RollbackRecord` entity'si immutable'dır; her rollback girişimi ayrı kayıt olarak tutulur. Başarısız rollback girişimleri de kayıt altına alınır ve ayrı bir eskalasyon süreci başlatır.
