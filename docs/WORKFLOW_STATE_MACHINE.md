# CrewOps V2 — İş Akışı State Machine

> **Dil notu**: Teknik terimler (state adları, sınıf isimleri, enum değerleri) İngilizce; açıklamalar Türkçe.

## Özet (Türkçe)

`ProjectStateMachine`, bir projenin teslimat yaşam döngüsündeki konumunun yetkili kaydıdır. Tüm state geçişleri doğrulanır, `AuditEvent` kaydı olarak loglanır ve domain katmanı tarafından zorlanır. Hiçbir üst veya alt katman state machine'i atlayamaz.

**V1'den fark**: V1'de `ProjectPhase` düz string union'dı ve geçişler koda dağılmıştı. V2'de `ProjectStateMachine` tek yetkili geçiş noktasıdır. Geçersiz geçiş denenirse `InvalidTransitionException` fırlatılır.

### V1 → V2 Phase Eşleştirmesi

| V1 `ProjectPhase` | V2 `ProjectState` |
|-------------------|------------------|
| `mutabakat_bekliyor` | `NEW` → `DISCOVERY` |
| `mutabakat_devam` | `NEEDS_CLARIFICATION` |
| `mutabakat_tamamlandi` | `AGREEMENT_DRAFTED` → `AGREEMENT_APPROVED` |
| `planlama` | `PLANNED` → `TASKS_CREATED` → `CAPABILITIES_ASSIGNED` |
| `gelistirme` | `IN_EXECUTION` → `IN_QA` → `IN_REVIEW` |
| `review` | `READY_FOR_PM_SUMMARY` → `READY_FOR_HUMAN_REVIEW` |
| `teslim_edildi` | `APPROVED_FOR_STAGING` → ... → `COMPLETED` |

---

The `ProjectStateMachine` is the authoritative record of where a project stands in the delivery lifecycle. All state transitions are validated, logged as `AuditEvent` records, and enforced by the domain layer. No layer above or below may bypass the state machine.

---

## State Diagram (Simplified)

```
NEW
 └─► DISCOVERY
      └─► NEEDS_CLARIFICATION ◄──────────────────────────────┐
           └─► AGREEMENT_DRAFTED                              │
                └─► AGREEMENT_APPROVED                        │
                     └─► PLANNED                              │
                          └─► TASKS_CREATED                   │
                               └─► CAPABILITIES_ASSIGNED      │
                                    └─► IN_EXECUTION          │
                                         ├─► IN_QA            │
                                         │    └─► IN_REVIEW   │
                                         │         ├──────────┘ (CHANGES_REQUESTED → back)
                                         │         └─► READY_FOR_PM_SUMMARY
                                         │              └─► READY_FOR_HUMAN_REVIEW
                                         │                   ├──────────────────────────┐
                                         │                   │                          ▼
                                         │                   └─► APPROVED_FOR_STAGING  CHANGES_REQUESTED
                                         │                        └─► STAGING_DEPLOYED
                                         │                             └─► UAT_PASSED
                                         │                                  └─► APPROVED_FOR_PRODUCTION
                                         │                                       └─► PRODUCTION_DEPLOYED
                                         │                                            └─► OBSERVING
                                         │                                                 └─► COMPLETED
                                         │
                                         ├─► FAILED
                                         └─► ROLLBACK_REQUIRED
                                              └─► ROLLED_BACK
```

---

## State Definitions

### NEW

**Purpose:** Project record created but intake not yet started.

**Entry Criteria:** Project creation command accepted.

**Exit Criteria:** PM session initialized.

**Allowed Transitions:** → `DISCOVERY`

**Required Artifacts:** Project name, initial request text.

**Human Approval:** None required.

**Audit Events:** `ProjectCreated`

**Rollback:** N/A (no execution has occurred).

---

### DISCOVERY

**Purpose:** PM actively gathering information from human. Requirements are being explored. No commitments made.

**Entry Criteria:** PM session started; initial request received.

**Exit Criteria:** PM has enough information to draft an agreement OR needs to send clarification questions.

**Allowed Transitions:** → `NEEDS_CLARIFICATION`, → `AGREEMENT_DRAFTED`

**Required Artifacts:** PM conversation transcript.

**Human Approval:** None required (ongoing conversation).

**Audit Events:** `DiscoveryStarted`, `PmMessageSent`, `HumanMessageReceived`

**Rollback:** No execution occurred; can be abandoned freely.

---

### NEEDS_CLARIFICATION

**Purpose:** PM has identified gaps or ambiguities that must be resolved before drafting an agreement.

**Entry Criteria:** PM identified at least one unresolved question or risk item.

**Exit Criteria:** Human has answered all clarification questions.

**Allowed Transitions:** → `DISCOVERY` (continue conversation), → `AGREEMENT_DRAFTED` (sufficient clarity reached)

**Required Artifacts:** List of clarification questions, human responses.

**Human Approval:** None required (conversation continues).

**Audit Events:** `ClarificationRequested`, `ClarificationAnswered`

**Rollback:** No execution occurred; can be abandoned freely.

---

### AGREEMENT_DRAFTED

**Purpose:** PM has produced a mutual agreement document capturing scope, acceptance criteria, risks, and assumptions. Waiting for human approval.

**Entry Criteria:** PM has produced a complete agreement including: scope statement, acceptance criteria (≥1), risk items, and out-of-scope items.

**Exit Criteria:** Human approves or rejects the agreement.

**Allowed Transitions:** → `AGREEMENT_APPROVED` (human approves), → `NEEDS_CLARIFICATION` (human rejects or requests changes)

**Required Artifacts:** `Agreement` record with scope, `AcceptanceCriteria[]`, `RiskItem[]`, out-of-scope list.

**Human Approval:** **REQUIRED.** Human must explicitly approve the agreement.

**Audit Events:** `AgreementDrafted`, `AgreementApproved`, `AgreementRejected`

**Rollback:** No execution occurred; restart conversation if rejected.

---

### AGREEMENT_APPROVED

**Purpose:** Human has approved the agreement. System preparing to produce a plan.

**Entry Criteria:** Agreement approval recorded with human identity and timestamp.

**Exit Criteria:** Planning complete.

**Allowed Transitions:** → `PLANNED`

**Required Artifacts:** Signed `Agreement` record (approver ID, approved timestamp).

**Human Approval:** Already given (in previous state).

**Audit Events:** `PlanningStarted`

**Rollback:** No execution occurred; can reopen agreement if planning fails.

---

### PLANNED

**Purpose:** PM has decomposed the agreement into a structured task plan with dependencies.

**Entry Criteria:** At least one task produced; all tasks have role assignments and dependency declarations.

**Exit Criteria:** Task graph persisted to database.

**Allowed Transitions:** → `TASKS_CREATED`

**Required Artifacts:** `Plan` record, `Task[]` with dependency graph.

**Human Approval:** Plan requires human review before execution starts. **APPROVAL GATE: PlanApprovalGate**

**Audit Events:** `PlanProduced`, `PlanApproved`, `PlanRejected`

**Rollback:** Return to `AGREEMENT_APPROVED` for re-planning.

---

### TASKS_CREATED

**Purpose:** Task graph is persisted and ready for capability assignment.

**Entry Criteria:** All tasks created in database; dependency graph validated (no cycles).

**Exit Criteria:** Capability packs and role profiles assigned to all tasks.

**Allowed Transitions:** → `CAPABILITIES_ASSIGNED`

**Required Artifacts:** `Task[]` with status `Pending`, validated `DependencyGraph`.

**Human Approval:** None required (automated assignment; human can override).

**Audit Events:** `TasksCreated`, `DependencyGraphValidated`

**Rollback:** Tasks can be recreated from Plan if needed.

---

### CAPABILITIES_ASSIGNED

**Purpose:** Each task has been matched to a `RoleProfile` and `CapabilityPack`. Execution context is ready to be assembled.

**Entry Criteria:** All tasks have role and capability assignments.

**Exit Criteria:** Human approves start of execution.

**Allowed Transitions:** → `IN_EXECUTION`

**Required Artifacts:** Task-to-role assignments, capability pack selections.

**Human Approval:** **REQUIRED.** Human must approve execution start. **APPROVAL GATE: ExecutionStartGate**

**Audit Events:** `CapabilitiesAssigned`, `ExecutionStartApproved`

**Rollback:** Reassign capabilities if assignments are wrong.

---

### IN_EXECUTION

**Purpose:** Orchestration loop is running tasks in DAG order. Specialists are producing output.

**Entry Criteria:** Execution start approved; `OrchestrationLoop` active.

**Exit Criteria:** All tasks complete (success/failure/escalated) OR execution halted by error/human.

**Allowed Transitions:** → `IN_QA`, → `FAILED`, → `ROLLBACK_REQUIRED`

**Required Artifacts:** `ExecutionRun[]`, `ArtifactCollector` records per completed task.

**Human Approval:** None required during normal execution. Escalated tasks require human decision.

**Audit Events:** `ExecutionRunStarted`, `TaskCompleted`, `TaskFailed`, `TaskEscalated`, `ExecutionRunCompleted`

**Rollback:** Execution can be paused; patches not yet applied are reversible; applied patches require rollback plan.

---

### IN_QA

**Purpose:** QA specialist validating outputs: tests written and executed, acceptance criteria checked.

**Entry Criteria:** All execution tasks completed successfully.

**Exit Criteria:** QA run complete (passed or failed).

**Allowed Transitions:** → `IN_REVIEW` (QA passed), → `IN_EXECUTION` (QA found issues; specific tasks re-run)

**Required Artifacts:** `QaReport` with test results and acceptance criteria mapping.

**Human Approval:** None required for QA execution. Human sees QA results in review.

**Audit Events:** `QaRunStarted`, `QaRunCompleted`, `QaFailed`

**Rollback:** Return to `IN_EXECUTION` for specific task re-runs.

---

### IN_REVIEW

**Purpose:** PM reviewing all outputs against agreement. Producing a decision-ready summary.

**Entry Criteria:** QA passed.

**Exit Criteria:** PM approves outputs or requests changes.

**Allowed Transitions:** → `READY_FOR_PM_SUMMARY` (PM approves), → `NEEDS_CLARIFICATION` (major scope issue found), → `IN_EXECUTION` (minor revisions requested)

**Required Artifacts:** `ReviewReport` per task (APPROVED / REVISED / ESCALATED), PM notes.

**Human Approval:** None required at this stage (PM automated review). Human sees results in next state.

**Audit Events:** `ReviewStarted`, `TaskReviewDecisionMade`, `ReviewCompleted`

**Rollback:** Return to `IN_EXECUTION` if revisions requested.

---

### READY_FOR_PM_SUMMARY

**Purpose:** PM is consolidating all review decisions into a single human-readable summary.

**Entry Criteria:** All task reviews complete; all APPROVED.

**Exit Criteria:** PM summary produced.

**Allowed Transitions:** → `READY_FOR_HUMAN_REVIEW`

**Required Artifacts:** `PmConsolidatedSummary` — changes made, risks resolved, outstanding items, recommendation.

**Human Approval:** None required (PM summary is automated).

**Audit Events:** `PmSummaryProduced`

**Rollback:** N/A.

---

### READY_FOR_HUMAN_REVIEW

**Purpose:** Human reviews PM summary and decides whether to approve for staging or request changes.

**Entry Criteria:** PM consolidated summary available.

**Exit Criteria:** Human approves for staging OR requests changes.

**Allowed Transitions:** → `APPROVED_FOR_STAGING`, → `CHANGES_REQUESTED`

**Required Artifacts:** PM summary, QA report, review report.

**Human Approval:** **REQUIRED.** Human explicitly approves for staging. **APPROVAL GATE: StagingApprovalGate**

**Audit Events:** `HumanReviewStarted`, `HumanApprovedForStaging`, `ChangesRequested`

**Rollback:** Return to `NEEDS_CLARIFICATION` or `IN_EXECUTION` based on change scope.

---

### CHANGES_REQUESTED

**Purpose:** Human has requested changes after review. System determining scope and routing to correct state.

**Entry Criteria:** Human submitted change request with description.

**Exit Criteria:** Change scope assessed; routed to appropriate state.

**Allowed Transitions:** → `IN_EXECUTION` (code changes), → `PLANNED` (re-planning required), → `NEEDS_CLARIFICATION` (scope change)

**Required Artifacts:** `ChangeRequest` record with description, scope assessment.

**Human Approval:** None required (routing is automated; human already gave instruction).

**Audit Events:** `ChangeScopeAssessed`, `RerouteDecided`

**Rollback:** Depends on target state.

---

### APPROVED_FOR_STAGING

**Purpose:** Human has approved deployment to staging environment.

**Entry Criteria:** Staging approval gate passed; rollback plan for staging exists.

**Exit Criteria:** Staging deployment initiated.

**Allowed Transitions:** → `STAGING_DEPLOYED`

**Required Artifacts:** Staging rollback plan, deployment configuration.

**Human Approval:** Already given (in `READY_FOR_HUMAN_REVIEW`).

**Audit Events:** `StagingDeploymentInitiated`

**Rollback:** Staging rollback plan is pre-defined; can trigger automatically or manually.

---

### STAGING_DEPLOYED

**Purpose:** Code is running in staging environment. UAT or automated validation in progress.

**Entry Criteria:** Staging deployment succeeded; deployment record created.

**Exit Criteria:** UAT passed or failed.

**Allowed Transitions:** → `UAT_PASSED`, → `ROLLBACK_REQUIRED`

**Required Artifacts:** `DeploymentRecord` (staging), UAT results or automated test report.

**Human Approval:** None required during staging validation.

**Audit Events:** `StagingDeploymentSucceeded`, `StagingDeploymentFailed`, `UatStarted`

**Rollback:** Trigger staging rollback; return to `APPROVED_FOR_STAGING` after fix.

---

### UAT_PASSED

**Purpose:** Staging validation passed. Awaiting production approval.

**Entry Criteria:** UAT results recorded and passed.

**Exit Criteria:** Human approves production deployment.

**Allowed Transitions:** → `APPROVED_FOR_PRODUCTION`

**Required Artifacts:** UAT report, observation period results.

**Human Approval:** **REQUIRED.** Human explicitly approves production deployment. **APPROVAL GATE: ProductionApprovalGate**

**Audit Events:** `UatPassed`, `ProductionApprovalRequested`, `ProductionApprovalGranted`

**Rollback:** If production approval denied, return to `STAGING_DEPLOYED` for further validation.

---

### APPROVED_FOR_PRODUCTION

**Purpose:** Human has granted production deployment approval. Rollback plan confirmed.

**Entry Criteria:** Production approval gate passed; production rollback plan exists and is reviewed.

**Exit Criteria:** Production deployment initiated.

**Allowed Transitions:** → `PRODUCTION_DEPLOYED`

**Required Artifacts:** Production rollback plan, deployment checklist, approver identity + timestamp.

**Human Approval:** Already given.

**Audit Events:** `ProductionDeploymentInitiated`

**Rollback:** Production rollback plan is pre-defined and human-reviewed before this state is reached.

---

### PRODUCTION_DEPLOYED

**Purpose:** Code is live in production. Observation period begins.

**Entry Criteria:** Production deployment succeeded; immutable `DeploymentRecord` created.

**Exit Criteria:** Observation period ends (success) OR incident detected (rollback required).

**Allowed Transitions:** → `OBSERVING`, → `ROLLBACK_REQUIRED`

**Required Artifacts:** Immutable `DeploymentRecord` (production), monitoring signals.

**Human Approval:** None required during observation.

**Audit Events:** `ProductionDeploymentSucceeded`, `ProductionDeploymentFailed`

**Rollback:** Trigger production rollback; create `RollbackRecord`.

---

### OBSERVING

**Purpose:** Post-deployment monitoring. System watching for anomalies.

**Entry Criteria:** Production deployment succeeded; observation window started.

**Exit Criteria:** Observation window passed without incident OR human closes observation.

**Allowed Transitions:** → `COMPLETED`, → `ROLLBACK_REQUIRED`

**Required Artifacts:** Observation window start/end timestamps, anomaly records (if any).

**Human Approval:** Human can close observation early.

**Audit Events:** `ObservationStarted`, `ObservationCompleted`, `AnomalyDetected`

**Rollback:** Trigger production rollback if anomaly detected.

---

### COMPLETED

**Purpose:** Project successfully delivered to production and observation passed.

**Entry Criteria:** Observation window ended with no unresolved incidents.

**Exit Criteria:** Terminal state.

**Allowed Transitions:** None (terminal).

**Required Artifacts:** Complete project record, final `DeploymentRecord`, audit history.

**Human Approval:** None required.

**Audit Events:** `ProjectCompleted`

**Rollback:** N/A — production is stable; any future changes start a new project or request.

---

### ROLLBACK_REQUIRED

**Purpose:** An incident or failure has been detected requiring rollback.

**Entry Criteria:** Rollback triggered (automated anomaly detection OR human decision) from `STAGING_DEPLOYED`, `PRODUCTION_DEPLOYED`, or `OBSERVING`.

**Exit Criteria:** Rollback executed.

**Allowed Transitions:** → `ROLLED_BACK`

**Required Artifacts:** `RollbackPlan` (must exist before reaching this state), incident record.

**Human Approval:** **REQUIRED** for production rollback. Staging rollback may be automated.

**Audit Events:** `RollbackRequired`, `RollbackApproved`

---

### ROLLED_BACK

**Purpose:** Rollback successfully completed. System is back to previous stable state.

**Entry Criteria:** Rollback executed; previous stable state confirmed.

**Exit Criteria:** Human decides next action.

**Allowed Transitions:** → `IN_EXECUTION` (fix and retry), → `FAILED` (abandon)

**Required Artifacts:** `RollbackRecord` with timestamp, scope, and confirming human.

**Human Approval:** Human decides whether to fix or abandon.

**Audit Events:** `RollbackCompleted`, `StableStateConfirmed`

---

### FAILED

**Purpose:** Project has failed and will not be retried.

**Entry Criteria:** Failure determined (execution failure + no retry remaining, or human decision to abandon).

**Exit Criteria:** Terminal state.

**Allowed Transitions:** None (terminal).

**Required Artifacts:** Failure report, last known state, error details.

**Human Approval:** Human decision recorded.

**Audit Events:** `ProjectFailed`

**Rollback:** Any applied changes should be rolled back; rollback plan required.

---

## Approval Gates Summary

| Gate | Triggered At | Approver | Block if Not Approved |
|---|---|---|---|
| `PlanApprovalGate` | `PLANNED` | Human | Cannot proceed to `TASKS_CREATED` |
| `ExecutionStartGate` | `CAPABILITIES_ASSIGNED` | Human | Cannot proceed to `IN_EXECUTION` |
| `StagingApprovalGate` | `READY_FOR_HUMAN_REVIEW` | Human | Cannot proceed to `APPROVED_FOR_STAGING` |
| `ProductionApprovalGate` | `UAT_PASSED` | Human | Cannot proceed to `APPROVED_FOR_PRODUCTION` |
| `RollbackApprovalGate` | `ROLLBACK_REQUIRED` (production only) | Human | Rollback initiated only after approval |

---

## Invalid Transition Policy

Any attempt to transition a project to a state that is not in the `AllowedTransitions` list for its current state results in:

1. `InvalidStateTransitionException` raised
2. `AuditEvent` recorded: `InvalidTransitionAttempted` with current state, target state, requesting user, timestamp
3. HTTP 422 returned to caller
4. No state change persisted

The state machine is the final authority. No bypass mechanism exists.
