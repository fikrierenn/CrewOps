# CrewOps V2 — Çekirdek Modüller Haritası

> **Dil notu**: Modül adları, sınıf isimleri, namespace'ler İngilizce; açıklamalar Türkçe.

## Özet (Türkçe)

Bu belge, CrewOps V2 sistemindeki her modülün sorumluluğunu, birincil domain kavramlarını ve bağımlılıklarını kayıt altına alır. Yeni bir kavram veya özelliğin hangi modüle ait olduğuna karar verirken bu belgeye başvur.

**Altın kural**: `CrewOps.Domain` hiçbir şeye bağlı değildir. `CrewOps.Infrastructure` port interface'leri implement eder. `CrewOps.Api` ve `CrewOps.Web` hiçbir zaman birbirinden bağımsız modüllere eklenmez.

---

This document maps every module in the CrewOps V2 system, its responsibility, its primary domain concepts, and its dependencies. Use this as the authoritative guide when deciding where a new concept or feature belongs.

---

## Module Dependency Rules

```
CrewOps.Contracts        → depends on nothing
CrewOps.Domain           → depends on nothing (no framework, no ORM)
CrewOps.Application      → depends on Domain, Contracts
CrewOps.Infrastructure   → depends on Application, Domain (implements ports)
CrewOps.Orchestration    → depends on Application, Domain
CrewOps.Capabilities     → depends on Application, Domain
CrewOps.Execution        → depends on Application, Domain, Capabilities
CrewOps.Governance       → depends on Application, Domain
CrewOps.Releases         → depends on Application, Domain, Governance
CrewOps.Observability    → depends on Application, Domain
CrewOps.Api              → depends on Application, Contracts (no direct Domain)
CrewOps.Web              → depends on Contracts, Api (via HTTP)
```

No module may depend on `CrewOps.Api` or `CrewOps.Web`.
No module except `CrewOps.Infrastructure` may depend on EF Core.

---

## CrewOps.Domain

**Role:** Pure domain model. Zero external dependencies. The source of truth for all business rules.

### Aggregates

| Aggregate | Responsibility |
|---|---|
| `Project` | Root of the delivery lifecycle. Owns `ProjectState`, `Agreement`, `Plan`, `RiskItems`. |
| `Agreement` | Scope statement, acceptance criteria, risk items, out-of-scope list. Immutable once approved. |
| `Plan` | Task graph produced from Agreement. Owns `Task[]` and `DependencyGraph`. |
| `Task` | A unit of work with role assignment, status, and execution history. |
| `ExecutionRun` | A single attempt to execute a `Task`. Owns status, log, artifacts, cost. |
| `ReleaseRequest` | Request to deploy to staging or production. Owns approval history and rollback plan. |

### Value Objects

| Value Object | Values |
|---|---|
| `ProjectState` | `NEW`, `DISCOVERY`, `NEEDS_CLARIFICATION`, `AGREEMENT_DRAFTED`, `AGREEMENT_APPROVED`, `PLANNED`, `TASKS_CREATED`, `CAPABILITIES_ASSIGNED`, `IN_EXECUTION`, `IN_QA`, `IN_REVIEW`, `READY_FOR_PM_SUMMARY`, `READY_FOR_HUMAN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED_FOR_STAGING`, `STAGING_DEPLOYED`, `UAT_PASSED`, `APPROVED_FOR_PRODUCTION`, `PRODUCTION_DEPLOYED`, `OBSERVING`, `COMPLETED`, `ROLLBACK_REQUIRED`, `ROLLED_BACK`, `FAILED` |
| `TaskStatus` | `Pending`, `Queued`, `InProgress`, `AwaitingReview`, `Approved`, `Revised`, `Escalated`, `Completed`, `Failed`, `Skipped` |
| `ExecutionStatus` | `Created`, `Running`, `Paused`, `Completed`, `Failed`, `TimedOut`, `Cancelled` |
| `ApprovalStatus` | `AwaitingApproval`, `Approved`, `RevisedWithFeedback`, `Rejected`, `EscalatedToHuman` |
| `RiskLevel` | `Low`, `Medium`, `High`, `Critical` |
| `ModelTier` | `Critical` (Opus), `Standard` (Sonnet), `Operational` (Haiku) |
| `TaskComplexity` | `Trivial`, `Small`, `Medium`, `Large`, `Epic` |

### Entities

| Entity | Responsibility |
|---|---|
| `AcceptanceCriteria` | Measurable condition that must be met for Agreement acceptance. |
| `RiskItem` | Identified risk with level, mitigation, and resolution status. |
| `TaskDependency` | Directed edge in the task graph (`Task → depends on → Task`). |
| `ApprovalGate` | A governance gate with its type, required approver, status, and audit timestamp. |
| `AuditEvent` | Immutable record of every state change, approval, and deployment event. |
| `DeploymentRecord` | Immutable record of a staging or production deployment. |
| `RollbackPlan` | Pre-approved steps to revert a deployment. Must exist before production deploy. |

### Domain Services

| Service | Responsibility |
|---|---|
| `ProjectStateMachine` | Validates and executes state transitions. Only source of truth for allowed transitions. |
| `TaskDecomposer` | Converts a `Plan` narrative into a structured `Task[]` with dependency hints. |
| `DependencyGraph` | Validates acyclicity; provides topological sort; reports eligible tasks. |
| `RiskAssessor` | Evaluates task and agreement risk against `RiskLevel` thresholds. |
| `AgreementValidator` | Checks agreement completeness before allowing `AGREEMENT_DRAFTED` state. |

### Domain Events

| Event | Trigger |
|---|---|
| `ProjectCreated` | New project registered |
| `AgreementDrafted` | PM produced agreement |
| `AgreementApproved` | Human approved agreement |
| `PlanProduced` | Task decomposition complete |
| `PlanApproved` | Human approved plan |
| `ExecutionStarted` | Orchestration loop started |
| `TaskCompleted` | A task's execution run approved |
| `TaskFailed` | A task's execution run failed with no retry |
| `TaskEscalated` | A task escalated to human decision |
| `QaCompleted` | QA run finished |
| `ReviewCompleted` | PM review cycle finished |
| `HumanApprovedForStaging` | Human approved staging deployment |
| `ProductionDeploymentApproved` | Human approved production deployment |
| `DeploymentSucceeded` | Deployment record created |
| `RollbackTriggered` | Rollback initiated |
| `ProjectCompleted` | Terminal success state reached |
| `ProjectFailed` | Terminal failure state reached |
| `InvalidTransitionAttempted` | Invalid state transition rejected |

---

## CrewOps.Application

**Role:** Use case orchestration. Coordinates domain objects via repository ports and external service ports. No infrastructure knowledge.

### Feature Slices

Each slice contains: `Command` + `CommandHandler` + `Query` + `QueryHandler` + any feature-specific services.

| Feature Slice | Commands / Queries |
|---|---|
| `Projects` | `CreateProject`, `GetProject`, `ListProjects`, `UpdateProjectSettings` |
| `PmChat` | `SendPmMessage`, `GetConversationHistory`, `DraftAgreement` |
| `Agreements` | `SubmitAgreement`, `ApproveAgreement`, `RejectAgreement`, `GetAgreement` |
| `Planning` | `GeneratePlan`, `ApprovePlan`, `RejectPlan`, `GetPlan` |
| `Tasks` | `CreateTasks`, `GetTask`, `ListTasks`, `UpdateTaskStatus`, `AssignCapabilities` |
| `Execution` | `StartExecutionRun`, `PauseExecution`, `ResumeExecution`, `GetRunStatus`, `GetRunLog` |
| `Review` | `SubmitReview`, `GetReviewReport`, `EscalateTask` |
| `Governance` | `EvaluateApprovalGate`, `GetApprovalGateStatus`, `OverrideGate` (privileged) |
| `Releases` | `CreateReleaseRequest`, `ApproveStaging`, `ApproveProd`, `GetReleaseStatus` |
| `Rollback` | `InitiateRollback`, `ConfirmRollback`, `GetRollbackPlan` |
| `Observability` | `GetProjectTimeline`, `GetAuditHistory`, `GetHealthStatus` |

### Application Ports (Interfaces)

| Port | Implemented By |
|---|---|
| `ILlmClient` | `AnthropicHttpClient`, `GeminiHttpClient` in Infrastructure |
| `IProjectRepository` | EF Core repository in Infrastructure |
| `ITaskRepository` | EF Core repository in Infrastructure |
| `IExecutionRunRepository` | EF Core repository in Infrastructure |
| `IAuditEventRepository` | EF Core repository in Infrastructure |
| `ICapabilityRegistry` | `CapabilityRegistryService` in Capabilities |
| `IExecutionWorker` | `ClaudeApiWorker`, `GeminiApiWorker` in Execution |
| `IFileStore` | `LocalFileStore` in Infrastructure |
| `INotificationService` | SignalR hub adapter in Api |

---

## CrewOps.Infrastructure

**Role:** Implements all ports defined in Application. Owns EF Core, SQL Server, HTTP clients, file system.

### Sub-components

| Component | Responsibility |
|---|---|
| `CrewOpsDbContext` | EF Core context; all entity configurations |
| `ProjectRepository` | CRUD for `Project` aggregate |
| `TaskRepository` | CRUD + queries for `Task` |
| `ExecutionRunRepository` | CRUD for `ExecutionRun` + artifact retrieval |
| `AuditEventRepository` | Append-only writes; queryable by project/type/time |
| `AnthropicHttpClient` | HTTP client for Anthropic API; implements `ILlmClient` |
| `GeminiHttpClient` | HTTP client for Gemini API; implements `ILlmClient` |
| `LocalFileStore` | Workspace file management; implements `IFileStore` |
| `CapabilityPackLoader` | Reads pack definitions from `templates/`; seeds `CapabilityRegistry` |
| `Migrations/` | EF Core migration history |

### Database Tables

| Table | Purpose |
|---|---|
| `Projects` | Project metadata, current state, timestamps |
| `Agreements` | Agreement content, approval status, approver ID |
| `AcceptanceCriteria` | Per-agreement criteria |
| `RiskItems` | Per-agreement or per-task risks |
| `Plans` | Plan content, approval status |
| `Tasks` | Task metadata, status, role assignment, dependency JSON |
| `TaskDependencies` | Explicit edges (taskId → dependsOnTaskId) |
| `ExecutionRuns` | Run metadata, status, cost, model used |
| `ExecutionArtifacts` | Output artifacts (kind, content, file path) |
| `ReviewReports` | Per-task review decisions and feedback |
| `ApprovalGates` | Gate type, required state, status, approver, timestamp |
| `ReleaseRequests` | Staging/production release records |
| `DeploymentRecords` | Immutable deployment records |
| `RollbackPlans` | Rollback steps, owner, pre-approved flag |
| `RollbackRecords` | Immutable rollback execution records |
| `AuditEvents` | All domain events (type, payload JSON, actor, timestamp) |
| `PmConversations` | PM chat messages (role, content, timestamp) |
| `CapabilityPacks` | Registered capability packs (name, version, schema JSON) |
| `RoleProfiles` | Role profile definitions (domain, modelTier, skills JSON) |

---

## CrewOps.Orchestration

**Role:** Drives task execution in dependency order. Manages concurrency, retry, and escalation.

### Components

| Component | Responsibility |
|---|---|
| `OrchestrationLoop` | Main loop: fetch eligible tasks, dispatch, collect results, repeat |
| `TaskGraphBuilder` | Converts `Task[]` + `TaskDependency[]` into traversable DAG |
| `EligibleTaskSelector` | Returns tasks whose dependencies are all `Completed` |
| `TaskDispatcher` | Selects `RoleProfile` + `CapabilityPack` for task; creates `ExecutionRun` |
| `RetryPolicy` | Per-task retry rules: max attempts, backoff strategy |
| `StuckTaskDetector` | Monitors `IN_EXECUTION` tasks for timeout; escalates to human if stuck |
| `ParallelExecutor` | (Phase 5+) Dispatches multiple eligible tasks concurrently |

### Key Behaviors

- Default mode: **serial** — one task at a time; simpler state management
- Parallel mode: **opt-in per project** — eligible tasks dispatched concurrently; results merged
- Retry: configurable per task complexity; exponential backoff
- Escalation: if task fails after max retries, status = `Escalated`; `TaskEscalated` domain event published; human must decide

---

## CrewOps.Capabilities

**Role:** Manages the capability system — packs, profiles, skills, context assembly.

### Components

| Component | Responsibility |
|---|---|
| `CapabilityRegistry` | Central store of all installed packs, profiles, bundles; queryable by domain, tag, version |
| `RoleProfileLoader` | Loads `RoleProfile` definitions from `templates/role-profiles/` |
| `CapabilityPackLoader` | Loads `CapabilityPack` definitions from `templates/capability-packs/` |
| `SkillManifestLoader` | Parses SKILL.md files; extracts metadata, instructions, resources at each disclosure tier |
| `ContextAssembler` | Builds prompt context for execution run from role profile + activated skills |
| `ContextBudgetEnforcer` | Enforces token budget; triggers progressive disclosure decisions |
| `WorkflowBundleEngine` | Evaluates `ContextRule[]` and activates `WorkflowBundle` steps as applicable |
| `TechStackDetector` | Infers tech stack from project metadata; suggests relevant capability packs |
| `ProjectBootstrapPackSelector` | Returns recommended bootstrap pack based on project type and detected stack |

---

## CrewOps.Execution

**Role:** Creates, manages, and closes execution runs. Owns workspace isolation and artifact collection.

### Components

| Component | Responsibility |
|---|---|
| `ExecutionRunManager` | Lifecycle: Create → Start → Pause → Resume → Complete/Fail |
| `WorkspaceManager` | Isolates file system per run under `workspace/{runId}/`; cleans up after completion |
| `ArtifactCollector` | Parses raw worker output; extracts typed artifacts (code, patch, test results, logs) |
| `WorkerResultNormalizer` | Maps raw LLM response to `TaskObservation` domain contract |
| `ExecutionCostTracker` | Records estimated token counts and cost per run |
| `ClaudeApiWorker` | `IExecutionWorker` impl: calls Anthropic API with assembled context |
| `GeminiApiWorker` | `IExecutionWorker` impl: calls Gemini API |
| `WorkerHealthMonitor` | Checks worker availability; reports status to health subsystem |

---

## CrewOps.Governance

**Role:** Enforces all approval gates, risk gates, and release policies. Never bypassed.

### Components

| Component | Responsibility |
|---|---|
| `ApprovalGateEngine` | Evaluates gate conditions; blocks state transitions until gate is satisfied |
| `RiskGateEngine` | Checks `RiskItem[]` levels; requires human escalation for `High`/`Critical` items |
| `ReviewRequirementChecker` | Ensures required reviews (QA, PM, human) are complete before state advance |
| `ReleaseReadinessEvaluator` | Pre-checks all conditions for staging and production gates |
| `ExceptionPolicyEngine` | Handles approved exceptions to standard gates; full audit trail required |
| `RollbackAuthority` | Validates rollback preconditions; prevents rollback without existing plan |
| `DestructiveCommandGuard` | Blocks destructive actions (drop table, rm -rf, etc.) from reaching execution |
| `PromptInjectionGuard` | Detects and flags suspicious content in worker output artifacts |

---

## CrewOps.Releases

**Role:** Manages the release lifecycle from release request to post-deploy observation.

### Components

| Component | Responsibility |
|---|---|
| `ReleaseRequestManager` | Creates and tracks release requests for staging and production |
| `StagingDeployController` | Triggers staging deployment through `IDeploymentProvider` |
| `ProductionGateEnforcer` | Double-checks all production gate conditions before triggering deploy |
| `DeploymentRecordStore` | Writes immutable `DeploymentRecord` on every deploy |
| `ObservationWindowManager` | Tracks observation window duration; triggers `COMPLETED` or `ROLLBACK_REQUIRED` |
| `RollbackInitiator` | Executes rollback steps from `RollbackPlan`; records `RollbackRecord` |
| `IDeploymentProvider` | Port for actual deploy mechanism (CI/CD trigger, script, manual) |

---

## CrewOps.Observability

**Role:** Provides full visibility into system state, history, and health.

### Components

| Component | Responsibility |
|---|---|
| `AuditEventPublisher` | Writes `AuditEvent` records on every domain event |
| `ProjectTimeline` | Queryable timeline: all events for a project in chronological order |
| `ExecutionTracer` | Per-run execution trace: task steps, prompt sent, response received, elapsed |
| `ApprovalHistoryQuery` | Returns all approval decisions for a project |
| `HealthCheckProvider` | Aggregates: DB connectivity, LLM client status, capability registry status, worker health |
| `CapabilityUsageMetrics` | Tracks pack/profile/skill usage frequencies; helps identify unused or overloaded packs |
| `RunHistoryQuery` | Returns paginated run history with status and cost summary |

---

## CrewOps.Api

**Role:** Thin HTTP host. Maps HTTP routes to Application commands/queries. No business logic.

### Hubs

| Hub | Purpose |
|---|---|
| `ExecutionHub` (SignalR) | Streams real-time execution run output to connected clients |
| `ApprovalHub` (SignalR) | Notifies human of pending approvals requiring action |

### Route Groups

| Group | Routes |
|---|---|
| `/projects` | CRUD + state queries |
| `/pm` | Chat, agreement draft, conversation history |
| `/agreements` | Approve, reject, get |
| `/plans` | Generate, approve, get |
| `/tasks` | CRUD, assignment, status |
| `/runs` | Start, pause, resume, status, log stream |
| `/governance` | Gate status, gate override |
| `/releases` | Create, approve staging, approve prod, rollback |
| `/capabilities` | Registry query, pack list, profile list |
| `/observability` | Timeline, audit, health, metrics |

---

## CrewOps.Web

**Role:** Blazor Server UI. All pages render server-side; real-time updates via SignalR circuit.

### Pages

| Page | Purpose |
|---|---|
| `Dashboard` | Project overview: active projects, pending approvals, system health |
| `ProjectDetail` | State, timeline, current task graph, PM summary |
| `PmChat` | Conversational PM interface; shows agreement draft when ready |
| `AgreementReview` | Human reviews agreement; approve/reject |
| `PlanReview` | Human reviews task graph; approve/reject |
| `Execution` | Live execution console; task statuses; artifact preview |
| `ReviewPanel` | Review reports per task; human override available |
| `ReleaseGovern` | Staging and production approval; deployment records |
| `AuditLog` | Searchable, paginated audit event log |
| `Capabilities` | Browse capability registry; view pack details |
| `Settings` | LLM provider config, governance policy settings |
