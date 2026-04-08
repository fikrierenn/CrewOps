# Observability Model

CrewOps V2 observability katmanı, sistemde gerçekleşen her önemli olayın izlenmesini, sorgulanabilmesini ve denetlenebilmesini sağlar. Audit trail'ler immutable'dır: eklenir, güncellenmez, silinmez. Bu belge, olay taksonomisiniden yapılandırılmış log konfigürasyonuna kadar tüm observability bileşenlerini açıklar.

---

## Observability Katmanının Amacı

Bir AI yazılım teslimat sisteminde şeffaflık bir seçenek değil, bir zorunluluktur. Hangi agent hangi kararı verdi? Hangi onay kim tarafından, ne zaman verildi? Bir deployment neden başarısız oldu? Bu soruların cevabı geriye dönük olarak bulunabilmelidir.

Observability katmanı üç katmanda çalışır:

- **Denetim (Audit):** Kimin, neyi, ne zaman yaptığı. İmmutable. `AuditEvent` entity'si ile temsil edilir.
- **İzleme (Tracing):** Bir run'ın hangi adımlardan geçtiği, ne kadar sürdüğü, kaç token harcandığı. `ExecutionTracer` ile temsil edilir.
- **Sağlık (Health):** Sistemin şu an sağlıklı çalışıp çalışmadığı. `HealthCheckProvider` ile temsil edilir.

---

## AuditEvent Entity

```csharp
// Her önemli sistem olayı için immutable kayıt
public class AuditEvent
{
    public Guid EventId { get; private set; }
    public Guid ProjectId { get; private set; }
    public AuditEventType EventType { get; private set; }
    public string ActorId { get; private set; }       // kullanıcı veya sistem
    public string Payload { get; private set; }        // JSON
    public DateTimeOffset OccurredAt { get; private set; }
    // Soft delete yok — sadece append, asla güncelleme/silme
}
```

`AuditEvent` tasarımının temel ilkeleri:

- **Append-only:** EF Core konfigürasyonunda bu entity için `Update` ve `Delete` operasyonları kısıtlanır. Uygulama katmanından gelen güncelleme/silme talepleri `InvalidOperationException` ile reddedilir.
- **ActorId:** Kullanıcı tarafından gerçekleştirilen olaylarda kullanıcının ID'si; sistem tarafından otomatik gerçekleştirilen olaylarda `system:` önekiyle servis adı yazılır (örn. `system:OrchestrationLoop`).
- **Payload:** Olayın bağlamını JSON formatında taşır. Hangi `RunId`, hangi `GateId`, hangi `RiskLevel` gibi ek bilgiler buraya eklenir. Schema'sı `AuditEventType`'a göre belirlenir.
- **OccurredAt:** UTC olarak kaydedilir. Sunucu saati kullanılır; istemci saati güvenilir kabul edilmez.

---

## Event Taxonomy (AuditEventType Enum)

Tüm `AuditEventType` değerleri üç kategoriye ayrılır. Bu kategoriler sorgulama ve filtreleme kolaylığı sağlar.

### Proje Yaşam Döngüsü Olayları

| EventType | Tetiklendiği An |
|---|---|
| `PROJECT_CREATED` | Yeni proje oluşturuldu |
| `AGREEMENT_DRAFTED` | PM mutabakat taslağı hazırlandı |
| `AGREEMENT_APPROVED` | Mutabakat insan tarafından onaylandı |
| `PLAN_CREATED` | Görev planı oluşturuldu |
| `TASKS_CREATED` | Plan'dan task'lar türetildi |
| `CAPABILITIES_ASSIGNED` | Task'lara rol/skill ataması yapıldı |
| `EXECUTION_STARTED` | `ExecutionRun` `RUNNING` durumuna geçti |
| `EXECUTION_COMPLETED` | `ExecutionRun` `COMPLETED` durumuna ulaştı |
| `EXECUTION_FAILED` | `ExecutionRun` `FAILED` veya `TIMED_OUT` oldu |

### Governance Olayları

| EventType | Tetiklendiği An |
|---|---|
| `GATE_TRIGGERED` | Yeni `ApprovalGate` açıldı |
| `GATE_APPROVED` | `ApprovalGate` onaylandı |
| `GATE_REJECTED` | `ApprovalGate` reddedildi |
| `RISK_ITEM_FLAGGED` | `High` veya `Critical` seviyeli risk tespit edildi |
| `EXCEPTION_POLICY_APPLIED` | Normal dışı geçiş `ExceptionPolicyEngine` ile gerçekleşti |

### Delivery Olayları

| EventType | Tetiklendiği An |
|---|---|
| `RELEASE_REQUESTED` | `ReleaseRequest` oluşturuldu |
| `STAGING_DEPLOYED` | Staging deploy başarıyla tamamlandı |
| `PRODUCTION_DEPLOYED` | Production deploy başarıyla tamamlandı |
| `ROLLBACK_INITIATED` | Rollback başlatıldı |
| `ROLLBACK_COMPLETED` | Rollback başarıyla tamamlandı |

---

## AuditEventPublisher

`AuditEventPublisher`, uygulama genelinde tüm önemli operasyonlardan sonra `AuditEvent` üretmekten sorumludur. MediatR'ın `INotification` mekanizması kullanılır; yayın senkron değildir.

```csharp
public class AuditEventNotification : INotification
{
    public AuditEvent Event { get; init; }
}

public class AuditEventPublisher
{
    public Task PublishAsync(AuditEventType type, Guid projectId, string actorId, object payload);
}
```

Tasarım tercihi neden fire-and-forget: audit yazma işlemi ana iş akışını yavaşlatmamalıdır. Bir `EXECUTION_COMPLETED` olayı bildirilirken audit kaydının DB'ye yazılması beklenirse, yüksek yükde bu gecikme birikir. MediatR notification handler'ı audit'i kendi context'inde yazar; ana command handler hemen döner.

Hata toleransı: audit yazma başarısız olursa `Serilog` ile kritik seviyede loglanır ve ayrı bir `dead-letter` tablosuna düşer. Ana akış bloklanmaz.

---

## ProjectTimeline

Belirli bir projeye ait tüm `AuditEvent`'lerin kronolojik görünümünü sağlar. Dashboard'da proje geçmişi sayfası bu sorgunun çıktısını gösterir.

```csharp
// Bir projenin tüm olaylarını sıralı döndürür
IReadOnlyList<AuditEvent> GetProjectTimeline(
    Guid projectId,
    DateTimeOffset? from = null,
    DateTimeOffset? to = null
);
```

Sorgu parametreleri:

- `from` / `to`: Belirli bir tarih aralığını filtreler. İkisi de null bırakılırsa tüm geçmiş döner.
- Sonuçlar `OccurredAt` asc sırasıyla gelir; UI'da zaman çizelgesi olarak gösterilir.
- Sayfalama desteklenir: büyük projeler için `cursor`-based pagination uygulanır.

SignalR entegrasyonu: aktif bir projenin timeline görünümü açıkken, yeni `AuditEvent`'ler `ProjectHub` üzerinden real-time push ile istemciye iletilir. Sayfa yenileme gerekmez.

---

## ExecutionTracer

Her `ExecutionRun` için detaylı performans ve maliyet izlemesi yapar. `CostRecord`'u tamamlayan ek metadata katmanıdır.

```csharp
public class ExecutionTrace
{
    public Guid TraceId { get; private set; }
    public Guid RunId { get; private set; }
    public int InputTokens { get; private set; }
    public int OutputTokens { get; private set; }
    public decimal CostUsd { get; private set; }
    public int SkillsInjectedCount { get; private set; }
    public int TotalSkillCharacters { get; private set; }
    public string OutputHash { get; private set; }     // SHA-256, integrity check için
    public long DurationMs { get; private set; }
    public int RetryCount { get; private set; }
    public DateTimeOffset StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
}
```

Her alanın anlamı:

- **SkillsInjectedCount / TotalSkillCharacters:** Kaç skill'in prompt'a eklendiğini ve toplam karakter sayısını gösterir. `SkillContentSanitizer` tarafından reddedilen skill'ler ayrıca loglanır.
- **OutputHash:** Worker'ın ham çıktısının SHA-256 hash'i. Farklı zaman noktalarında aynı run'ın çıktısının değişmediğini doğrulamak için kullanılır (integrity check).
- **DurationMs:** `RUNNING` durumuna giriş ile `COLLECTING_ARTIFACTS` başlangıcı arasındaki süre.
- **RetryCount:** Bu task'ın kaç kez yeniden denendiği. 0 = ilk denemede başarılı.

---

## HealthCheckProvider

ASP.NET Core `IHealthCheck` arayüzüne entegre olan sağlık kontrolü sağlayıcısıdır. `/health` endpoint'i production'da monitoring sistemleri tarafından sorgulanır.

```csharp
public class CrewOpsHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    );
}
```

Kontrol edilen bileşenler:

| Kontrol | Başarı Kriteri | Başarısızlık Etkisi |
|---|---|---|
| **DB bağlantısı** | SQL Server'a ping atıldı, `SELECT 1` döndü | `Unhealthy` |
| **Capability registry** | `RoleRegistry` yüklendi, en az 1 rol var | `Degraded` |
| **LLM client erişimi** | Anthropic API `/v1/models` endpoint'i `200` döndü | `Degraded` |
| **Son başarılı run** | Son 24 saatte en az 1 `COMPLETED` run var | `Degraded` (uyarı) |

`Unhealthy` durumu: servis sağlıksız, tüm operasyonlar bloklanabilir. `Degraded` durumu: servis çalışıyor ama dikkat gerektiren bir durum var. Monitoring sistemi `Unhealthy` durumunda alert gönderir.

---

## CapabilityUsageMetrics

Rol ve skill kullanım istatistiklerini toplar. Hem gerçek zamanlı dashboard için hem de dönemsel raporlama için kullanılır.

```csharp
public record CapabilityMetricsSnapshot(
    IReadOnlyList<RoleUsageStat> TopRoles,
    IReadOnlyList<SkillUsageStat> TopSkills,
    IReadOnlyList<WorkflowBundleUsageStat> TopWorkflowBundles,
    IReadOnlyDictionary<Guid, decimal> AverageCostByProject,
    DateTimeOffset SnapshotTakenAt
);
```

Ölçülen metrikler:

- **En çok kullanılan roller:** `ExecutionRun` tablosunda `RoleId` bazlı sayım. Hangi agent rolleri en çok çalıştırıldı.
- **En çok kullanılan skill'ler:** `ExecutionTrace.SkillsInjected` verisi üzerinden skill kimliği bazlı frekans.
- **Workflow bundle kullanım sayıları:** Birden fazla skill içeren bundle'ların kaç run'da kullanıldığı.
- **Proje bazlı ortalama maliyet:** `CostRecord` tablosundan `AVG(CostUsd) GROUP BY ProjectId`.

Bu metrikler `CapabilityMetricsHub` üzerinden SignalR ile dashboard'a anlık olarak aktarılır. Ayrıca haftalık raporlama için `CapabilityMetricsReport` entity'sine snapshot olarak yazılır.

---

## Serilog Yapılandırması

Yapılandırılmış log çıktısı, birden fazla hedef (sink) üzerinden yazılır. Bu yapı, hem geliştirme ortamında hızlı debug'ı hem de production'da merkezi log yönetimini destekler.

```csharp
// Yapılandırılmış log çıktısı — birden fazla sink
Log.Logger = new LoggerConfiguration()
    .WriteTo.File("logs/crewops-.log", rollingInterval: RollingInterval.Day)
    .WriteTo.MSSqlServer(connectionString, "ApplicationLogs")
    // .WriteTo.Seq(seqUrl)  // opsiyonel, lokal Seq için
    .CreateLogger();
```

### Sink Tercihleri

| Sink | Kullanım Amacı |
|---|---|
| `File` | Günlük dönen log dosyaları. Hızlı erişim, ops debug. `logs/crewops-2026-03-08.log` formatı. |
| `MSSqlServer` | Yapılandırılmış log kaydı. `ApplicationLogs` tablosuna yazılır. SQL sorgusuyla filtreleme ve analiz mümkün. |
| `Seq` (opsiyonel) | Lokal Seq kurulumu için. Geliştirme ortamında zengin UI ile structured log sorgulaması. |

### Log Seviyeleri

Uygulama genelinde minimum seviye `Information`'dır. Execution ve governance katmanlarındaki kritik operasyonlar `Warning` veya `Error` seviyesinde loglanır. `ExecutionRun TIMED_OUT` ve `ProductionGateException` olayları `Error` seviyesinde atılır; monitoring sistemi bu seviyeyi izler.

### Correlation

Her HTTP isteği için `CorrelationId` middleware'i çalışır; tüm log satırları aynı istek zincirini izleyebilmek için `CorrelationId` ile etiketlenir. `ExecutionRun` başladığında `RunId` log scope'una eklenir; o run'a ait tüm log satırları `RunId` filtresiyle sorgulanabilir.
