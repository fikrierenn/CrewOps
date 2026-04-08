# Execution Model

CrewOps V2 execution katmanı, her AI görevinin yaşam döngüsünü, platform bağımsızlığını ve maliyet izlemeyi kapsayan tutarlı bir sözleşme üzerine kuruludur. Bu belge, `ExecutionRun` varlığından başlayarak normalleştirme, yeniden deneme ve maliyet takibine kadar tüm bileşenleri açıklar.

---

## ExecutionRun Yaşam Döngüsü

Bir `ExecutionRun` oluşturulduğu andan itibaren aşağıdaki durumları sırayla geçer. Her durum geçişi bir `AuditEvent` üretir ve state machine dışından doğrudan atlama yapılamaz.

```
CREATED → QUEUED → WORKSPACE_PREPARED → RUNNING → COLLECTING_ARTIFACTS → NORMALIZING → REVIEWING → COMPLETED | FAILED | TIMED_OUT
```

### CREATED

**Amaç:** Çalıştırma isteği sisteme kabul edildi, henüz işlem başlamadı.

**Giriş kriteri:** `ExecuteTaskCommand` MediatR pipeline'ına düşürüldü ve ilk validasyon geçildi.

**Çıkış kriteri:** Kayıt veritabanına yazıldı, `RunId` atandı. Worker henüz seçilmedi.

---

### QUEUED

**Amaç:** Worker kapasitesi veya bağımlı task tamamlanması bekleniyor.

**Giriş kriteri:** `CREATED` durumu tamamlandı. `WorkflowEngine.CanRunTask()` henüz `true` dönmüyor (ön-koşul task'lar bitmedi veya concurrency limiti aşıldı).

**Çıkış kriteri:** Tüm ön-koşullar karşılandı, bir worker slotu boşaldı. `WorkflowEngine` geçişe onay verdi.

---

### WORKSPACE_PREPARED

**Amaç:** Worker'ın çalışacağı izole dizin hazır, prompt içeriği inject edildi.

**Giriş kriteri:** `QUEUED` çıkışı. `WorkspaceManager.PrepareAsync()` çağrıldı.

**Çıkış kriteri:** `WorkspacePath` dolu, `PromptContent` skill'ler enjekte edilmiş şekilde finalize edildi, `SkillContentSanitizer` geçildi.

---

### RUNNING

**Amaç:** Worker aktif şekilde görevi yürütüyor (CLI spawn veya API çağrısı devam ediyor).

**Giriş kriteri:** `IExecutionWorker.ExecuteAsync()` çağrısı yapıldı.

**Çıkış kriteri:** Worker raw output döndürdü ya da exception fırlattı. `StuckTaskDetector` bu aşamada timeout eşiğini izler.

---

### COLLECTING_ARTIFACTS

**Amaç:** Worker'ın ürettiği dosyalar ve çıktılar toplanarak `ArtifactManager`'a kaydediliyor.

**Giriş kriteri:** `RUNNING` başarılı çıktı üretti.

**Çıkış kriteri:** Tüm dosya artifact'ları DB'ye yazıldı ve workspace'teki binary/metin çıktılar saklandı.

---

### NORMALIZING

**Amaç:** Ham çıktı 5-bölüm sözleşmeye göre parse ediliyor; yapısal bütünlük doğrulanıyor.

**Giriş kriteri:** Artifact toplama tamamlandı.

**Çıkış kriteri:** `WorkerResultNormalizer` bir `ParseResult<ParsedOutputSections>` döndürdü. Başarısız parse → `FAILED` geçişi tetiklenir.

---

### REVIEWING

**Amaç:** PM Review Engine veya insan gözden geçiriyor; onay/revize/eskalasyon kararı bekleniyor.

**Giriş kriteri:** `NORMALIZING` başarıyla tamamlandı.

**Çıkış kriteri:** `approve` kararı → `COMPLETED`. `revise` kararı → `CREATED`'e dönüş (retry sayacı artırılır). `escalate` → governance katmanına iletilir.

---

### COMPLETED / FAILED / TIMED_OUT

| Durum | Anlam |
|---|---|
| `COMPLETED` | Task başarıyla teslim edildi, review onaylandı |
| `FAILED` | Worker hatası, parse hatası veya max retry aşıldı |
| `TIMED_OUT` | `StuckTaskDetector` eşiği doldu, otomatik eskalasyon tetiklendi |

---

## IExecutionWorker Arayüzü

```csharp
// Tüm execution worker implementasyonlarının uyması gereken temel sözleşme
public interface IExecutionWorker
{
    Task<TaskObservation> ExecuteAsync(ExecutionRequest request, CancellationToken cancellationToken);
    bool CanHandle(RoleProfile role);
}
```

Bu arayüz iki temel sorumluluğu birbirinden ayırır: **platform** (Claude Code CLI mi, Gemini API mi, mock mu?) ve **orkestrasyon** (sıralama, retry, maliyet). `IExecutionWorker` yalnızca "bu prompt'u çalıştır, sonucu getir" der; nerede ve nasıl çalıştığı implementasyona bırakılır.

`CanHandle(RoleProfile role)` metodu, worker seçicinin (`WorkerSelector`) doğru worker'ı bulmasını sağlar. Örneğin `LocalClaudeWorker`, `RoleProfile.PreferredModel == ModelFamily.Claude` koşulunu kontrol eder. Bu sayede yeni bir LLM entegrasyonu eklemek için mevcut worker'lara dokunulmaz; yeni bir `IExecutionWorker` implement edilip DI container'a eklenir.

---

## ExecutionRequest ve TaskObservation Tipleri

```csharp
// Worker'a gönderilen yürütme talebi
public record ExecutionRequest(
    Guid RunId,
    Guid TaskId,
    string WorkspacePath,
    string PromptContent,
    RoleProfile Role,
    ModelTier ModelTier,
    CancellationToken CancellationToken
);

// Worker'dan dönen normalleştirilmiş sonuç
public record TaskObservation(
    Guid RunId,
    bool Success,
    string RawOutput,
    ParsedOutputSections? ParsedOutput,
    string? PatchContent,
    int EstimatedTokens,
    decimal EstimatedCostUsd,
    string? ErrorMessage
);
```

`ExecutionRequest`, worker'ın ihtiyaç duyduğu her şeyi taşır: hangi workspace dizininde çalışacağı, inject edilmiş prompt metni, role profili (hangi agent rolü olduğu) ve maliyet katmanı. `CancellationToken` burada ilk sınıf vatandaştır; timeout veya kullanıcı iptali durumunda worker'ın temiz çıkış yapabilmesi için gereklidir.

`TaskObservation` ise worker'dan geri dönen her şeyin tek bir zarfıdır. `RawOutput` debug ve audit için saklanır. `ParsedOutput` null olabilir (parse başarısız olursa), bu durumda `ErrorMessage` dolu gelir. Token ve maliyet tahminleri worker tarafından hesaplanır; platform API'sine en yakın olan worker bu değerleri en doğru biçimde üretir.

---

## WorkspaceManager

Her `ExecutionRun` için izole bir çalışma dizini oluşturur ve yaşam döngüsünü yönetir.

### WorkspaceId

Her run için deterministik olarak üretilen bir tanımlayıcıdır (`RunId` türetilir). `ExecutionRun` entity'sinde `WorkspacePath` alanına yazılır ve artifact'lar bu path altında saklanır.

### Dizin Oluşturma

Workspace şu yapıya sahiptir:

```
workspaces/
  {RunId}/
    prompt.md        ← inject edilmiş final prompt
    output.md        ← worker ham çıktısı
    artifacts/       ← worker'ın ürettiği dosyalar
    context/         ← proje context snapshot'u (opsiyonel)
```

### Proje Repo Kopyalanması vs. Referanslanması

İki strateji arasında bilinçli bir tercih gerekir:

- **Referans (symbolic link / mount):** Workspace proje dizinine işaret eder. Hızlıdır fakat paralel run'larda çakışma riski taşır. Yalnızca read-only context erişimi için uygundur.
- **Kopyalama (snapshot):** Proje dizininin bir kopyası workspace altına alınır. Paralel run'lar birbirini etkilemez. Disk kullanımı artar. V2'de varsayılan strateji budur.

### Cleanup Politikası

| Run Sonucu | Politika |
|---|---|
| `COMPLETED` | Workspace `archives/{RunId}` altına taşınır, 30 gün sonra silinir |
| `FAILED` | Workspace `failed/{RunId}` altında korunur, manuel inceleme için açık kalır |
| `TIMED_OUT` | `FAILED` ile aynı politika uygulanır |

Cleanup işlemi bir `BackgroundService` tarafından periyodik olarak yürütülür; doğrudan silme yerine taşıma yapılır, böylece post-mortem analiz mümkün olur.

---

## WorkerResultNormalizer

V1'deki `OutputParser` mantığını C#'a taşır. Worker'ın ham metin çıktısını 5-bölüm sözleşmeye göre ayrıştırır.

### 5-Bölüm Sözleşme

| Bölüm | Amaç |
|---|---|
| `SUMMARY` | Yapılan işin özet açıklaması |
| `FILES_CHANGED` | Değiştirilen, eklenen veya silinen dosyaların listesi |
| `PATCH` | Unified diff formatında kod değişiklikleri |
| `NEXT` | Sonraki adım önerileri veya bağımlılıklar |
| `RISKS` | Tespit edilen riskler ve uyarılar |

### ParseResult

```csharp
public record ParseResult<T>(
    bool IsSuccess,
    T? Value,
    string? ErrorMessage,
    string[] Missingsections
);
```

`ParseResult` başarı/hata durumunu explicit taşır. Exception fırlatmak yerine `IsSuccess: false` + `Missingsections` dolu döner. Çağıran katman (orkestrasyon loopun) hangi bölümün eksik olduğunu bilir ve buna göre retry veya `FAILED` kararı alır.

---

## LocalClaudeWorker

V1'deki `ClaudeCodeRunner`'ın .NET karşılığıdır. Claude Code CLI'yi bir alt process olarak spawn eder.

```csharp
// V1 ClaudeCodeRunner mantığını .NET'e taşıyan implementation
public class LocalClaudeWorker : IExecutionWorker
{
    // Claude Code CLI'yi process olarak spawn eder
    // stdout/stderr yakalar, TaskObservation'a normalize eder
}
```

Temel sorumlulukları:

1. `ExecutionRequest.PromptContent`'i geçici bir dosyaya yazar (CLI stdin sınırlamalarından kaçınmak için).
2. `Process.Start()` ile `claude` binary'sini başlatır; `WorkspacePath` çalışma dizini olarak verilir.
3. stdout ve stderr async olarak okunur; `CancellationToken` timeout'u yönetir.
4. Çıkış kodu, ham stdout ve süre bilgisi birleştirilerek `TaskObservation` üretilir.
5. Token tahmini: output uzunluğu üzerinden basit heuristik (gerçek sayaç Claude API'si kullanıldığında API response header'larından alınır).

`CanHandle(RoleProfile role)` implementasyonu: `role.PreferredModel == ModelFamily.Claude && role.ExecutionMode == ExecutionMode.LocalCli` koşulunu kontrol eder.

---

## RetryPolicy ve StuckTaskDetector

### RetryPolicy

Task tipine ve hata sınıfına göre farklı yeniden deneme davranışları tanımlar.

```csharp
public record RetryPolicy(
    int MaxAttempts,
    TimeSpan InitialDelay,
    double BackoffMultiplier,
    RetryTrigger[] RetriableErrors
);
```

- **MaxAttempts:** Task tipi bazlı yapılandırılır. Kod üretimi için 3, araştırma için 2, kritik fikstürler için 1.
- **Backoff:** Üstel geri çekilme. İlk retry 5 saniye, ikincisi 10 saniye, üçüncüsü 20 saniye.
- **RetriableErrors:** Parse hatası, process crash ve geçici API hatalarını kapsar. Kalıcı auth hataları retry tetiklemez.

### StuckTaskDetector

`RUNNING` durumundaki bir task'ın çok uzun süre ilerleme kaydetmediğini tespit eder.

```csharp
public class StuckTaskDetector : BackgroundService
{
    // Periyodik olarak RUNNING task'ları kontrol eder
    // Eşiği aşan task'ı TIMED_OUT'a geçirir ve eskalasyon AuditEvent'i yayınlar
}
```

- Varsayılan timeout eşiği: 15 dakika (yapılandırılabilir, role bazlı override desteklenir).
- Tespit üzerine: run durumu `TIMED_OUT` yapılır, governance katmanına eskalasyon bildirimi gönderilir, workspace `FAILED` politikasıyla korunur.

---

## ExecutionCostTracker

Her `TaskObservation`'dan alınan token ve maliyet bilgisini kalıcı olarak kaydeder; proje toplam maliyetini hesaplar.

```csharp
public class CostRecord
{
    public Guid RecordId { get; private set; }
    public Guid RunId { get; private set; }
    public Guid ProjectId { get; private set; }
    public int InputTokens { get; private set; }
    public int OutputTokens { get; private set; }
    public decimal CostUsd { get; private set; }
    public string ModelId { get; private set; }
    public DateTimeOffset RecordedAt { get; private set; }
}
```

`CostRecord` entity'si immutable olarak yazılır; güncellenmez. Proje toplam maliyeti `CostRecord` tablosundan `SUM` ile hesaplanır. Dashboard bu değeri real-time SignalR push ile gösterir. Raporlama sorguları `ProjectId` + tarih aralığı üzerinden çalışır.

---

## SkillContentSanitizer

V1'deki `sanitizeSkillContent()` fonksiyonunun C# karşılığıdır. Skill içeriklerinin prompt'a enjekte edilmeden önce temizlenmesini sağlar; prompt injection saldırılarına karşı birincil savunma hattıdır.

### Unsafe Pattern Blacklist

Aşağıdaki kalıplar tespit edildiğinde ilgili skill bloğu reddedilir ve `AuditEvent` ile loglanır:

| Kategori | Örnek Kalıp |
|---|---|
| System override | `SYSTEM:`, `[INST]`, `<system>`, `ignore previous instructions` |
| Role injection | `you are now`, `act as`, `pretend you are` |
| Script injection | `<script>`, `eval(`, `__import__` |
| Boundary escape | `---END OF TASK---`, `### OVERRIDE ###` |

### Maksimum Karakter Sınırı

Tek bir skill içeriği 32.000 karakteri geçemez. Toplam inject edilen skill içeriği context window'un %40'ını aşamaz (varsayılan: ~80.000 karakter). Sınır aşılırsa düşük öncelikli skill'ler prompt'tan çıkarılır; bu durum `ExecutionRun` meta verisine loglanır.
