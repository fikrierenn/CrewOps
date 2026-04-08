# CrewOps V2 — Hedef Mimari

> **Dil notu**: Teknik terimler (sınıf isimleri, namespace'ler, teknoloji adları) İngilizce; açıklamalar Türkçe.

## Özet (Türkçe)

CrewOps V2, **.NET 10** üzerinde **Clean Architecture + Vertical Feature Slices** kullanılarak inşa edilmektedir.

**Temel teknoloji kararları:**

| Katman | Teknoloji | Gerekçe |
|--------|-----------|---------|
| Domain mantığı | C# 13 / .NET 10 | Tip güvenliği, domain modeling gücü |
| API | ASP.NET Core Minimal API | Hafif, MVC yükü yok |
| Gerçek zamanlı | SignalR | .NET native, SSE'yi değiştirir, yeniden bağlanma desteği |
| UI | Blazor Server | C# component'ları, minimal JS, server-side rendering |
| Veritabanı | SQL Server + EF Core | Üretim kaliteli, raporlama dostu, güçlü migration |
| CQRS dispatch | MediatR | Handler'ları controller'lardan temiz ayırır |
| Validasyon | FluentValidation | Command nesnelerinde okunabilir validasyon |
| Loglama | Serilog | Yapılandırılmış log, çoklu sink |
| Test | xUnit + FluentAssertions | .NET standardı |
| LLM erişimi | HTTP API (Anthropic SDK) | CLI bağımlılığı yok, üretim dostu |

**V1'den fark**: V1 Node.js/TypeScript + SQLite + Express + React idi. V2 tam rewrite — kod taşınmaz, iş mantığı taşınır.

---

# CrewOps V2 — Target Architecture

## Architectural Style

**Clean Architecture** with **Vertical Feature Slices** inside the Application layer.

Clean Architecture ensures:
- Domain logic has zero dependencies on infrastructure
- Application layer orchestrates use cases
- Infrastructure implements ports defined by the domain and application

Vertical slices ensure:
- Each feature (e.g., `CreateRequest`, `ApproveAgreement`, `StartExecution`) owns its full stack
- No horizontal "god services" that accumulate everything
- Features are independently testable and deployable in isolation

---

## High-Level Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        HUMAN (Browser)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / SignalR
┌──────────────────────────▼──────────────────────────────────────┐
│                    CrewOps.Web (Blazor Server)                   │
│              PM Chat UI · Dashboard · Approval UI               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│                 CrewOps.Api (ASP.NET Core Minimal API)          │
│           Auth · Rate Limiting · Request Validation             │
└──┬──────────────┬──────────────┬──────────────────┬────────────┘
   │              │              │                  │
   ▼              ▼              ▼                  ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐
│ PM Layer │ │Governance│ │ Capabilities │ │  Observability   │
│          │ │  Layer   │ │    Layer     │ │     Layer        │
└────┬─────┘ └────┬─────┘ └──────┬───────┘ └──────────────────┘
     │             │              │
     └──────────┬──┘              │
                ▼                 │
        ┌───────────────┐         │
        │ Orchestration │◄────────┘
        │    Layer      │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │  Execution    │
        │    Layer      │
        └───────┬───────┘
                │ IExecutionWorker
        ┌───────▼───────┐
        │  Agent Worker │
        │  (HTTP API /  │
        │   CLI spawn)  │
        └───────────────┘
                │
                ▼
        ┌───────────────┐
        │  SQL Server   │
        │  (via EF Core)│
        └───────────────┘
```

---

## Project Structure

```
D:/Dev/CrewOps/
├── src/
│   ├── CrewOps.Domain/              → Pure domain model. No framework dependencies.
│   ├── CrewOps.Application/         → Use cases, CQRS handlers, application services.
│   ├── CrewOps.Infrastructure/      → EF Core, SQL Server, HTTP clients, file system.
│   ├── CrewOps.Orchestration/       → Orchestration loop, task graph, DAG scheduler.
│   ├── CrewOps.Capabilities/        → Capability registry, role profiles, skill manifests.
│   ├── CrewOps.Execution/           → Execution runs, workspace, artifact collection.
│   ├── CrewOps.Governance/          → Approval gates, risk engine, release policies.
│   ├── CrewOps.Releases/            → Release requests, deploy records, rollback plans.
│   ├── CrewOps.Observability/       → Audit events, traces, health, metrics.
│   ├── CrewOps.Contracts/           → Shared DTOs, enums, interfaces (no logic).
│   ├── CrewOps.Api/                 → ASP.NET Core Minimal API host.
│   └── CrewOps.Web/                 → Blazor Server UI host.
├── agent-runtime/
│   ├── python/                      → Optional Python sidecar for LLM experimentation.
│   └── scripts/                     → Execution helper scripts.
├── tests/
│   ├── CrewOps.Domain.Tests/        → Pure domain logic unit tests.
│   ├── CrewOps.Application.Tests/   → Use case tests with mocked ports.
│   ├── CrewOps.Orchestration.Tests/ → State machine and loop tests.
│   └── CrewOps.Integration.Tests/   → Full slice tests with real DB.
├── docs/                            → All architecture documents.
│   └── DECISIONS/                   → Architectural decision records.
├── infra/
│   ├── docker/                      → Docker Compose, SQL Server setup.
│   ├── migrations/                  → EF Core migration scripts.
│   └── scripts/                     → Dev setup, seed scripts.
├── templates/
│   ├── capability-packs/            → Built-in capability pack definitions.
│   ├── role-profiles/               → Built-in role profile definitions.
│   └── workflow-bundles/            → Built-in workflow bundle definitions.
└── README.md
```

---

## Layer Responsibilities

### CrewOps.Domain

The heart of the system. Contains:
- **Aggregates**: `Project`, `Task`, `ExecutionRun`, `Agreement`, `ReleaseRequest`
- **Entities**: `RiskItem`, `AcceptanceCriteria`, `ApprovalGate`, `AuditEvent`
- **Value Objects**: `ProjectState`, `TaskStatus`, `ExecutionStatus`, `ModelTier`, `RiskLevel`
- **Domain Events**: `AgreementApproved`, `TaskCompleted`, `ApprovalGateTriggered`, `ProductionDeploymentRequested`
- **State Machine**: `ProjectStateMachine` — owns all valid state transitions
- **Domain Services**: `TaskDecomposer`, `DependencyGraph`, `RiskAssessor`
- **Interfaces (ports)**: `IProjectRepository`, `ITaskRepository`, `IExecutionRunRepository`

No framework dependencies. No SQL. No HTTP. No DI. Pure C# classes and interfaces.

### CrewOps.Application

Orchestrates use cases. Contains:
- **Commands**: `CreateProjectCommand`, `SubmitAgreementCommand`, `ApproveGateCommand`, `StartExecutionRunCommand`
- **Queries**: `GetProjectQuery`, `GetTaskGraphQuery`, `GetAuditHistoryQuery`
- **Handlers**: MediatR handlers for each command/query
- **Application Services**: `PmService`, `OrchestrationService`, `ReleaseService`
- **Ports (interfaces for infrastructure)**: `ILlmClient`, `ICapabilityRegistry`, `IFileStore`

Depends on `CrewOps.Domain` only. No infrastructure references.

### CrewOps.Infrastructure

Implements external concerns. Contains:
- **Persistence**: EF Core `DbContext`, entity configurations, repositories
- **LLM Clients**: `AnthropicHttpClient`, `GeminiHttpClient` implementing `ILlmClient`
- **File Storage**: Workspace file management implementing `IFileStore`
- **Capability Loader**: Reads capability pack definitions from `templates/`
- **Migrations**: EF Core migration history

Depends on `CrewOps.Application` (for ports) and `CrewOps.Domain`.

### CrewOps.Orchestration

The orchestration engine. Contains:
- **OrchestrationLoop**: Processes tasks in DAG order; enforces serial/parallel rules
- **TaskGraphBuilder**: Builds dependency graph from plan
- **TaskDispatcher**: Routes tasks to capability-matched execution workers
- **RetryPolicy**: Defines retry count and backoff per task type
- **StuckTaskDetector**: Monitors in-flight tasks; escalates if stuck

Depends on `CrewOps.Application`, `CrewOps.Domain`.

### CrewOps.Capabilities

The capability system. Contains:
- **CapabilityRegistry**: Central registry of all packs, profiles, bundles
- **RoleProfileLoader**: Loads role profiles from templates
- **SkillManifestLoader**: Loads skill manifests with tier metadata
- **ContextAssembler**: Builds execution context from activated skills
- **WorkflowBundleEngine**: Evaluates and applies workflow bundles

Depends on `CrewOps.Domain`, `CrewOps.Application`.

### CrewOps.Execution

Controls execution runs. Contains:
- **ExecutionRunManager**: Creates, starts, pauses, resumes execution runs
- **WorkspaceManager**: Isolates file system per run; cleans up after completion
- **ArtifactCollector**: Captures output artifacts from worker results
- **WorkerResultNormalizer**: Maps raw LLM output to `TaskObservation`
- **ExecutionCostTracker**: Estimates and records token costs

Depends on `CrewOps.Domain`, `CrewOps.Application`.

### CrewOps.Governance

Enforces governance rules. Contains:
- **ApprovalGateEngine**: Evaluates gate conditions; blocks transitions on non-approval
- **RiskGateEngine**: Checks risk items; requires escalation for HIGH risk
- **ReviewRequirementChecker**: Ensures required reviews are complete before progression
- **ReleaseReadinessEvaluator**: Checks all conditions for staging/production gating
- **ExceptionPolicyEngine**: Handles exceptions to standard gates (with audit trail)
- **RollbackAuthority**: Records rollback plans; validates rollback preconditions

Depends on `CrewOps.Domain`, `CrewOps.Application`.

### CrewOps.Releases

Manages the delivery lifecycle. Contains:
- **ReleaseRequestManager**: Creates and tracks release requests
- **StagingDeployController**: Triggers staging deploys through controlled path
- **ProductionGateEnforcer**: Double-checks all production approval preconditions
- **DeploymentRecordStore**: Immutable deployment records
- **RollbackInitiator**: Triggers rollback and updates state machine

Depends on `CrewOps.Domain`, `CrewOps.Application`, `CrewOps.Governance`.

### CrewOps.Observability

Tracks system health and history. Contains:
- **AuditEventPublisher**: Publishes typed audit events to persistent store
- **ProjectTimeline**: Queryable timeline of all events per project
- **ExecutionTracer**: Captures per-run execution trace
- **HealthCheckProvider**: Reports capability registry, DB, and worker health
- **CapabilityUsageMetrics**: Tracks pack/role usage frequencies

Depends on `CrewOps.Domain`, `CrewOps.Application`.

### CrewOps.Api

Thin HTTP host. Contains:
- Minimal API route registration
- Authentication middleware
- SignalR hub for real-time execution streaming
- No business logic — delegates to `CrewOps.Application`

### CrewOps.Web

Blazor Server UI. Contains:
- PM Chat component
- Project dashboard
- Task graph viewer
- Approval panels
- Run console (live output via SignalR)
- Release governance panels

### CrewOps.Contracts

Shared types with no logic. Contains:
- DTOs for API requests/responses
- Shared enums (`ProjectState`, `TaskStatus`, `ApprovalStatus`, `RiskLevel`)
- Interface contracts for cross-project references

---

## Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Authentication | ASP.NET Core cookie auth or JWT (local-first: no cloud IdP required) |
| Validation | FluentValidation on command objects |
| Error handling | Global middleware; domain exceptions → problem details |
| Logging | Serilog → structured logs to file + SQL |
| Audit trail | Domain events → `AuditEvent` table via event publisher |
| Real-time streaming | SignalR hub on API; Blazor circuit on web |
| Configuration | `appsettings.json` + environment variables; no scattered config files |
| Migrations | EF Core `dotnet ef migrations` |

---

## Data Flow: PM Chat to Execution

```
1. Human types message in PM Chat UI (Blazor)
2. Blazor → API: POST /pm/chat/{projectId}
3. API → PmService.SendMessage()
4. PmService → ILlmClient (Anthropic HTTP) with PM role context
5. LLM response → PmService analyzes for [AGREEMENT_READY] marker
6. If not ready → return partial response to UI
7. If ready → PmService.DraftAgreement() → ProjectStateMachine.Transition(AGREEMENT_DRAFTED)
8. AgreementApproved event → domain event → AuditEvent published
9. Human approves in UI → API: POST /agreements/{id}/approve
10. ApprovalGateEngine validates → ProjectStateMachine.Transition(AGREEMENT_APPROVED)
11. PlannerService decomposes → TaskGraph created → ProjectStateMachine.Transition(PLANNED)
12. OrchestrationLoop.Start() → processes tasks in DAG order
13. TaskDispatcher → selects RoleProfile → ContextAssembler builds context
14. ExecutionRunManager.Create() → WorkspaceManager.Isolate()
15. IExecutionWorker.Execute() → HTTP to Anthropic API with assembled prompt
16. WorkerResultNormalizer → TaskObservation → ArtifactCollector
17. ReviewEngine.Evaluate() → approve/revise/escalate
18. If approved → next task OR OrchestrationLoop.Complete()
19. PmService.ConsolidateSummary() → ProjectStateMachine.Transition(READY_FOR_HUMAN_REVIEW)
20. Human reviews → approves for staging → ApprovalGateEngine → APPROVED_FOR_STAGING
```

---

## Technology Decisions (Rationale)

| Technology | Decision | Why |
|---|---|---|
| Blazor Server | UI framework | C# components, no JavaScript build pipeline, real-time via SignalR circuit |
| Minimal API | HTTP layer | No MVC overhead; route-per-feature is cleaner |
| MediatR | CQRS dispatch | Decouples handlers from controllers cleanly |
| EF Core | ORM | .NET native, strong migration support, LINQ query safety |
| SQL Server | Database | Production-grade, reporting-friendly, JSON column support for semi-structured data |
| SignalR | Real-time | Replaces SSE; .NET native, supports reconnect, group messaging |
| Serilog | Logging | Structured logging to multiple sinks (file, SQL, Seq) |
| xUnit | Testing | .NET standard, parallel execution |
| FluentAssertions | Test assertions | Readable, domain-friendly assertions |

---

## What V1 Code Is NOT Migrated

The V1 TypeScript codebase (apps/, packages/) is **not migrated** to V2. It served as a proof of concept. V2 is a clean rebuild in .NET 10.

The following V1 concepts are **preserved as domain concepts** in V2:
- PM chat flow and mutabakat marker pattern
- Agent role types (pm, architect, backend, frontend, sql, qa, devops)
- Sequential DAG execution with retry
- Review gate (approve/revise/escalate)
- Three-file memory model (→ replaced by DB in V2)
- Output contract (5-section format → normalized by `WorkerResultNormalizer`)

The V1 `agents-main/` plugin marketplace is **preserved as a reference** for `CapabilityRegistry` seeding. V2 will load role profiles from those agent markdown files where appropriate.
