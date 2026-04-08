# CrewOps V2 — Ürün Vizyonu

> **Dil notu**: Teknik terimler (sınıf isimleri, API yolları, enum değerleri) İngilizce; açıklamalar Türkçe'dir.

## Özet (Türkçe)

CrewOps, **PM-first (PM öncelikli), onay-yönetimli, kabiliyet-güdümlü bir AI yazılım teslimat kontrol düzlemidir**.

Bir chatbot değildir. Otonom kodlama ajanı değildir. Marketplace değildir.

CrewOps, AI destekli yazılım teslimatının işletim sistemidir: insanlar tüm karar yetkisini elinde tutar, AI uzmanları bu yetki çerçevesinde görevleri yürütür.

**Kullanıcı SADECE PM ile konuşur.** Hiçbir ajan doğrudan kullanıcıyla iletişim kurmaz.

---

# CrewOps V2 — Product Vision

## Definition

CrewOps is a **PM-first, approval-governed, capability-driven AI software delivery control plane**.

It is not a chatbot. It is not an autonomous coding agent. It is not a marketplace.

CrewOps is the operating system for AI-assisted software delivery — where humans retain all decision authority, and AI specialists execute within that authority.

---

## What Problem CrewOps Solves

Most AI coding tools answer the question: *"Can AI write code?"*

CrewOps answers a different question: *"Can AI deliver software with the discipline, governance, and auditability that real teams need?"*

The failure modes of current AI coding tools are:
1. **Scope drift** — AI does something adjacent to what was asked
2. **No governance** — AI deploys, deletes, or modifies without approval
3. **No audit trail** — no record of why decisions were made
4. **No review gate** — output goes directly to "done" without review
5. **Context collapse** — the AI doesn't know what the project actually is
6. **No decomposition discipline** — one prompt, one giant result, no granular control

CrewOps eliminates these failure modes by design.

---

## Core Value Proposition

| Capability | What It Gives the Human |
|---|---|
| PM-first intake | Requirements are clarified, not guessed |
| Mutual agreement | Scope is locked before execution starts |
| Formal task decomposition | Work is granular, traceable, and assignable |
| Capability-driven routing | The right specialist executes the right task |
| Approval gates | Nothing progresses without explicit human sign-off |
| PM-consolidated summary | Human receives decision-ready information, not raw output |
| Release governance | Production is protected by explicit gates |
| Audit trail | Every decision, run, and approval is recorded |

The value is **control and auditability**, not just "AI wrote the code."

---

## V1 → V2 Transition

### What V1 Proved
- PM chat → mutabakat (agreement) → plan → agent execution → review cycle works conceptually
- Sequential DAG execution with retry logic is viable
- Agent skill injection into prompts adds value
- Role-based task routing is the right model

### What V1 Revealed as Gaps
- **No formal state machine** — project phase was a string field
- **No formal governance layer** — review was implicit, not enforced
- **No capability system** — skills were embedded text in agent descriptions
- **No release management** — delivery was a report, not a gate
- **SQLite** was fine for prototype but not production-minded
- **TypeScript/Node.js** stack made it harder to model domain concepts cleanly
- **No workspace isolation** — execution ran in shared context

### V2 Response
V2 redesigns from the domain model outward:
- Formal state machine as a first-class domain concept
- Explicit governance with typed approval gates
- Capability packs as installable/selectable units
- SQL Server with proper relational modeling
- .NET 10 as the core platform
- Workspace isolation per execution run
- Release management as a full lifecycle phase

---

## Product Identity (Non-Negotiable)

CrewOps is defined by these identity statements:

1. **Human is the final decision-maker.** CrewOps never acts autonomously on human behalf at governance boundaries.

2. **PM is the only conversational entry point.** No agent speaks directly to the human. All communication goes through PM.

3. **Governance owns state.** The workflow state machine is owned by CrewOps, not by any external runtime.

4. **Execution is delegated, approval is not.** An external agent may execute a task. The approval to proceed past a governance gate stays in CrewOps.

5. **Production deployment requires explicit human approval.** No autonomous production deploy, ever.

6. **Everything is auditable.** Every state transition, approval, run result, and deployment record is stored and queryable.

---

## Architecture Philosophy

**Borrow the method, not the shape.**

CrewOps draws on methods from execution-oriented agent systems (session isolation, resumability, action confirmation), capability plugin ecosystems (progressive disclosure, capability packs, role specialization), and template/catalog systems (registry design, bootstrap packs, diagnostics). But it does not replicate any of these systems' product shapes, branding, or structural choices.

The core architectural pattern is:

```
Human → PM Layer → Orchestration Layer → Capability Layer → Execution Layer
                 ↘ Governance Layer ↗                    ↗
                 ↘ Delivery Layer  ↗                    ↗
                 ↘ Observability  ↗                    ↗
```

---

## Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Core platform | .NET 10 (C#) | Type safety, domain modeling, performance, ecosystem |
| Architecture style | Clean Architecture + Vertical Slices | Feature-based, explicit boundaries, testable |
| Database | SQL Server | Production-grade, relational, reporting-friendly |
| ORM | EF Core | .NET-native, migration support |
| API | ASP.NET Core Minimal API | Lightweight, no MVC overhead |
| Real-time | SignalR | .NET-native, replaces SSE for run streaming |
| Frontend | Blazor Server | C# components, minimal JS, server-rendered |
| CSS | Tailwind CSS | Utility-first, no heavy framework |
| LLM execution | HTTP API (Anthropic SDK / Gemini HTTP) | No CLI dependency for production |
| Agent runtime (optional) | Python sidecar | Experimentation layer; not core governance |
| Testing | xUnit + FluentAssertions | .NET standard |

---

## Stakeholders

| Role | Interaction |
|---|---|
| **Human (Product Owner)** | Talks only to PM. Approves agreements, plans, reviews, releases. |
| **PM Layer** | Clarifies, negotiates, plans, summarizes. Driven by LLM behind CrewOps governance. |
| **Specialist Agents** | Execute tasks within capability boundaries. Never speak to human directly. |
| **CrewOps System** | Owns state, governance, audit. Never autonomous at decision points. |

---

## What CrewOps is NOT

- Not a chatbot shell
- Not a marketplace-first product
- Not an autonomous coding swarm
- Not a prompt template store
- Not a UI clone of OpenHands, Cursor, or any other tool
- Not a framework that hides what it is doing
- Not designed for demo theatrics — designed for operational use
