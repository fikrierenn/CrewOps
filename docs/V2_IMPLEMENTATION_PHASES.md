# CrewOps V2 - Implementasyon Fazları

> Bu belge, V2 evrensel orkestratörün 5 fazlı implementasyon planını detaylı şekilde tanımlar.
> Son güncelleme: 2026-04-07

---

## Genel Bakış

| Faz | İçerik | Bağımlılık | ~Dosya |
|-----|--------|------------|--------|
| 1 | Domain Model Tamamlama | - | ~12 |
| 2 | Capabilities Katmanı | Faz 1 | ~15 + 6 JSON |
| 3 | Infrastructure / Persistence | Faz 1 | ~12 |
| 4 | Observability & Real-time | Faz 1, 3 | ~18 |
| 5 | API & Entegrasyon | Faz 1-4 | ~15 |

```
Faz 1 (Domain) ──┬──► Faz 2 (Capabilities)  ──┐
                  │                              ├──► Faz 5 (API + Test)
                  └──► Faz 3 (Infrastructure) ──┤
                                                 └──► Faz 4 (Observability)
```

Faz 2 ve 3 birbirinden bağımsız, paralel geliştirilebilir.

---

## Faz 1: Domain Model Tamamlama

### 1A. Project.cs Güncelleme
**Dosya:** `src/CrewOps.Domain/Aggregates/Project.cs`

Değişiklikler:
- `RepoPath` → `string?` (nullable — yazılım dışı projeler repo'suz)
- `Stack` → `string?` (nullable)
- Yeni: `string? Domain` — iş alanı tanımlayıcı ("software", "marketing", "seo")
- Yeni: `Guid? TeamTemplateId` — seçilen takım şablonu referansı
- Yeni: `GovernancePreset? Governance` — aggregate üzerinde tutulur, state machine infra'ya bağımlı olmaz
- Yeni factory: `static Project CreateUniversal(string name, string initialRequest, string? repoPath = null, string? stack = null, string? domain = null)`
- Yeni method: `AssignTeamTemplate(Guid templateId, string templateName, GovernancePreset governance)` → TeamTemplateAssigned event raise eder

**Tasarım kararı:** GovernancePreset aggregate'e gömülü. State machine hiçbir zaman infrastructure'a çağrı yapmaz. Template'in governance'ı değişirse mevcut projeler eski governance'ı korur — doğru davranış.

### 1B. TeamTemplate + TeamRoleSlot Value Objects
**Yeni:** `src/CrewOps.Domain/ValueObjects/TeamTemplate.cs`
```csharp
public sealed record TeamTemplate(
    Guid Id,
    string Name,
    string Domain,
    string Description,
    GovernancePreset Governance,
    OutputType DefaultOutputType,
    IReadOnlyList<TeamRoleSlot> RoleSlots);
```

**Yeni:** `src/CrewOps.Domain/ValueObjects/TeamRoleSlot.cs`
```csharp
public sealed record TeamRoleSlot(
    string RoleId,
    string DisplayName,
    ModelTier ModelTier,
    bool IsRequired);
```

JSON dosyalarından startup'ta yüklenir, runtime'da immutable. DB'ye yazılmaz — proje sadece TeamTemplateId ve GovernancePreset snapshot'ı tutar.

### 1C. ExecutionRun Aggregate
**Yeni:** `src/CrewOps.Domain/Aggregates/ExecutionRun.cs`

Properties:
| Property | Tip | Açıklama |
|----------|-----|----------|
| Id | Guid | PK |
| TaskId | Guid | Bağlı görev |
| ProjectId | Guid | Bağlı proje |
| RoleId | string | Çalıştıran rol |
| ModelTier | ModelTier | Kullanılan model seviyesi |
| Status | ExecutionStatus | Mevcut durum |
| WorkspacePath | string? | Çalışma dizini |
| RawOutput | string? | Ham çıktı |
| ErrorMessage | string? | Hata mesajı |
| InputTokens | int | Giriş token sayısı |
| OutputTokens | int | Çıkış token sayısı |
| CostUsd | decimal | Maliyet (USD) |
| DurationMs | long | Süre (ms) |
| AttemptNumber | int | Deneme numarası |
| CreatedAt | DateTime | Oluşturulma |
| StartedAt | DateTime? | Başlangıç |
| CompletedAt | DateTime? | Bitiş |

Factory: `static Create(taskId, projectId, roleId, modelTier, attemptNumber)`

Status geçişleri (ExecutionStatus enum sırasıyla):
- `MarkQueued()` — Created → Queued
- `MarkWorkspacePrepared(workspacePath)` — Queued → WorkspacePrepared
- `MarkRunning()` — WorkspacePrepared → Running (StartedAt set, ExecutionRunStarted event)
- `MarkCollectingArtifacts()` — Running → CollectingArtifacts
- `MarkNormalizing()` — CollectingArtifacts → Normalizing
- `MarkReviewing()` — Normalizing → Reviewing
- `MarkCompleted(rawOutput, inputTokens, outputTokens, costUsd, durationMs)` — Reviewing → Completed (CompletedAt set, ExecutionRunCompleted event)
- `MarkFailed(errorMessage)` — herhangi non-terminal → Failed
- `MarkTimedOut()` — Running → TimedOut

Her method guard ile korunur, invalid geçiş → InvalidOperationException.

### 1D. ProjectStateMachine
**Yeni:** `src/CrewOps.Domain/StateMachine/IProjectStateMachine.cs`
**Yeni:** `src/CrewOps.Domain/StateMachine/ProjectStateMachine.cs`

Temel transition matrix (WORKFLOW_STATE_MACHINE.md'den):
```
New → {Discovery}
Discovery → {NeedsClarification, AgreementDrafted}
NeedsClarification → {Discovery, AgreementDrafted}
AgreementDrafted → {AgreementApproved, NeedsClarification}
AgreementApproved → {Planned}
Planned → {TasksCreated}
TasksCreated → {CapabilitiesAssigned}
CapabilitiesAssigned → {InExecution}
InExecution → {InQa, Failed, RollbackRequired}
InQa → {InReview, InExecution}
InReview → {ReadyForPmSummary, NeedsClarification, InExecution}
ReadyForPmSummary → {ReadyForHumanReview}
ReadyForHumanReview → {ApprovedForStaging, ChangesRequested}
ChangesRequested → {InExecution, Planned, NeedsClarification}
ApprovedForStaging → {StagingDeployed}
StagingDeployed → {UatPassed, RollbackRequired}
UatPassed → {ApprovedForProduction}
ApprovedForProduction → {ProductionDeployed}
ProductionDeployed → {Observing, RollbackRequired}
Observing → {Completed, RollbackRequired}
RollbackRequired → {RolledBack}
RolledBack → {InExecution, Failed}
Completed → {} (terminal)
Failed → {} (terminal)
```

Governance shortcut'ları (base transition'lar SİLİNMEZ, sadece yeni yollar EKLENİR):
- `!HasQaPhase` → InExecution → InReview eklenir
- `!HasStagingGate && !HasProductionGate` → ReadyForHumanReview → Completed eklenir
- `!HasProductionGate` (ama staging var) → UatPassed → Completed eklenir

Public API:
- `Transition(Project project, ProjectState target, string? triggeredBy)` — validate + apply + event
- `GetAllowedTransitions(ProjectState current, GovernancePreset? governance)` → IReadOnlySet<ProjectState>

### 1E. Yeni Domain Events
- `src/CrewOps.Domain/DomainEvents/TeamTemplateAssigned.cs`
- `src/CrewOps.Domain/DomainEvents/ExecutionRunStarted.cs`
- `src/CrewOps.Domain/DomainEvents/ExecutionRunCompleted.cs`

### 1F. Unit Tests
**Sil:** `tests/CrewOps.Domain.Tests/UnitTest1.cs`

**Yeni test dosyaları:**
| Dosya | Test Sayısı | Kapsam |
|-------|-------------|--------|
| `Aggregates/ProjectTests.cs` | ~10 | Create, CreateUniversal, AssignTeamTemplate, ApplyTransition |
| `Aggregates/ExecutionRunTests.cs` | ~8 | Create, full lifecycle, invalid transitions, MarkFailed |
| `Aggregates/CrewOpsTaskTests.cs` | ~8 | Full lifecycle, retry flow, invalid transitions |
| `StateMachine/ProjectStateMachineTests.cs` | ~20 | Her valid transition, terminal states, governance shortcuts |

---

## Faz 2: Capabilities Katmanı

### 2A. Yeni Proje
`src/CrewOps.Capabilities/CrewOps.Capabilities.csproj`
- net10.0, ref: CrewOps.Domain
- NuGet: YamlDotNet (SKILL.md frontmatter parse)

### 2B. Modeller
| Dosya | Açıklama |
|-------|----------|
| `Models/SkillManifest.cs` | Id, Name, Domain, Description, Tier2Content, Tier3ResourcePath |
| `Models/RoleProfile.cs` | Id, Domain, DisplayName, DefaultModelTier, AcceptedTaskTypes |
| `Models/CapabilityPack.cs` | Id, Version, Domain, SkillIds, CompatibleRoles |
| `Models/DomainInfo.cs` | Id, DisplayName, DefaultOutputType, DefaultGovernance |

### 2C. Registry
- `ICapabilityRegistry.cs` — GetAllRoles, GetRole, GetPacksByDomain, GetAllTeamTemplates, GetTeamTemplate, GetSkillsByDomain
- `InMemoryCapabilityRegistry.cs` — Dictionary-backed, startup'ta yüklenir, read thread-safe

### 2D. Scanner & Loaders
- `Scanning/SkillSourceScanner.cs` — `agents-main/plugins/*/skills/*/SKILL.md` glob → YAML parse → SkillManifest list
- `Loading/TeamTemplateLoader.cs` — `templates/team-templates/*.json` → TeamTemplate list
- `Loading/RoleProfileLoader.cs` — `templates/roles/*.json` (mevcut 7 dosya) → RoleProfile map

### 2E. Team Template JSON Dosyaları
**Yeni dizin:** `templates/team-templates/`

| Dosya | Domain | Governance | Roller |
|-------|--------|------------|--------|
| `full-stack-software.json` | software | FullSoftware | pm, architect, backend, frontend, sql, qa, devops |
| `backend-api.json` | software | FullSoftware | pm, architect, backend, sql, qa, devops |
| `frontend-spa.json` | software | FullSoftware (staging/prod yok) | pm, architect, frontend, qa |
| `marketing-content.json` | marketing | Minimal | pm, content-strategist, copywriter, seo-specialist |
| `seo-optimization.json` | seo | Minimal | pm, seo-analyst, content-writer, technical-seo |
| `data-analytics.json` | analytics | Minimal | pm, data-analyst, sql, visualization-specialist |

### 2F. Tests
`tests/CrewOps.Capabilities.Tests/`
- SkillSourceScannerTests.cs (test SKILL.md fixture'ları ile)
- TeamTemplateLoaderTests.cs
- RoleProfileLoaderTests.cs
- InMemoryCapabilityRegistryTests.cs

---

## Faz 3: Infrastructure / Persistence

### 3A. Yeni Proje
`src/CrewOps.Infrastructure/CrewOps.Infrastructure.csproj`
- net10.0, ref: CrewOps.Domain
- NuGet: Microsoft.EntityFrameworkCore.SqlServer, Microsoft.EntityFrameworkCore.Tools

### 3B. DbContext
`Persistence/CrewOpsDbContext.cs`
- DbSet: Projects, Tasks, ExecutionRuns, AuditEvents, CostRecords
- SaveChangesAsync override: domain event collect → base.SaveChanges → MediatR publish → ClearDomainEvents

### 3C. Entity Configurations
| Dosya | Tablo | Özel Yapılandırma |
|-------|-------|-------------------|
| `ProjectConfiguration.cs` | Projects | GovernancePreset owned entity, State string conversion |
| `CrewOpsTaskConfiguration.cs` | Tasks | DependencyIds JSON column, index (ProjectId, Status) |
| `ExecutionRunConfiguration.cs` | ExecutionRuns | CostUsd precision(18,6), index (TaskId), (ProjectId, CreatedAt) |
| `AuditEventConfiguration.cs` | AuditEvents | Append-only, index (ProjectId, OccurredAt) |

### 3D. Repository Implementations
- `Repositories/ProjectRepository.cs` — IProjectRepository
- `Repositories/TaskRepository.cs` — ITaskRepository (GetReadyToRunAsync: pending + dependencies complete, memory filter OK for MVP)
- `Repositories/ExecutionRunRepository.cs` — IExecutionRunRepository
- `Repositories/AuditEventRepository.cs` — IAuditEventRepository

### 3E. Migration & Docker
- `dotnet ef migrations add InitialCreate`
- `infra/docker/docker-compose.yml` — SQL Server 2022 Developer, port 1433

---

## Faz 4: Observability & Real-time

### 4A. Domain Observability Entities
**Yeni:** `src/CrewOps.Domain/Entities/AuditEvent.cs`
- Append-only entity: EventId, ProjectId, EventType(enum), ActorId, Payload(JSON), OccurredAt
- Sadece Create factory, update/delete yok

**Yeni:** `src/CrewOps.Domain/ValueObjects/AuditEventType.cs`
```
PROJECT_CREATED, STATE_CHANGED, AGREEMENT_DRAFTED, AGREEMENT_APPROVED,
PLAN_CREATED, TASKS_CREATED, CAPABILITIES_ASSIGNED,
EXECUTION_STARTED, EXECUTION_COMPLETED, EXECUTION_FAILED,
GATE_TRIGGERED, GATE_APPROVED, GATE_REJECTED,
TASK_STATUS_CHANGED, INVALID_TRANSITION_ATTEMPTED
```

### 4B. AuditEventPublisher
`src/CrewOps.Infrastructure/Observability/AuditEventPublisher.cs`
- MediatR INotificationHandler<T> — her domain event → AuditEvent kaydı → DB
- Hata durumunda: Serilog.Critical log, business flow bloklanmaz

| Domain Event | → AuditEventType |
|---|---|
| ProjectStateChanged | STATE_CHANGED |
| TaskCompleted | TASK_STATUS_CHANGED |
| ExecutionRunStarted | EXECUTION_STARTED |
| ExecutionRunCompleted | EXECUTION_COMPLETED / EXECUTION_FAILED |
| AgreementApproved | AGREEMENT_APPROVED |
| ApprovalGateTriggered | GATE_TRIGGERED |
| TeamTemplateAssigned | CAPABILITIES_ASSIGNED |

### 4C. SignalR Hub
**Yeni:** `src/CrewOps.Api/Hubs/ProjectHub.cs`
- Client methods: JoinProjectGroup(projectId), LeaveProjectGroup(projectId)
- Server→Client mesajları: ProjectStateUpdated, TaskStatusUpdated, ExecutionRunUpdated, AuditEventCreated, CostUpdated

**Yeni:** `src/CrewOps.Infrastructure/Observability/SignalREventForwarder.cs`
- Domain event → IHubContext<ProjectHub> → ilgili project grubuna push
- Her bağlı Blazor sayfası anında güncelleme alır

### 4D. Blazor Server Dashboard (6 Sayfa)
**Yeni proje:** `src/CrewOps.Web/` (Blazor Server, net10.0)

| # | Sayfa | Açıklama |
|---|-------|----------|
| 1 | `Pages/Dashboard.razor` | Proje listesi, durum badge'leri, özet kartlar (aktif/tamamlanan/maliyet) |
| 2 | `Pages/ProjectOverview.razor` | State machine görünümü (aktif state vurgulu, governance-atlanmış state'ler soluk), geçiş timeline'ı |
| 3 | `Pages/TaskBoard.razor` | Görev tablosu: başlık, rol, durum, karmaşıklık, dependency, son güncelleme |
| 4 | `Pages/ExecutionTimeline.razor` | Kronolojik çalışma kaydı: task, rol, süre, maliyet, token, hata detayı |
| 5 | `Pages/AgentActivityLog.razor` | Filtrelenebilir AuditEvent tablosu (tip, tarih aralığı, aktör filtreleri) |
| 6 | `Pages/Analytics.razor` | Tamamlanma oranları, state süreleri, model kullanımı, maliyet dağılımı, rol kullanım sıklığı |

### 4E. Analytics Query Service
`src/CrewOps.Infrastructure/Observability/AnalyticsQueryService.cs`
- GetCompletionStatsAsync — proje bazlı tamamlanma sayıları
- GetAverageStateDurationsAsync — state başına ortalama süre
- GetModelUsageBreakdownAsync — model bazlı token/maliyet
- GetProjectCostSummariesAsync — proje başına toplam maliyet
- GetRoleUtilizationAsync — rol kullanım sıklığı

### 4F. Serilog
- File sink: `logs/crewops-{Date}.log` (daily rolling)
- SQL Server sink: ApplicationLogs tablosu
- CorrelationId enricher middleware

---

## Faz 5: API & Entegrasyon

### 5A. API Host
`src/CrewOps.Api/CrewOps.Api.csproj`
- Tek ASP.NET Core host: Minimal API + Blazor Server + SignalR
- NuGet: MediatR, Serilog.AspNetCore, FluentValidation.AspNetCore

### 5B. Route Dosyaları
| Dosya | Endpoints |
|-------|-----------|
| `Routes/ProjectRoutes.cs` | POST /api/projects, POST /api/projects/universal, GET /api/projects, GET /api/projects/{id}, PUT /api/projects/{id}/team-template |
| `Routes/TaskRoutes.cs` | GET /api/projects/{id}/tasks, GET /api/tasks/{id} |
| `Routes/ExecutionRoutes.cs` | GET /api/projects/{id}/runs, GET /api/runs/{id} |
| `Routes/AuditRoutes.cs` | GET /api/projects/{id}/timeline, GET /api/projects/{id}/audit-events?type=&from=&to= |
| `Routes/AnalyticsRoutes.cs` | GET /api/analytics/completion-stats, model-usage, costs, role-utilization |
| `Routes/CapabilityRoutes.cs` | GET /api/team-templates, /api/team-templates/{id}, /api/roles, /api/domains |

### 5C. Application Layer
`src/CrewOps.Application/CrewOps.Application.csproj` — ref: Domain, Contracts, NuGet: MediatR.Contracts

Command Handlers:
- CreateProjectCommandHandler
- CreateUniversalProjectCommandHandler
- AssignTeamTemplateCommandHandler

Query Handlers:
- GetProjectByIdQueryHandler, GetProjectsQueryHandler
- GetTasksByProjectQueryHandler
- GetProjectTimelineQueryHandler
- Analytics query handlers → IAnalyticsQueryService'e delegate

### 5D. Contracts
`src/CrewOps.Contracts/` — Commands, Queries, DTOs doldurulacak:
- Commands: CreateProjectCommand, CreateUniversalProjectCommand, AssignTeamTemplateCommand
- Queries: GetProjectByIdQuery, GetProjectsQuery, GetTasksByProjectQuery, GetProjectTimelineQuery
- DTOs: ProjectDto, TaskDto, ExecutionRunDto, AuditEventDto, TimelineEntryDto, AnalyticsDto, TeamTemplateDto, RoleProfileDto

### 5E. Integration Tests
`tests/CrewOps.Integration.Tests/`
- ApiIntegrationTests.cs — WebApplicationFactory<Program>
- SignalRIntegrationTests.cs — test client → ProjectHub
- EndToEndScenarioTests.cs — create → assign template → verify audit trail

---

## Tasarım Kararları (Özet)

1. **GovernancePreset aggregate'e gömülü** — State machine saf kalır, infra çağrısı yok
2. **Governance shortcut ekler, transition silmez** — Full software flow her zaman base
3. **AuditEvent append-only** — Update/delete yok, immutable log
4. **Domain event'ler SaveChanges sonrası dispatch** — Ghost event önlenir
5. **Tek ASP.NET Core host** — API + Blazor + SignalR aynı process, CORS yok
6. **TeamTemplate file-backed** — JSON'dan startup'ta yüklenir, DB'ye yazılmaz
7. **DependencyIds JSON column** — MVP scale için yeterli, junction table gereksiz
8. **SignalR groups per project** — Broadcast storm önlenir

---

## Use Case Örnekleri (Evrensel Orkestratör)

### 1. Güzellik Salonu Site Satışı
Hedef: Google yorumları iyi (4+ yıldız) ama sitesi kötü veya HİÇ YOK olan salonlar
- Research Agent → Google Maps/Reviews tarama, site kalitesi değerlendirme
- Designer Agent → Her salon için premium demo site oluşturma
- Copywriter Agent → Kişiselleştirilmiş hook mail/mesaj yazma
- Outreach Agent → Mail gönderim + takip

### 2. SEO Audit & İyileştirme
- SEO Analyst → Site audit, rakip analizi
- Content Writer → Meta description, başlık önerileri
- Technical SEO → Sitemap, schema markup, speed optimizasyonu

### 3. İçerik Üretim Fabrikası
- Content Strategist → Takvim + konu planı
- Copywriter → Makale yazımı (SEO uyumlu)
- Social Media Agent → Paylaşım metinleri + zamanlama

### 4. Rakip Analizi
- Research Agent → Fiyat, ürün, sosyal medya verisi toplama
- Data Analyst → Karşılaştırma tablosu
- Strategist → Aksiyon önerileri

### 5. E-ticaret Mağaza Kurulumu
- Backend Agent → Platform API entegrasyonu
- Copywriter → Ürün açıklamaları
- SEO Agent → Ürün SEO optimizasyonu
