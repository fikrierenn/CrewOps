# CrewOps V2 — Security Guardrails

Bu belge CrewOps V2'nin güvenlik mimarisini ve koruma katmanlarını tanımlar. Güvenlik sonradan eklenen bir özellik değildir; her katmanın tasarımına içselleştirilmiştir.

---

## Giriş

CrewOps V2'de güvenlik üç ilke üzerine kuruludur:

1. **En az ayrıcalık (least privilege):** Her bileşen yalnızca görevini yerine getirmek için gereken en dar izin kümesiyle çalışır.
2. **Açık reddediş (explicit deny):** İzinler açıkça tanımlanmamışsa varsayılan olarak reddedilir.
3. **Denetlenebilirlik (auditability):** Güvenlikle ilgili her karar ve ihlal girişimi kayıt altına alınır.

Bu belge aşağıdaki konuları kapsar: secrets yönetimi, LLM entegrasyon sınırları, tool permission profilleri, skill injection güvenliği, workspace izolasyonu, prompt injection koruması, komut kısıtlamaları ve authentication.

---

## Secrets Yönetimi

LLM API anahtarları ve veritabanı bağlantı stringleri kaynak kodda hiçbir zaman yer almaz. Geliştirme ortamında ASP.NET Core User Secrets (`dotnet user-secrets`) mekanizması kullanılır. Production ortamında ortam değişkenleri veya Azure Key Vault entegrasyonu devreye girer.

Tüm secret erişimi, somut implementasyonun değiştirilebilmesini sağlayan `ISecretsProvider` arayüzü üzerinden yapılır:

```csharp
// Secrets erişimi her zaman bu arayüz üzerinden gerçekleşir.
// Geliştirmede: UserSecretsProvider
// Production'da: KeyVaultSecretsProvider
public interface ISecretsProvider
{
    string GetSecret(string key);
}
```

Uygulama kuralları:

- `appsettings.json` içinde yalnızca non-secret konfigürasyon değerleri yer alır.
- `appsettings.json` ortam değişkeni override'ı destekler; CI/CD pipeline bu mekanizmayı kullanır.
- `IConfiguration` üzerinden dolaylı secret erişimi de kabul edilmez; her zaman `ISecretsProvider` tercih edilir.
- Key Vault entegrasyonu için `ISecretsProvider` implementasyonu DI container'dan değiştirilebilir; mevcut çağrı siteleri güncelleme gerektirmez.

---

## MCP ve Harici Entegrasyon Sınırları

Model Context Protocol (MCP) veya başka harici LLM entegrasyonları doğrudan çağrı yapamaz. Tüm harici LLM erişimi `ILlmClient` arayüzü üzerinden yönlendirilir:

```csharp
public interface ILlmClient
{
    Task<LlmResponse> CompleteAsync(LlmRequest request, CancellationToken ct = default);
}
```

MCP entegrasyonlarına özgü kurallar:

- Her MCP aracı çağrısı `ApprovalGate` gerektirir. Onaysız doğrudan çağrı çalışma zamanında engellenecek şekilde tasarlanır.
- Harici servis çağrıları timeout ile korunur (varsayılan: 60 saniye). Timeout aşımı durumunda `LlmTimeoutException` fırlatılır.
- Circuit breaker pattern uygulanır: ardışık 5 başarısız çağrıdan sonra devre açılır, 30 saniye sonra half-open durumuna geçer.
- Her dış çağrı maliyet kaydı (`CostRecord`) üretir; maliyet takibi için `ExecutionCostTracker` kullanılır.

---

## Tool Permission Profiles

Her ajan rolü için hangi araçların kullanılabileceği `RoleProfile` üzerinde açıkça tanımlanır. Execution worker yalnızca `AllowedTools` listesindeki araçları çalıştırabilir; bu liste dışındaki herhangi bir araç çağrısı `ToolNotPermittedException` ile sonuçlanır.

```csharp
// Her rol için izin verilen ve yasaklanan araçlar tanımlanmıştır.
// AllowedTools: worker bu listeyle kısıtlanır.
// ForbiddenActions: bu pattern'leri içeren komutlar çalıştırılmaz.
public record RoleProfile(
    string RoleId,
    string DisplayName,
    string[] Skills,
    string WorkStyle,
    string[] AllowedTools,       // örn: ["bash", "read_file", "write_file"]
    string[] ForbiddenActions,   // örn: ["rm -rf", "DROP TABLE", "git push --force"]
    ModelTier DefaultModelTier
);
```

Yasak eylemler çalışma zamanında iki noktada kontrol edilir:

1. **Prompt assembly aşamasında:** `ContextAssembler` ForbiddenActions listesini prompt'a ekler; LLM bu eylemleri üretmemesi gerektiğini bilir.
2. **Execution aşamasında:** `LocalClaudeWorker` üretilen komutu çalıştırmadan önce `ForbiddenActions` pattern listesiyle eşleştirir. Eşleşme varsa komut iptal edilir ve `CRITICAL` seviyeli `RiskItem` üretilir.

MVP'de 7 built-in rol için hazır `RoleProfile` tanımları `templates/role-profiles/` dizininde yer alır.

---

## Skill Injection Güvenliği

V1'deki `sanitizeSkillContent()` fonksiyonu V2'de `SkillContentSanitizer` sınıfına taşınmıştır. Bu sınıf, LLM prompt'una enjekte edilmeden önce skill içeriğini tarar ve tehlikeli direktifleri temizler.

```csharp
// Tehlikeli direktifler — bu pattern'leri içeren satırlar sanitize edilir.
// Her sanitize işlemi structured log üretir.
public sealed class SkillContentSanitizer
{
    private static readonly string[] UnsafePatterns =
    [
        @"^</?system[-_]?(?:prompt|instruction|reminder)>",
        @"^(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|above|prior|system)",
        @"^you\s+are\s+now\b",
        @"^new\s+(?:instructions?|role|persona)\s*:",
        @"<script[\s>]",
        @"javascript\s*:"
    ];

    public SanitizeResult Sanitize(string skillContent, string skillId)
    {
        // Her eşleşme için SanitizedLine kaydı üretilir ve loglanır.
        // ...
    }
}
```

Ek kurallar:

- Maksimum skill içerik boyutu **8.000 karakter**. Bu sınırı aşan skill'ler yüklenemez; `SkillTooLargeException` fırlatılır.
- Her sanitize işlemi Serilog structured log üretir: hangi skill, hangi pattern, kaç satır temizlendi.
- Sanitize sonucu `SanitizeResult` döner; `WasModified` flag'i `true` ise `UNSAFE_SKILL_CONTENT_DETECTED` audit event'i üretilir.

---

## Workspace Isolation

Her `ExecutionRun`, çalışma boyunca diğer run'lardan yalıtılmış bir geçici dizinde (temp workspace) çalışır. Cross-run dosya erişimi yoktur.

```csharp
// Her run için izole geçici workspace oluşturur.
// preserveForInspection: başarısız run'larda workspace silinmez, inceleme için bırakılır.
public interface IWorkspaceManager
{
    Task<ExecutionWorkspace> CreateIsolatedWorkspaceAsync(Guid runId);
    Task CleanupWorkspaceAsync(Guid workspaceId, bool preserveForInspection);
}
```

Workspace izolasyon kuralları:

- Workspace yolu: `%TEMP%\crewops\runs\{runId}\`
- Workspace oluşturulduğunda proje dosyalarının yalnızca gerekli alt kümesi kopyalanır (shallow copy).
- `ExecutionRun` tamamlandığında başarılı durumda workspace otomatik temizlenir.
- Başarısız durumda `preserveForInspection: true` ile workspace inceleme için bırakılır; bir sonraki başlatmada eski workspace'ler temizlenir.

Artifact güven modeli: worker'ın ürettiği dosyalar (`ExecutionArtifact`) varsayılan olarak `Untrusted` olarak işaretlenir. PM review onayından sonra `Trusted` durumuna geçer. `PatchApplier` yalnızca `Trusted` artifact'leri kaynak ağacına uygular.

---

## Prompt Injection Koruması

Skill dosyaları ve agent MD içerikleri her zaman güvenilmez veri (untrusted data) olarak işaretlenir. Bu içerikler LLM prompt'una eklenmeden önce `SkillContentSanitizer` tarafından mutlaka taranır. Taranmamış içerik prompt'a enjekte edilemez; bu kural `ContextAssembler` içinde zorunlu kılınmıştır.

Prompt assembly akışı:

```
skill içeriği
    → SkillContentSanitizer.Sanitize()
    → SanitizeResult.CleanContent
    → ContextAssembler.BuildPrompt()
    → ILlmClient.CompleteAsync()
```

Bu zincirin herhangi bir adımının atlanması derleme zamanında değil çalışma zamanında `PromptAssemblyException` üretecek şekilde tasarlanır.

---

## Command Restrictions

`ForbiddenActions` listesine giren komutlar aşağıdaki kategorilerde sınıflandırılır:

| Kategori | Örnek Komutlar | Yanıt |
|----------|---------------|-------|
| Destructive filesystem | `rm -rf`, `del /f /s /q` | CRITICAL RiskItem + komut iptal |
| Destructive database | `DROP TABLE`, `TRUNCATE`, `DELETE` (WHERE koşulsuz) | CRITICAL RiskItem + komut iptal |
| Unauthorized deployment | `git push --force`, herhangi bir production deploy komutu | CRITICAL RiskItem + ApprovalGate tetikle |
| Privilege escalation | `sudo`, `runas`, `chmod 777` | CRITICAL RiskItem + komut iptal |

`CRITICAL` seviyeli `RiskItem` üretildiğinde `OrchestrationLoop` mevcut görevi duraklatır ve `ApprovalGateTriggered` domain event'i yayınlar. İnsan onayı alınmadan yürütme devam etmez.

Production deployment asla özerk değildir — her deploy komutu `ApprovalGate` gerektirir ve `AuditEvent` üretir.

---

## Unauthorized Deployment Protection

Production gate hard-coded olarak uygulanır; bypass edilecek bir konfigürasyon anahtarı yoktur.

```csharp
// Production gate'ini atlatma girişimi → ProductionGateNotClearedException
// Bu exception her zaman GATE_BYPASS_ATTEMPTED audit event'i üretir.
public sealed class ProductionGateEnforcer
{
    private readonly IApprovalGateEngine _approvalGateEngine;

    public void EnsureAllGatesPassed(ReleaseRequest request)
    {
        if (!_approvalGateEngine.AllGatesPassed(request))
            throw new ProductionGateNotClearedException(request.ReleaseId);
    }
}
```

`IApprovalGateEngine.AllGatesPassed()` yalnızca şu koşulların tamamı sağlandığında `true` döner:

- Tüm görevler `COMPLETED` veya `SKIPPED` durumunda
- En az bir insan reviewer onayı mevcut
- Açık `CRITICAL` veya `HIGH` `RiskItem` bulunmuyor
- `AgreementDraft` onaylanmış durumda (`AGREEMENT_APPROVED`)

---

## Authentication (Local-First)

MVP'de single-user, local-first authentication uygulanır. ASP.NET Core cookie authentication tercih edilir; JWT token tabanlı authentication opsiyonel olarak açılabilir.

Multi-user senaryosu için rol tanımları:

| Rol | İzinler |
|-----|--------|
| `PM_USER` | PM chat, agreement onayı, görev görüntüleme |
| `REVIEWER` | Review gate onayı, artifact inceleme |
| `ADMIN` | Tüm işlemler + kullanıcı yönetimi |

MVP'de multi-user auth uygulanmaz; tüm kullanıcı varsayılan olarak `ADMIN` rolüyle çalışır. Role-based authorization altyapısı Faz 3'te DI container düzeyinde hazırlanır; MVP sonrası açılabilecek şekilde yapılandırılır.

---

## Güvenlik Olayı Kaydı

Güvenlikle ilgili her olay `AuditEventPublisher` üzerinden `AuditEvents` tablosuna yazılır. Serilog structured logging aynı anda devreye girer; log satırı ve veritabanı kaydı atomik değildir ancak her ikisi de üretilir.

Güvenlik audit event türleri:

| `AuditEventType` | Tetikleyici |
|-----------------|------------|
| `SECURITY_VIOLATION_ATTEMPTED` | `ForbiddenActions` eşleşmesi veya yetkisiz gate erişimi |
| `GATE_BYPASS_ATTEMPTED` | `ProductionGateNotClearedException` yakalandığında |
| `UNSAFE_SKILL_CONTENT_DETECTED` | `SkillContentSanitizer.WasModified == true` |
| `PRODUCTION_GATE_NOT_CLEARED` | `ProductionGateEnforcer` çağrısı başarısız |

Her `AuditEvent` şu alanları içerir: `EventType`, `ProjectId` (varsa), `RunId` (varsa), `ActorId`, `OccurredAt`, `Details` (JSON).

---

*Son güncelleme: 2026-03-08*
