# Governance Model

CrewOps V2 governance katmanı, sistemin "ilerleyebilir" mi yoksa "bloklu" mu olduğuna karar veren merkezi denetim mekanizmasıdır. Hiçbir kritik durum geçişi insan onayı olmadan gerçekleşemez. Bu belge, onay kapılarının nasıl çalıştığını, risk seviyelerinin nasıl değerlendirildiğini ve olağanüstü hâl (exception) mekanizmasının audit trail'i nasıl koruduğunu açıklar.

---

## Governance Katmanının Amacı

Bir yazılım teslimat sürecinde iki tür hata vardır: teknik hatalar (broken test, parse failure) ve yönetimsel hatalar (yanlış gereksinim onaylandı, test edilmeden production'a çıkıldı). Execution ve delivery katmanları teknik hataları ele alır; governance katmanı yönetimsel hataları önler.

Governance katmanı şu ilkeye dayanır: **kapı açılmadan geçilmez.** Onaylanmamış bir `ApprovalGate` varken `ProjectStateMachine` ileri geçiş yapmaya çalışırsa exception fırlatılır. Bypass yalnızca `ExceptionPolicyEngine` aracılığıyla ve immutable audit kaydı üretilerek gerçekleşebilir.

---

## ApprovalGate Entity

```csharp
// Her onay kapısını temsil eder — immutable geçmiş
public class ApprovalGate
{
    public Guid GateId { get; private set; }
    public GateType Type { get; private set; }        // Agreement, Staging, Production, Custom
    public ApprovalStatus Status { get; private set; } // Pending, Approved, Rejected, Bypassed
    public string? RequiredApproverRole { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }
    public string? RejectionReason { get; private set; }
}
```

`ApprovalGate` entity'si domain modelinin merkezindedir. Her gate'in bir `GateType`'ı vardır:

| GateType | Tetiklendiği An |
|---|---|
| `Agreement` | PM mutabakat onayı — geliştirme başlamadan önce |
| `Staging` | Staging deploy talebi — tüm task'lar tamamlandıktan sonra |
| `Production` | Production deploy talebi — staging ve UAT sonrasında |
| `Custom` | Workflow tasarımcısının tanımladığı özel kapılar |

`Status` alanı sadece ileri gider: `Pending → Approved | Rejected | Bypassed`. Bir kez kapanan gate yeniden açılamaz; yeni bir gate oluşturulur. Bu tasarım, geçmişin değiştirilemezliğini garanti eder.

`RequiredApproverRole` null değilse, onay yapan kullanıcının bu role sahip olup olmadığı kontrol edilir. Yetersiz yetkiyle onay girişimi `UnauthorizedApprovalException` fırlatır.

---

## ApprovalGateEngine

`ApprovalGateEngine`, state machine ile governance katmanı arasındaki köprüdür. `ProjectStateMachine` bir geçiş yapmadan önce `ApprovalGateEngine.EvaluateAsync()` çağrılır.

Değerlendirme adımları:

1. Geçiş için gereken gate tipi belirlenir.
2. İlgili `ApprovalGate` kaydı sorgulanır.
3. `Status == Approved` değilse `GateNotApprovalException` fırlatılır; state machine geçişi iptal edilir.
4. Onay varsa `ApprovedBy` ve `ApprovedAt` doğrulanır.

### Exception Policy ile Bypass

Normal koşullarda onaylanmamış gate geçişi imkânsızdır. Ancak üretim acil durumlarında `ExceptionPolicyEngine` devreye girebilir. Bu durumda:

- Gate `Bypassed` statüsüne getirilir.
- `AuditEvent` tipinde `EXCEPTION_POLICY_APPLIED` yayınlanır; içinde bypass gerekçesi ve yetkili kullanıcı bilgisi bulunur.
- Yetkisiz bypass girişimi `UnauthorizedBypassException` ile reddedilir ve bu da ayrı bir `AuditEvent` üretir.

Bypass mekanizması varlığı, sistemin "kilitlenip kalmaması" içindir; ancak her bypass'ın izi sonsuza kadar audit tablosunda kalır.

---

## RiskGateEngine

`RiskGateEngine`, bir review veya geçiş sırasında tespit edilen `RiskItem`'ları değerlendirir ve bunların blok kararına yol açıp açmayacağını belirler.

```csharp
public enum RiskLevel { Low, Medium, High, Critical }
```

### Risk Seviyeleri ve Davranışları

| Seviye | Davranış |
|---|---|
| `Low` | Bilgi amaçlı loglanır. Akış devam eder. |
| `Medium` | `AuditEvent` olarak kaydedilir, PM'e bildirim gönderilir. Akış devam eder. |
| `High` | Akış bloklanır. İnsan onayı zorunludur. Gate `Pending` olarak açılır. |
| `Critical` | Otomatik blok. Eskalasyon bildirimi gönderilir. Bypass yasaktır. |

`RiskItem` entity'si şu bilgileri taşır: risk açıklaması, kaynak (hangi task, hangi worker run'u), risk seviyesi ve öneri. Risk'ler `NORMALIZING` veya `REVIEWING` aşamasında worker output'undan tespit edilir ya da PM Review Engine tarafından üretilir.

`Critical` seviyesindeki bir risk tespit edildiğinde `ApprovalGateEngine` yeni bir `ApprovalGate(Type: Custom, Status: Pending)` oluşturur ve proje durumu `ESCALATED` olarak işaretlenir. Bu gate insan tarafından ya onaylanır ya da reddedilerek proje kapatılır.

---

## ReviewRequirementChecker

`ReviewRequirementChecker`, bir projenin bir sonraki state'e geçebilmesi için hangi review'ların tamamlanmış olması gerektiğini denetler.

Kontrol mantığı şu soruyu yanıtlar: "Bu proje şu anda `gelistirme → review` geçişi yapabilir mi?" Cevap ancak şu koşulların tümü sağlandığında `true` olabilir:

- Tüm `ExecutionRun`'lar `COMPLETED` durumunda.
- Her tamamlanan run için en az bir `TaskReview` kaydı var.
- Bekleyen `revise` kararı olan task'lar sıfır.

### TaskReview Entity

Review kararları `TaskReview` entity'sine yazılır. Bu entity immutable'dır; revize edilen bir task için yeni bir `TaskReview` oluşturulur.

```csharp
public enum ReviewDecision { Approve, Revise, Escalate }

public class TaskReview
{
    public Guid ReviewId { get; private set; }
    public Guid TaskId { get; private set; }
    public Guid RunId { get; private set; }
    public ReviewDecision Decision { get; private set; }
    public string ReviewNotes { get; private set; }
    public string ReviewedBy { get; private set; }    // kullanıcı ID veya "pm-engine"
    public DateTimeOffset ReviewedAt { get; private set; }
}
```

`Escalate` kararı, `RiskGateEngine`'e bir `High` seviyeli `RiskItem` besler ve governance döngüsünü tetikler.

---

## ReleaseReadinessEvaluator

Staging ve production deployment talebi yapılmadan önce `ReleaseReadinessEvaluator` bir checklist değerlendirmesi yapar. Bu değerlendirme geçilemezse `ReleaseRequest` oluşturma işlemi reddedilir.

### Staging Öncesi Kontrol Listesi

- [ ] Tüm proje task'ları `Completed` durumunda
- [ ] Tüm `TaskReview`'lar `Approved` kararıyla kapandı
- [ ] Açık `High` veya `Critical` risk item'ı yok
- [ ] `Agreement` gate'i `Approved` durumunda
- [ ] PM özet notu (`ProjectSummary`) yazılmış

### Production Öncesi Ek Kontroller

- [ ] Staging deploy başarıyla tamamlandı (`STAGING_DEPLOYED`)
- [ ] UAT onayı alındı (kullanıcı ya da harici sistem `UAT_PASSED` gate'ini kapattı)
- [ ] `RollbackPlan` oluşturulmuş ve geçerli (`ValidUntil` dolmamış)
- [ ] Son 24 saatte yeni `Critical` risk item'ı yok

Eksik olan her madde için `ReadinessViolation` listesi döner. Çağıran servis bu listeyi kullanıcıya gösterir.

---

## ExceptionPolicyEngine

`ExceptionPolicyEngine`, olağanüstü koşullarda normal dışı geçişlere kontrollü şekilde izin veren mekanizmadır. Bu motor varlığı, sistemin acil durumlarda tamamen kilitlenmesini önler; ancak her istisna immutable bir denetim kaydı üretir.

```csharp
public class ExceptionPolicy
{
    public Guid PolicyId { get; private set; }
    public string JustificationText { get; private set; }
    public string AuthorizedBy { get; private set; }
    public string[] RequiredApproverRoles { get; private set; }
    public DateTimeOffset ValidUntil { get; private set; }
}
```

Politikanın işleyişi:

1. Kullanıcı bir bypass talebi oluşturur ve gerekçe yazar.
2. `RequiredApproverRoles` listesindeki tüm kullanıcıların onayı beklenir.
3. Tüm onaylar alındıktan sonra `ExceptionPolicy` aktif hâle gelir.
4. Her bypass girişiminde `AuditEvent(EXCEPTION_POLICY_APPLIED)` yayınlanır; policy referansı, gerekçe ve yetkili kullanıcı bilgisi payload'a eklenir.
5. Yetkisiz bypass → `UnauthorizedBypassException`. Bu exception da kendi `AuditEvent`'ini üretir.
6. `ValidUntil` süresi dolmuş policy'ler otomatik olarak devre dışı bırakılır.

Bypass log'u hiçbir zaman silinemez veya güncellenemez; yalnızca yeni kayıt eklenebilir.

---

## RollbackAuthority

`RollbackAuthority`, bir production deployment'ın geri alınması kararını ve sürecini yönetir. Rollback bir deploy işlemi gibi ele alınır: onaylı, kayıtlı ve izlenebilir.

```csharp
// Rollback planı production deploy öncesi zorunludur
public record RollbackPlan(
    Guid PlanId,
    Guid ProjectId,
    string[] RollbackSteps,
    string ResponsibleParty,
    TimeSpan MaxRollbackWindow,
    DateTimeOffset CreatedAt
);
```

### Rollback Akışı

1. `PRODUCTION_DEPLOYED` durumundaki bir projede sorun tespit edilir.
2. `RollbackAuthority.InitiateRollbackAsync()` çağrılır.
3. State machine `PRODUCTION_DEPLOYED → ROLLBACK_REQUIRED` geçişi yapar.
4. `RollbackRecord` oluşturulur: zaman damgası, tetikleyen kullanıcı, gerekçe, bağlı `RollbackPlan` referansı.
5. `AuditEvent(ROLLBACK_INITIATED)` yayınlanır.
6. Rollback adımları tamamlandığında `ROLLBACK_REQUIRED → ROLLED_BACK` geçişi yapılır.
7. `AuditEvent(ROLLBACK_COMPLETED)` yayınlanır.

`RollbackRecord` entity'si immutable'dır; silinmez, güncellenmez. Her rollback girişimi ayrı bir kayıt olarak tutulur. Rollback planı olmadan `APPROVED_FOR_PRODUCTION` gate'inin açılması `ReleaseReadinessEvaluator` tarafından engellenir.
