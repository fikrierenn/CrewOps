# CrewOps V2 — Kabiliyet Modeli

> **Dil notu**: Teknik terimler (sınıf isimleri, enum değerleri) İngilizce; açıklamalar Türkçe.

## Özet (Türkçe)

Kabiliyet sistemi, *kimin* hangi *görevi* hangi *bilgi* ve *kısıtlamalar* çerçevesinde yürüteceğini tanımlar. V1'in ad-hoc agent tanım dosyalarının yerini formal, versiyon yönetimli, registry destekli bir modelle alır.

### Model Tier Sistemi (Akıllı Routing)

CrewOps görev karmaşıklığına göre farklı model kullanır — token maliyetini dengeler:

| `ModelTier` | Model | Kullanım Senaryosu |
|-------------|-------|--------------------|
| `Operational` | Haiku | Özetleme, sınıflandırma, basit metin işleme, sağlık kontrolleri |
| `Complex` | Sonnet 4.6 | Çoğu geliştirme görevi, orta karmaşıklıkta kod |
| `Critical` | Opus 4.6 | Mimari kararlar, zor algoritmalar, güvenlik kritik kod |

Her `RoleProfile` varsayılan tier'ını tanımlar:
- `pm` → `Complex` (sohbet + özet)
- `architect` → `Critical` (mimari karar)
- `backend` → `Complex` (standart kod) veya `Critical` (karmaşık)
- `qa` → `Operational` (test planı) veya `Complex` (test kodu)
- `devops` → `Complex`

`TaskDispatcher`, task'ın `complexity` alanına ve `RoleProfile.DefaultModelTier`'ına bakarak model seçer. Bu seçim `ExecutionRequest` içinde worker'a iletilir.

### V1 → V2 Karşılaştırması

| V1 | V2 |
|----|-----|
| `defaultModelPolicy.simple/medium/complex` JSON alanı | `ModelTier` enum: `Operational/Complex/Critical` |
| Role JSON'da inline tanım | `RoleProfile` entity + `CapabilityRegistry` |
| agents-main/.md dosyaları | `CapabilityPack` + `SkillManifest` |
| Skill injection düz metin | `SkillManifest.Tier` progressive disclosure |

---

The capability system defines *who* executes *what* task with *which* knowledge and *which* constraints. It replaces the ad-hoc agent description files of V1 with a formal, versioned, registry-backed model.

---

## Core Concepts

```
ProjectBootstrapPack
  └─► selects default RoleProfiles
  └─► selects default CapabilityPacks
  └─► selects default WorkflowBundles
  └─► sets default ExecutionPolicies

CapabilityPack (versioned, domain-scoped)
  └─► contains SkillManifests[]
  └─► defines tool permissions
  └─► defines context rules
  └─► defines diagnostics

RoleProfile (domain-scoped role definition)
  └─► assigned CapabilityPack
  └─► model tier (Critical/Standard/Operational)
  └─► accepted task types
  └─► tool permission profile
  └─► approval constraints

WorkflowBundle (repeatable multi-step playbook)
  └─► ordered workflow steps
  └─► activation context rules
  └─► quality check hooks

SkillManifest (three-tier knowledge unit)
  └─► Tier 1: metadata (always loaded)
  └─► Tier 2: instructions (loaded on activation)
  └─► Tier 3: resources (loaded on demand)

ContextRule (declarative loading rule)
  └─► trigger condition
  └─► context to load
  └─► token budget impact
  └─► scope constraints
```

---

## CapabilityPack

A **CapabilityPack** is the fundamental unit of capability. It is versioned, domain-scoped, and self-contained. Installing one pack does not affect another.

### Schema

```json
{
  "id": "backend-excellence",
  "version": "1.0.0",
  "domain": "backend",
  "displayName": "Backend Excellence Pack",
  "description": "Capabilities for backend API design, database schema, and service implementation.",
  "compatibleRoles": ["backend-engineer", "backend-architect"],
  "skills": [
    "api-design-principles",
    "orm-design-patterns",
    "async-programming",
    "error-handling",
    "sql-performance"
  ],
  "toolPermissions": {
    "allowedTools": ["read_file", "write_file", "run_tests", "run_migrations"],
    "deniedTools": ["rm_rf", "drop_database", "exec_shell_unrestricted"]
  },
  "contextRules": [
    {
      "trigger": "task.type == 'DatabaseSchema'",
      "loadSkills": ["sql-performance", "orm-design-patterns"],
      "priority": "high"
    }
  ],
  "diagnostics": {
    "healthCheck": "validate-backend-toolchain",
    "requiredTools": ["dotnet", "ef"],
    "optionalTools": ["docker"]
  }
}
```

### Registry Behavior

- Packs are registered in `CapabilityRegistry` at startup
- Registry sources: built-in templates, project-specific overrides
- Packs can be enabled/disabled per project
- Version conflicts are surfaced as warnings, not silently resolved

---

## RoleProfile

A **RoleProfile** defines what an execution role is, what it can do, and what constraints apply to it. It is not an agent prompt — it is a structured capability declaration.

### Schema

```json
{
  "id": "backend-engineer",
  "domain": "backend",
  "displayName": "Backend Engineer",
  "description": "Implements server-side features, APIs, services, and database integrations.",
  "modelTier": "Standard",
  "acceptedTaskTypes": [
    "FeatureImplementation",
    "ApiEndpoint",
    "DatabaseSchema",
    "ServiceLogic",
    "BugFix"
  ],
  "requiredCapabilityPack": "backend-excellence",
  "optionalCapabilityPacks": ["testing-rigor", "sql-advanced"],
  "toolPermissionProfile": "backend-standard",
  "systemPromptTemplate": "role-profiles/backend-engineer.md",
  "approvalConstraints": {
    "requiresHumanApprovalFor": ["DatabaseSchemaMigration", "DestructiveChange"],
    "escalateOnRiskLevel": "High"
  },
  "contextBudget": {
    "maxTokens": 32000,
    "skillTokenBudget": 8000,
    "memoryTokenBudget": 4000
  }
}
```

### Model Tier Mapping

| Tier | Model | Use Case |
|---|---|---|
| `Critical` | claude-opus-4-6 | Architecture decisions, security review, complex problem solving |
| `Standard` | claude-sonnet-4-6 | Feature implementation, API design, database work |
| `Operational` | claude-haiku-4-5 | Simple fixes, formatting, minor changes, fast operations |

Tier assignment is defined on the `RoleProfile`. The PM layer and human can override per-task if justified.

### Built-in Role Profiles

| Role ID | Domain | Model Tier | Primary Use |
|---|---|---|---|
| `pm` | management | Critical | PM chat, agreement, planning, review, consolidation |
| `architect` | architecture | Critical | System design, ADRs, dependency decisions |
| `backend-engineer` | backend | Standard | API, services, business logic |
| `frontend-engineer` | frontend | Standard | UI components, state, UX |
| `sql-engineer` | database | Standard | Schema, migrations, query optimization |
| `qa-engineer` | quality | Standard | Test writing, test execution, coverage |
| `devops-engineer` | infrastructure | Standard | CI/CD, deployment, Docker, infra |

---

## WorkflowBundle

A **WorkflowBundle** is a reusable delivery playbook — a sequence of steps that represent a repeatable delivery pattern for a given type of work.

### Schema

```json
{
  "id": "tdd-feature-delivery",
  "displayName": "TDD Feature Delivery",
  "description": "Delivers a feature using Test-Driven Development: tests first, then implementation.",
  "applicableTaskTypes": ["FeatureImplementation", "ApiEndpoint"],
  "steps": [
    {
      "order": 1,
      "name": "WriteFailingTests",
      "roleHint": "qa-engineer",
      "description": "Write failing unit tests that define the expected behavior.",
      "outputContract": "failing-tests-produced"
    },
    {
      "order": 2,
      "name": "ImplementFeature",
      "roleHint": "backend-engineer",
      "dependsOn": ["WriteFailingTests"],
      "description": "Implement the feature to make tests pass.",
      "outputContract": "tests-passing"
    },
    {
      "order": 3,
      "name": "Refactor",
      "roleHint": "backend-engineer",
      "dependsOn": ["ImplementFeature"],
      "description": "Refactor for clarity and maintainability without breaking tests.",
      "outputContract": "code-review-ready"
    }
  ],
  "qualityChecks": [
    {
      "name": "AllTestsPass",
      "required": true,
      "failureAction": "BlockAndEscalate"
    },
    {
      "name": "NoBrokenDependencies",
      "required": true,
      "failureAction": "BlockAndRetry"
    }
  ],
  "contextRules": [
    {
      "trigger": "step.name == 'WriteFailingTests'",
      "loadSkills": ["tdd-methodology", "testing-patterns"]
    },
    {
      "trigger": "step.name == 'ImplementFeature'",
      "loadSkills": ["api-design-principles", "error-handling"]
    }
  ]
}
```

### Built-in Workflow Bundles

| Bundle ID | Use Case |
|---|---|
| `standard-feature-delivery` | Default: implement → QA → review |
| `tdd-feature-delivery` | Tests first, then implementation |
| `schema-migration-delivery` | Schema change → migration → rollback plan → QA |
| `bugfix-delivery` | Reproduce → fix → regression test → verify |
| `api-endpoint-delivery` | Contract first → implementation → integration test |
| `infrastructure-change` | Plan → impact assessment → staged apply → verify |

---

## SkillManifest

A **SkillManifest** is a three-tier knowledge unit. Inspired by the progressive disclosure pattern from wshobson/agents, translated into CrewOps-native terms.

### Three-Tier Loading

```
Tier 1 — Metadata (always loaded, ~100 tokens)
  - id, name, domain, description, activation triggers
  - loaded into every execution context as part of role profile

Tier 2 — Instructions (~500-2000 tokens, loaded on activation)
  - full behavioral guidance
  - patterns, principles, decision rules
  - loaded when ContextRule triggers this skill

Tier 3 — Resources (on demand, variable tokens)
  - code examples, templates, reference implementations
  - loaded only when execution prompt explicitly requests them
  - never loaded automatically
```

### Schema

```yaml
# SKILL.md frontmatter
id: api-design-principles
name: API Design Principles
domain: backend
description: >
  Guidance for designing RESTful and RPC APIs with strong contracts,
  versioning, error handling, and documentation standards.
activationTriggers:
  - "task.type in ['ApiEndpoint', 'FeatureImplementation']"
  - "task.description contains 'endpoint'"
tokenBudget:
  tier1: 80
  tier2: 800
  tier3: 2000
```

```markdown
# (body of SKILL.md = Tier 2 instructions)

## API Design Principles

When designing API endpoints:
1. Define the contract before implementation (request/response schema)
2. Use consistent error response structure
3. Version APIs explicitly from the start
...

[references/] contains Tier 3 resources (not in this file)
```

---

## ContextRule

A **ContextRule** declares when a skill or context block is loaded. Rules are evaluated at context assembly time before each execution run.

### Schema

```json
{
  "id": "load-sql-skills-for-schema-tasks",
  "description": "Load SQL performance skills when task involves database schema changes.",
  "trigger": {
    "condition": "task.type == 'DatabaseSchema' OR task.tags contains 'migration'",
    "projectType": null,
    "roleId": "sql-engineer"
  },
  "action": {
    "loadSkills": ["sql-performance", "orm-design-patterns", "migration-safety"],
    "loadTier": 2,
    "priority": "high"
  },
  "tokenImpact": {
    "estimated": 2400,
    "budgetCategory": "skills"
  },
  "scope": "task"
}
```

### Rule Evaluation Order

1. Role-level rules (always applied for the given role)
2. Task-type rules (applied based on `task.type`)
3. Task-tag rules (applied based on `task.tags`)
4. Workflow-step rules (applied based on current workflow bundle step)
5. Budget enforcement: if total exceeds `contextBudget.skillTokenBudget`, lower-priority rules are deferred

---

## ProjectBootstrapPack

A **ProjectBootstrapPack** is a project-type preset. It selects all defaults for a given project type, so PM doesn't need to manually assign every role and pack.

### Schema

```json
{
  "id": "dotnet-web-api-project",
  "displayName": ".NET Web API Project",
  "description": "Starter configuration for a .NET backend API with SQL Server database.",
  "defaultRoles": [
    "architect",
    "backend-engineer",
    "sql-engineer",
    "qa-engineer",
    "devops-engineer"
  ],
  "defaultCapabilityPacks": [
    "backend-excellence",
    "sql-advanced",
    "testing-rigor",
    "infrastructure-standard"
  ],
  "defaultWorkflowBundle": "standard-feature-delivery",
  "defaultReleasePolicy": {
    "stagingApproval": "required",
    "productionApproval": "required",
    "observationWindowMinutes": 60,
    "autoRollbackOnAnomaly": false
  },
  "defaultQualityRequirements": {
    "minimumTestCoverage": 70,
    "requireQaPassBeforeReview": true,
    "requirePmReviewBeforeHumanReview": true
  },
  "techStackHints": ["dotnet", "csharp", "sqlserver", "entityframework"]
}
```

### Built-in Bootstrap Packs

| Pack ID | Stack | Default Roles |
|---|---|---|
| `dotnet-web-api-project` | .NET + SQL Server | architect, backend, sql, qa, devops |
| `react-frontend-project` | React + TypeScript | architect, frontend, qa |
| `fullstack-web-project` | Any fullstack | architect, backend, frontend, sql, qa, devops |
| `python-api-project` | Python + FastAPI | architect, backend, sql, qa, devops |
| `infrastructure-project` | Terraform / K8s | architect, devops, qa |
| `data-pipeline-project` | ETL / analytics | architect, sql, backend, qa |

---

## Capability Registry

The `CapabilityRegistry` is the central authority for all capability packs, role profiles, and workflow bundles.

### Behaviors

- **Load at startup**: Registry loads all definitions from `templates/` on application start
- **Query interface**: `FindPacks(domain, tags)`, `GetProfile(roleId)`, `GetBundle(bundleId)`
- **Health check**: Reports missing required packs; flags version incompatibilities
- **Enable/Disable**: Per-project flags to enable or disable specific packs
- **Version tracking**: Registry records which version of a pack was used in each execution run

### Not a Marketplace

The registry is **not** an internet-connected marketplace. It is a local-first, file-backed registry with versioned definitions. External pack sources can be added as a future extension point, but V2 is local-first.
