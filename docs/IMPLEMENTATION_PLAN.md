# CrewOps V2 — Implementation Plan

Bu belge CrewOps V2'nin beş fazlı implementation planını tanımlar. Her faz bir öncekinin üzerine inşa eder; faz tamamlanmadan bir sonrakine geçilmez.

---

## Yaklasim

Büyük kod dökümü yok. Her faz kendi test paketini içerir ve bu testler geçmeden faz tamamlanmış sayılmaz. Tasarım kararları OPEN_QUESTIONS.md'de, tamamlanan kararlar DECISIONS.md'de izlenir.

Temel prensipler:

- **Outside-in değil, inside-out:** Domain katmanı önce yazılır, çünkü iş kuralları framework bağımlılığından bağımsız olmalıdır.
- **Her faz shippable:** Her faz sonunda çalışan testler ve açık API (ya da en azından açık domain model) mevcut olacak.
- **Port-first, yeni özellik-sonra:** V1'deki çalışan mantık önce port edilir; yeni özellikler sonra eklenir. Bu yaklaşım regresyon riskini azaltır.

---

## Faz Genel Gorunumu

```
Faz 1: Domain + Contracts        → İş kuralları, state machine, port arayüzleri
Faz 2: Infrastructure             → Veritabanı, LLM client, repository implementasyonları
Faz 3: Application + API          → Use case'ler, MediatR, Minimal API endpoint'leri
Faz 4: Execution + Orchestration  → Worker, loop, capability yükleme
Faz 5: Governance + Web UI        → Gate engine'ler, audit, Blazor sayfaları
```

---

## Faz 1 — Domain + Contracts

### Hedef

Domain mantığı framework bağımlılığı sıfır olarak test edilebilir durumda. `CrewOps.Domain` projesi yalnızca C# standard library'ye bağlıdır; NuGet paketi yoktur.

### Dosyalar

```
src/CrewOps.Domain/
├── Aggregates/
│   ├── Project.cs              ← ProjectState + business rules
│   ├── Task.cs                 ← TaskStatus, dependency check
│   ├── ExecutionRun.cs         ← ExecutionStatus lifecycle
│   ├── Agreement.cs            ← AgreementDraftStatus
│   └── ReleaseRequest.cs       ← V2.1 tam implementasyon; MVP stub
├── ValueObjects/
│   ├── ProjectState.cs         ← enum + geçerli geçiş tanımları
│   ├── TaskStatus.cs
│   ├── ExecutionStatus.cs
│   └── ModelTier.cs
├── StateMachine/
│   └── ProjectStateMachine.cs  ← Transition() + geçiş kuralları
├── DomainEvents/
│   ├── AgreementApproved.cs
│   ├── TaskCompleted.cs
│   └── ApprovalGateTriggered.cs
└── Ports/
    ├── IProjectRepository.cs
    ├── ITaskRepository.cs
    └── IExecutionRunRepository.cs

src/CrewOps.Contracts/
├── Commands/                   ← MediatR IRequest<T> tanımları
├── Queries/                    ← MediatR IRequest<T> tanımları
└── Dtos/                       ← API response/request DTO'ları

tests/CrewOps.Domain.Tests/
├── StateMachine/
│   └── ProjectStateMachineTests.cs
└── Aggregates/
    └── ProjectTests.cs
```

### Kritik Tasarim Kararlari

`ProjectStateMachine` sınıfı geçiş matrisini dictionary olarak tutar. `Transition(ProjectState current, ProjectState target)` metodu bu matrise bakar; geçersiz geçişte `InvalidProjectStateTransitionException` fırlatır.

```csharp
// Geçerli geçiş varsa yeni state döner, yoksa exception fırlatır.
// İdempotent değildir: aynı state'e iki kez geçiş geçersizdir.
public ProjectState Transition(ProjectState current, ProjectState target)
{
    if (!_validTransitions.TryGetValue(current, out var allowed) || !allowed.Contains(target))
        throw new InvalidProjectStateTransitionException(current, target);
    return target;
}
```

### Test Gereksinimleri (Faz 1)

- Her geçerli state geçişi başarılı; dönen state beklenen değere eşit.
- Her geçersiz state geçişi `InvalidProjectStateTransitionException` fırlatır.
- `ProjectStateMachine.Transition()` idempotent değil: `NEW → NEW` hata üretir.
- `Project` aggregate iş kuralları: onaysız agreement ile task oluşturulamaz.
- Domain event'lerin doğru koşullarda üretildiği doğrulanır.

---

## Faz 2 — Infrastructure + Persistence

### Hedef

Veritabanı çalışıyor, LLM client test edilebilir, repository testleri geçiyor.

### Dosyalar

```
src/CrewOps.Infrastructure/
├── Persistence/
│   ├── CrewOpsDbContext.cs             ← EF Core DbContext
│   ├── Configurations/
│   │   ├── ProjectConfiguration.cs
│   │   ├── TaskConfiguration.cs
│   │   ├── ExecutionRunConfiguration.cs
│   │   ├── AgreementDraftConfiguration.cs
│   │   ├── TaskReviewConfiguration.cs
│   │   ├── AuditEventConfiguration.cs
│   │   ├── CostRecordConfiguration.cs
│   │   └── ArtifactConfiguration.cs
│   ├── Migrations/                     ← EF Core generated migration'lar
│   └── Repositories/
│       ├── ProjectRepository.cs
│       ├── TaskRepository.cs
│       └── ExecutionRunRepository.cs
├── LlmClients/
│   └── AnthropicHttpClient.cs          ← ILlmClient implementasyonu
└── Capabilities/
    └── FileSystemCapabilityLoader.cs   ← agents-main dizin taraması

infra/
└── docker/
    └── docker-compose.yml              ← SQL Server Developer Edition local dev
```

`docker-compose.yml` minimal yapı:

```yaml
# SQL Server local development container
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: "CrewOps_Dev_2026!"
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - sqlserver-data:/var/opt/mssql

volumes:
  sqlserver-data:
```

### Test Gereksinimleri (Faz 2)

- Repository CRUD testleri (integration test, gerçek veritabanı, testcontainers veya localDB).
- `AnthropicHttpClient` unit testi: mock `HttpMessageHandler` ile request/response doğrulama.
- EF Core migration doğrulama: `MigrationValidator` ile schema ve migration tutarlılığı.
- `FileSystemCapabilityLoader`: mock dosya sistemi ile agent katalog yükleme testi.

---

## Faz 3 — Application Layer + API

### Hedef

PM chat akışı API üzerinden uçtan uca çalışıyor; `[MUTABAKAT_HAZIR]` algılanıyor ve `AgreementDraft` oluşturuluyor.

### Dosyalar

```
src/CrewOps.Application/
├── Commands/
│   ├── CreateProject/
│   │   ├── CreateProjectCommand.cs
│   │   └── CreateProjectCommandHandler.cs
│   ├── ApproveAgreement/
│   │   ├── ApproveAgreementCommand.cs
│   │   └── ApproveAgreementCommandHandler.cs
│   └── ...                             ← Diğer command sınıfları
├── Queries/
│   ├── GetProjectById/
│   │   ├── GetProjectByIdQuery.cs
│   │   └── GetProjectByIdQueryHandler.cs
│   ├── GetProjectTimeline/
│   │   ├── GetProjectTimelineQuery.cs
│   │   └── GetProjectTimelineQueryHandler.cs
│   └── ...
└── Services/
    ├── PmService.cs                    ← PM chat + mutabakat + özet
    └── PlannerService.cs               ← Agreement → task decomposition

src/CrewOps.Api/
├── Program.cs                          ← Minimal API host, DI registration
├── Routes/
│   ├── ProjectRoutes.cs
│   ├── PmRoutes.cs
│   ├── TaskRoutes.cs
│   └── AuditRoutes.cs
└── Hubs/
    └── ExecutionHub.cs                 ← SignalR hub
```

`PmService.SendMessageAsync()` imzası:

```csharp
// PM ile bir tur sohbet gerçekleştirir.
// Dönen PmMessageResult içinde IsAgreementReady flag'i bulunur.
// IsAgreementReady == true ise AgreementDraft otomatik oluşturulur.
public Task<PmMessageResult> SendMessageAsync(
    Guid projectId,
    string userMessage,
    CancellationToken ct = default);
```

API endpoint belgeleri:

| Method | Path | Handler | Açıklama |
|--------|------|---------|---------|
| `POST` | `/api/projects` | `CreateProjectCommandHandler` | Yeni proje oluştur |
| `GET` | `/api/projects/{id}` | `GetProjectByIdQueryHandler` | Proje detayı |
| `GET` | `/api/projects` | `GetProjectsQueryHandler` | Proje listesi |
| `POST` | `/api/projects/{id}/pm/messages` | `PmRoutes` → `PmService` | PM'e mesaj gönder |
| `POST` | `/api/projects/{id}/agreements/{agId}/approve` | `ApproveAgreementCommandHandler` | Agreement onayla |
| `GET` | `/api/projects/{id}/timeline` | `GetProjectTimelineQueryHandler` | Proje zaman çizelgesi |

### Test Gereksinimleri (Faz 3)

- `PmService.SendMessageAsync()` unit testi: mock `ILlmClient` ile marker algılama, agreement oluşturma.
- `PlannerService.DecomposeAsync()` unit testi: mock LLM response ile task decomposition doğrulama.
- API integration testleri: `WebApplicationFactory<Program>` ile endpoint testleri; gerçek DI, mock LLM client.
- Command handler testleri: repository mock'ları ile iş kuralı doğrulama.

---

## Faz 4 — Execution + Orchestration

### Hedef

Görev yürütme çalışıyor, artifact toplanıyor, review gate işliyor; `LocalClaudeWorker` → `WorkerResultNormalizer` → `ArtifactCollector` → `PmReviewService` zinciri entegre çalışıyor.

### Dosyalar

```
src/CrewOps.Execution/
├── ExecutionRunManager.cs              ← Run lifecycle yönetimi
├── WorkspaceManager.cs                 ← IWorkspaceManager implementasyonu
├── Workers/
│   └── LocalClaudeWorker.cs            ← V1 ClaudeCodeRunner port
├── Normalization/
│   ├── WorkerResultNormalizer.cs       ← V1 OutputParser port (5-bölüm)
│   └── SkillContentSanitizer.cs        ← V1 sanitizeSkillContent port
├── ArtifactCollector.cs
└── ExecutionCostTracker.cs

src/CrewOps.Orchestration/
├── OrchestrationLoop.cs                ← V1 OrchestrationLoop port
├── TaskGraphBuilder.cs                 ← DAG oluşturma
├── TaskDispatcher.cs
└── RetryPolicy.cs

src/CrewOps.Capabilities/
├── CapabilityRegistry.cs               ← agents-main startup scan
├── RoleProfileLoader.cs                ← templates/role-profiles/ yükleme
└── ContextAssembler.cs                 ← Prompt assembly, sanitasyon dahil
```

`LocalClaudeWorker` tasarım notu: `Process.Start()` ile Claude Code CLI spawn eder. Stdout/stderr asenkron okunur; `ExecutionHub` üzerinden SignalR stream gönderir. Process sonuçlandığında stdout `WorkerResultNormalizer`'a iletilir.

`WorkerResultNormalizer` 5-bölüm sözleşmesi (V1'den port):

```
## SUMMARY
...
## FILES_CHANGED
...
## PATCH
...
## NEXT
...
## RISKS
...
```

Herhangi bir bölüm eksikse `PartialWorkerOutputException` fırlatılır ve run `FAILED` durumuna geçer; retry policy devreye girer.

### Test Gereksinimleri (Faz 4)

- `WorkerResultNormalizer` parse testleri: geçerli 5-bölüm output, eksik bölüm, boş bölüm, bölüm sırası yanlış.
- `OrchestrationLoop` dependency graph testleri: döngüsel bağımlılık tespiti, sıralı yürütme doğrulaması.
- `LocalClaudeWorker` unit testi: mock `Process` ile spawn doğrulama; stdout/stderr capture.
- `SkillContentSanitizer` testleri: her unsafe pattern için sanitize doğrulama; clean content değişmeden geçer.
- `TaskGraphBuilder` testleri: bağımlılıksız görevler, lineer zincir, paralel dal (V2.1'de gerekecek).

---

## Faz 5 — Governance + Web UI

### Hedef

Tam MVP akışı Blazor UI üzerinden çalışıyor. `ApprovalGateEngine` ve `AuditEventPublisher` production-ready.

### Dosyalar

```
src/CrewOps.Governance/
├── ApprovalGateEngine.cs               ← Gate kuralları, AllGatesPassed()
├── RiskGateEngine.cs                   ← RiskItem seviye escalation
├── ReviewRequirementChecker.cs
└── ReleaseReadinessEvaluator.cs        ← MVP stub; V2.1'de tam implementasyon

src/CrewOps.Observability/
├── AuditEventPublisher.cs              ← AuditEvent DB yazma + Serilog log
└── ProjectTimeline.cs                  ← Kronolojik olay sorgusu

src/CrewOps.Web/
├── Pages/
│   ├── PmChat.razor                    ← PM chat arayüzü
│   ├── Dashboard.razor                 ← Proje listesi, durum özeti
│   ├── TaskGraph.razor                 ← DAG görselleştirme
│   ├── ApprovalPanel.razor             ← Agreement + final onay
│   └── RunConsole.razor                ← Gerçek zamanlı execution log
└── Shared/
    └── Components/                     ← Ortak Blazor bileşenleri
```

`ApprovalGateEngine.AllGatesPassed()` kuralları:

```csharp
// Tüm kurallar sağlanmışsa true döner.
// Herhangi biri sağlanmamışsa false döner ve hangi kuralın başarısız olduğu loglanır.
public bool AllGatesPassed(ReleaseRequest request)
{
    return AllTasksCompleted(request.ProjectId)
        && HasHumanApproval(request)
        && NoOpenCriticalRisks(request.ProjectId)
        && AgreementIsApproved(request.ProjectId);
}
```

Blazor UI dil kuralı: tüm kullanıcıya görünen metinler (butonlar, etiketler, başlıklar, bildirimler, hata mesajları) Türkçe. Blazor component class adları, metot adları, parametre adları İngilizce.

### Test Gereksinimleri (Faz 5)

- `ApprovalGateEngine` testleri: her kuralın tek tek başarısız olduğu senaryolar, tüm kuralların geçtiği senaryo.
- `RiskGateEngine` testleri: `LOW/MEDIUM/HIGH/CRITICAL` seviye escalation kuralları.
- Blazor bUnit component testleri: `PmChat`, `ApprovalPanel` temel etkileşimler.
- End-to-end senaryo testi (manuel veya Playwright): MVP başarı kriterleri belgesi ile karşılaştırma.

---

## Test Gereksinimleri Ozeti

| Test Tipi | Kapsam | Framework |
|-----------|--------|-----------|
| Domain unit | State machine, aggregate business rules | xUnit + FluentAssertions |
| Application unit | Use case'ler, servisler (mock bağımlılıklar) | xUnit + NSubstitute |
| Orchestration unit | DAG, loop, retry policy | xUnit + FluentAssertions |
| Infrastructure integration | Repository CRUD, EF Core (gerçek DB) | xUnit + Testcontainers veya LocalDB |
| API integration | Endpoint'ler, tam DI, mock LLM | xUnit + WebApplicationFactory |
| Blazor component | Kullanıcı etkileşimleri | bUnit + xUnit |
| E2E (opsiyonel) | Tam MVP akışı | Playwright veya manuel |

---

## Hedef Repository Yapisi

```
D:\Dev\CrewOps\
├── src\
│   ├── CrewOps.Domain\
│   ├── CrewOps.Contracts\
│   ├── CrewOps.Application\
│   ├── CrewOps.Infrastructure\
│   ├── CrewOps.Orchestration\
│   ├── CrewOps.Capabilities\
│   ├── CrewOps.Execution\
│   ├── CrewOps.Governance\
│   ├── CrewOps.Releases\
│   ├── CrewOps.Observability\
│   ├── CrewOps.Api\
│   └── CrewOps.Web\
├── agent-runtime\
│   └── scripts\
├── tests\
│   ├── CrewOps.Domain.Tests\
│   ├── CrewOps.Application.Tests\
│   ├── CrewOps.Orchestration.Tests\
│   └── CrewOps.Integration.Tests\
├── docs\                              ← Planlama belgeleri
├── infra\
│   ├── docker\
│   │   └── docker-compose.yml         ← SQL Server local dev
│   ├── migrations\
│   └── scripts\
│       └── seed.sql
├── templates\
│   ├── capability-packs\
│   ├── role-profiles\                 ← V1 templates/roles/ buraya taşınır
│   └── workflow-bundles\
├── v1\                                ← V1 Node.js kodu (arşiv, silinmez)
│   ├── apps\
│   ├── packages\
│   └── agents-main\
└── CrewOps.sln
```

---

## Faz Tamamlanma Kriterleri Ozeti

| Faz | Tamamlanma Kriteri |
|-----|-------------------|
| Faz 1 | Domain unit testleri yeşil; framework bağımlılığı sıfır |
| Faz 2 | Repository integration testleri yeşil; `docker-compose up` ile DB ayağa kalkıyor |
| Faz 3 | PM chat API çalışıyor; `[MUTABAKAT_HAZIR]` algılanıyor; API testleri yeşil |
| Faz 4 | `LocalClaudeWorker` bir görevi çalıştırıyor; 5-bölüm output parse ediliyor; orchestration testleri yeşil |
| Faz 5 | MVP başarı kriterleri (bkz. MVP_SCOPE.md) Blazor UI üzerinden karşılanıyor |

---

*Son güncelleme: 2026-03-08*
