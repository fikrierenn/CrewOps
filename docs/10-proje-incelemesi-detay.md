# CrewOps – Detaylı Proje İncelemesi

Bu belge projenin tüm katmanlarını, dosya yapısını, API yüzeyini, veri modelini ve akışları tek referansta özetler.

---

## 1. Genel Tanım

**CrewOps**, çok-ajanlı yazılım süreçlerini yöneten **orkestrasyon arayüzüdür**:

- Projeler, görevler, roller ve hafıza tek merkezden yönetilir.
- **PM Sohbet** ile kapsam netleştirilir; **mutabakat** sonrası planlama ve geliştirme aşamasına geçilir.
- **Plan** (PM planlama) ile görev taslağı üretilir; onay sonrası **Orkestrasyon** ile görevler sırayla çalıştırılır.
- Claude Code ve Gemini (CLI veya API) ile LLM koşuları yapılır; çıktı sözleşmeye (SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY) uyar; **Guarded Mode** ile patch yalnızca kullanıcı onayıyla uygulanır.

**Teknoloji özeti:** Node.js 18+, TypeScript, monorepo (npm workspaces). SQLite (better-sqlite3), Express (API), Vite + React (web), Ink (TUI).

---

## 2. Dizin Yapısı (Özet)

```
CrewOps/
├── apps/
│   ├── api/              # REST + SSE API (Express), port 3999
│   ├── orchestrator/     # Terminal TUI (Ink)
│   └── web/              # SPA (Vite + React), port 3000
├── packages/
│   ├── core/             # İş mantığı: runner’lar, PM/plan/review, orkestrasyon, parser, katalog
│   ├── db/               # SQLite CRUD, migration’lar
│   └── shared/           # Ortak tipler (Project, Task, Run, ChatMessage, PlanDraft, vb.)
├── templates/            # Sözleşmeler + rol şablonları
│   ├── output_contract.md, task_contract.md
│   ├── pm_chat_contract.md, pm_planning_contract.md, pm_review_contract.md
│   └── roles/*.json      # pm, architect, backend, frontend, sql, qa, devops
├── memory/               # NOW.md, DECISIONS.md, ARCH_SHORT.md (her koşuda prompt’a eklenir)
├── agents-main/          # Opsiyonel agent kataloğu (plugins/*/agents/*.md, skills/*/SKILL.md)
├── claude-code-main/     # Referans: Claude Code plugin/agent/skill formatı
├── scripts/
│   ├── run-in-terminal.js # Claude’u ayrı terminalde çalıştırır; bittiğinde API’ye POST /run/finished
│   └── kill-port.ps1     # Belirli portları dinleyen süreçleri kapatır (3000, 3999 vb.)
├── docs/                 # Proje dokümantasyonu (00–10, agent-teams, architecture)
├── .env                  # GEMINI_API_KEY, opsiyonel PORT, CLAUDE_CLI_BIN
├── package.json          # Workspace kökü; dev, dev:api, dev:web script’leri
└── orchestrator.db       # SQLite DB (kök dizinde oluşturulur)
```

---

## 3. Uygulamalar (apps)

### 3.1. apps/api

- **Amaç:** Web ve gömülü konsol için REST + SSE sunar; tüm iş akışları (proje, görev, PM chat, plan, orkestrasyon) buradan tetiklenir.
- **Port:** 3999 (veya `PORT` env).
- **Önemli dosya:** `src/index.ts` — tüm route’lar burada.

**API grupları:**

| Grup | Endpoint’ler | Açıklama |
|------|--------------|----------|
| Sağlık | `GET /api/health` | Basit health check |
| Projeler | `GET/POST /api/projects`, `GET/PATCH /api/projects/:id`, `POST /api/projects/:id/mutabakat-tamamla` | CRUD + mutabakat tamamlama (POST) |
| Görevler | `GET/POST /api/tasks`, `GET /api/tasks/:id` | CRUD |
| Roller | `GET /api/roles`, `POST /api/roles/import` | Proje bazlı roller; şablondan import |
| Şablonlar | `GET /api/role-templates` | templates/roles + agent kataloğu karışımı için kullanılabilir |
| Katalog | `GET /api/agent-catalog` | agents-main/plugins/*/agents listesi |
| Koşular | `GET /api/runs` | Proje bazlı run geçmişi |
| Hafıza | `GET /api/memory/status`, `POST /api/memory/create-default` | NOW/DECISIONS/ARCH_SHORT varlığı, varsayılan oluşturma |
| Run | `POST /api/run/start`, `POST /api/run/finished`, `GET /api/run/stream/:jobId` | Koşu başlatma, terminal bittiğinde callback, SSE stream |
| PM Chat | `POST /api/pm/chat`, `POST /api/pm/chat/stream`, `GET /api/pm/chat/history` | PM ile çok turlu sohbet, geçmiş |
| PM Plan | `POST /api/pm/plan/generate`, `POST /api/pm/plan/generate/stream`, `GET /api/pm/plan/draft`, `POST /api/pm/plan/approve`, `POST /api/pm/plan/reject` | Plan taslağı üretme, onay/red |
| Orkestrasyon | `POST /api/orchestration/start`, `GET /api/orchestration/stream`, `POST /api/orchestration/pause`, `POST /api/orchestration/resume`, `GET /api/orchestration/status` | Otomatik görev sırası, pause/resume, event stream |
| Agent router | `GET /api/agent-router/match` | Görev için uygun rol/agent eşlemesi |
| Skill katalog | `GET /api/skill-catalog` | skills taranması |

### 3.2. apps/web

- **Amaç:** Tarayıcıda admin paneli; projeler, PM sohbet, plan, orkestrasyon, görevler, roller, hafıza, geçmiş.
- **Port:** 3000 (Vite); `/api` istekleri `http://localhost:3999`’a proxy edilir.
- **Önemli dosyalar:**
  - `src/App.tsx` — Layout (topbar, sidebar, footer), rota tanımları.
  - `src/pages/` — Dashboard, Projects, PmChat, PlanReview, Orchestration, Tasks, Roles, Memory, History.
  - `src/api.ts` — API client (fetchProjects, createProject, completeMutabakat, pm/chat, plan, orchestration vb.).
  - `src/components/RunConsole.tsx` — SSE ile gömülü koşu çıktısı.

**Rota özeti:**

- `/` → Dashboard  
- `/projects` → Projeler (mutabakat butonu, POST mutabakat-tamamla)  
- `/pm-chat` → PM Sohbet  
- `/plan` → Plan (taslak, onay/red)  
- `/orchestration` → Orkestrasyon (başlat, pause, resume, stream)  
- `/tasks` → Görevler (liste, ekleme, Başla → run)  
- `/roles` → Roller / Agent’lar (şablonlar, import)  
- `/memory` → Hafıza dosyaları  
- `/history` → Koşu geçmişi  

### 3.3. apps/orchestrator

- **Amaç:** Terminal tabanlı TUI (Ink); proje/rol/görev/koşu/review ekranları.
- **Çalıştırma:** Kökten `npm run dev`.

---

## 4. Paketler (packages)

### 4.1. packages/core

**Dışa aktarılan modüller (index.ts):**

- **Runner’lar:** `ClaudeCodeRunner`, `GeminiRunner`, `GeminiApiRunner`, `LLMRunner` — prompt hazırlama, CLI/API çağrıları, stream.
- **Rol / Agent:** `RoleRegistry` (templates/roles), `agentCatalog` (listAgents, loadAgent, agentToRoleConfig), `skillScanner`, `agentRouter`.
- **Hafıza / Sözleşme:** `MemoryEngine` (NOW, DECISIONS, ARCH_SHORT).
- **Görev akışı:** `WorkflowEngine` (DAG, bağımlılık kontrolü).
- **PM akışı:** `PmChatEngine`, `PmPlannerEngine`, `PmReviewEngine` — sohbet, plan üretimi, plan onay/red, review.
- **Orkestrasyon / Teslim:** `orchestrationLoop`, `deliveryEngine`, `patchApplier`.
- **Çıktı / Artefact:** `OutputParser`, `planningOutputParser`, `ArtifactManager`, `CostEstimator`.

PM tarafı: PM rolü + `templates/pm_chat_contract.md`, `pm_planning_contract.md`, `pm_review_contract.md` kullanılır; mutabakat hazır olduğunda `[MUTABAKAT_HAZIR]` marker’ı ile belge üretilir.

### 4.2. packages/db

- **Amaç:** SQLite (orchestrator.db) üzerinde senkron CRUD; migration ile şema güncellenir.
- **Dosyalar:** `schema.ts` (createDb, migrations), `index.ts` (getDb, projeler, roller, görevler, koşular, chat_messages, plan_drafts, task_reviews, orchestration_events, artifacts, cost_ledger).

**Migrations (özet):**

- 001: projects, roles, tasks, runs, artifacts, cost_ledger  
- 002–004: projects phase, mutabakat_ozeti, mutabakat_tamamlandi_at  
- 005: chat_messages  
- 006: plan_drafts  
- 007: task_reviews, tasks.retry_count  
- 008: orchestration_events + indeksler  

### 4.3. packages/shared

- **Amaç:** Core ve db’nin kullandığı ortak tipler.
- **Önemli tipler:** `Project`, `ProjectPhase`, `Role`, `Task`, `TaskStatus`, `Run`, `RunStatus`, `ParsedOutput`, `ChatMessage`, `PlanDraft`, `PlannedTask`, `PlanningOutput`, `TaskReview`, `DeliveryReport`, `OrchestrationStatus`, `OrchestrationEvent`, `Artifact`, `CostLedgerEntry`; yardımcı `nowIso()`.

---

## 5. Veritabanı Tabloları (Özet)

| Tablo | Amaç |
|-------|------|
| projects | Proje adı, repo yolu, stack, phase, mutabakat alanları |
| roles | Proje bazlı rol (role_id, display_name, skills, work_style, model_policy, definition_of_done) |
| tasks | Görev (project_id, role_id, title, description, complexity, status, dependency_ids, retry_count) |
| runs | Koşu (task_id, project_id, role_id, status, exit_code, parsed_ok, summary) |
| artifacts | Run’a bağlı ham/parsed/patch içerik |
| cost_ledger | Run bazlı tahmini token/maliyet |
| chat_messages | PM sohbet geçmişi (project_id, role, content) |
| plan_drafts | Proje bazlı plan taslağı (raw_output, parsed_json, status: draft/approved/rejected) |
| task_reviews | Görev review (task_id, run_id, decision, reasoning, feedback) |
| orchestration_events | Orkestrasyon olayları (project_id, type, message, data_json) |

---

## 6. Şablonlar (templates)

| Dosya | Kullanım |
|-------|----------|
| output_contract.md | LLM çıktı formatı: SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY |
| task_contract.md | Görev nasıl yorumlanacak, nasıl raporlanacak |
| pm_chat_contract.md | PM sohbet kuralları, mutabakat hazırlığı |
| pm_planning_contract.md | Plan üretim kuralları |
| pm_review_contract.md | Görev çıktısı review kuralları |
| roles/*.json | pm, architect, backend, frontend, sql, qa, devops (displayName, skills, workStyle, defaultModelPolicy, definitionOfDone) |

---

## 7. Ortam ve Çalıştırma

- **.env:** `GEMINI_API_KEY` (Gemini API için); opsiyonel: `PORT`, `CLAUDE_CLI_BIN`, `CREWOPS_API_URL`.
- **Çalıştırma:**  
  - API: `npm run dev:api` (kökte; 3999).  
  - Web: `npm run dev:web` (3000; /api → 3999 proxy).  
  - TUI: `npm run dev` (orchestrator).
- **Port kapatma:** `.\scripts\kill-port.ps1 3000 3999` (PowerShell, kökte).

---

## 8. Akış Özeti (Kullanıcı Perspektifi)

1. **Proje ekle** (Projeler) → phase başlangıçta `mutabakat_bekliyor`.
2. **PM Sohbet** (isteğe bağlı) → Kapsam netleşir; PM `[MUTABAKAT_HAZIR]` ile belge üretebilir.
3. **Mutabakat tamamla** (Projeler) → “PM ile mutabakat yap” / “Mutabakat tamamlandı” (POST mutabakat-tamamla) → phase `mutabakat_tamamlandi`.
4. **Plan** (Plan sayfası) → Plan taslağı üretilir; onay/red.
5. **Orkestrasyon** → Onaylanan plana göre görevler sırayla çalıştırılır; event stream izlenir; patch’ler Guarded Mode’da kullanıcı onayıyla uygulanır.
6. **Görevler** → Manuel görev ekleme ve tek tek “Başla” ile koşu (Claude terminal veya gömülü konsol).
7. **Hafıza** → NOW/DECISIONS/ARCH_SHORT oluşturma/kontrol.  
8. **Geçmiş** → Koşu listesi ve artefact’lar.

---

## 9. Doküman İndeksi (İlgili Dosyalar)

- Genel bakış: `00-overview.md`  
- Vizyon / mimari: `01-vision-and-architecture.md`  
- Agent Skills: `02-agent-skills.md`  
- Dizin yapısı: `03-project-structure.md`  
- Katmanlar / veri akışı: `04-layers-and-data-flow.md`  
- Agent kataloğu / roller: `05-agent-catalog-and-roles.md`  
- Run pipeline / sözleşmeler: `06-run-pipeline-and-contracts.md`  
- İş planı / roadmap: `07-work-plan-and-roadmap.md`  
- claude-code-main: `08-claude-code-main.md`  
- Kullanım rehberi: `09-nasil-kullanilir.md`  
- Bu inceleme: `10-proje-incelemesi-detay.md`  

---

Bu doküman projenin mevcut haliyle teknik incelemesini tek yerde toplar; yapı veya API değiştikçe güncellenebilir.
