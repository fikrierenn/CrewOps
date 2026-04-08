# Proje Dizin Yapısı

CrewOps monorepo yapısında **apps** (uygulamalar) ve **packages** (paylaşılan kütüphaneler) bulunur.

---

## 1. Kök Dizin Özeti

```
CrewOps/
├── apps/
│   ├── api/           # REST API (Express) – web ve gömülü terminal için
│   ├── orchestrator/  # TUI (Ink) – terminal tabanlı yönetim
│   └── web/           # Web arayüzü (Vite + React)
├── packages/
│   ├── core/          # İş mantığı: runner’lar, katalog, hafıza, parser
│   ├── db/            # SQLite erişimi (better-sqlite3)
│   └── shared/        # Ortak tipler ve sabitler
├── templates/         # Sözleşmeler ve rol şablonları
├── memory/            # NOW, DECISIONS, ARCH_SHORT hafıza dosyaları
├── agents-main/       # Opsiyonel: dış agent/skill kataloğu (CrewOps tarafından taranır)
├── claude-code-main/  # Referans: Claude Code resmî repo kopyası (plugin/agent/skill örnekleri)
├── scripts/           # Yardımcı script’ler (örn. run-in-terminal.js)
├── docs/              # Proje dokümantasyonu (bu MD’ler)
└── package.json       # Workspace kökü
```

---

## 2. Apps

### 2.1. apps/api

- **Amaç**: Web arayüzü ve gömülü konsol için REST + SSE sunar.
- **Teknoloji**: Express, TypeScript, CORS.
- **Önemli dosyalar**:
  - `src/index.ts`: Tüm route’lar (projeler, görevler, roller, agent-catalog, run/start, run/stream, run/finished).
- **Çalıştırma**: Monorepo kökünden `npm run dev:api` (orchestrator.db, memory/, templates/ erişimi için).

### 2.2. apps/web

- **Amaç**: Projeler, görevler, roller, hafıza, geçmiş ve koşu konsolu için SPA.
- **Teknoloji**: Vite, React, React Router.
- **Önemli dizinler**:
  - `src/pages/`: Dashboard, Projects, Tasks, Roles, Memory, History.
  - `src/components/`: RunConsole (SSE ile gömülü çıktı).
  - `src/api.ts`: API client.

### 2.3. apps/orchestrator

- **Amaç**: Terminal tabanlı TUI (Ink); proje/rol/görev/koşu yönetimi, Guarded Mode onayları.
- **Çalıştırma**: `npm run dev` (kökte).

---

## 3. Packages

### 3.1. packages/core

- **Amaç**: Tüm iş kuralları ve LLM/agent orkestrasyonu.
- **Önemli modüller**:
  - `claudeCodeRunner.ts`: Claude Code CLI çağrıları, stream, `prepareRun`.
  - `geminiRunner.ts`: Gemini CLI (stdin prompt).
  - `llmRunner.ts`: Model adına göre Claude vs Gemini seçimi.
  - `agentCatalog.ts`: agents-main’den agent listesi ve içerik (`listAgents`, `loadAgent`, `agentToRoleConfig`).
  - `roleRegistry.ts`: Built-in rol şablonları (`templates/roles/*.json`).
  - `workflowEngine.ts`: Görev DAG ve bağımlılık kontrolleri.
  - `memoryEngine.ts`: NOW/DECISIONS/ARCH_SHORT dosyalarını okuma.
  - `outputParser.ts`: SUMMARY / PATCH / COMMANDS_TO_RUN_MANUALLY ayrıştırma.
  - `artifactManager.ts`: Çıktı ve patch saklama.
  - `costEstimator.ts`: Token ve maliyet tahmini.

### 3.2. packages/db

- **Amaç**: SQLite (orchestrator.db) üzerinde senkron CRUD.
- **Tablolar**: projects, tasks, runs, roles, artifacts, cost_ledger (ve gerekirse diğerleri).
- **Kullanım**: API ve Core bu paketi import eder.

### 3.3. packages/shared

- **Amaç**: Proje genelinde kullanılan tipler (Project, Task, Run, RunStatus vb.) ve yardımcılar.
- **RunStatus**: `"pending" | "running" | "completed" | "failed"` vb.

---

## 4. Şablonlar ve Hafıza

| Yol | Açıklama |
|-----|----------|
| `templates/output_contract.md` | Zorunlu çıktı formatı: SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY; dosya değişikliği sadece PATCH. |
| `templates/task_contract.md` | Rol çalıştırma görev sözleşmesi (ne yapılacak, nasıl raporlanacak). |
| `templates/roles/*.json` | Built-in roller (PM, ARCH, BACKEND, FRONTEND, SQL, QA, DEVOPS). |
| `memory/NOW.md` | Güncel durum. |
| `memory/DECISIONS.md` | Alınan kararlar. |
| `memory/ARCH_SHORT.md` | Kısa mimari özet. |

Rol şablonları `roleRegistry` tarafından monorepo köküne göre yüklenir (`rootDir`).

---

## 5. agents-main (Opsiyonel)

- **Konum**: `agents-main/` (veya `CREWOPS_AGENTS_PATH` ile farklı yol).
- **Yapı**:
  - `plugins/<plugin-name>/agents/*.md`: Agent tanımları (YAML frontmatter + gövde).
  - `plugins/<plugin-name>/skills/<skill-name>/SKILL.md`: Skill’ler (bkz. [02-agent-skills.md](02-agent-skills.md)).
- **CrewOps kullanımı**: `agentCatalog` bu dizini tarar; katalog agent’ları rol gibi kullanılarak prompt’a eklenir.

## 5b. claude-code-main (Referans)

- **Konum**: `claude-code-main/` — Claude Code’un resmî repo kopyası.
- **İçerik**: Resmî plugin’ler (commands, agents, skills, hooks), README, repo bakım script’leri. CrewOps çalışma zamanında bu klasörü okumaz; plugin/agent/skill formatı referansı için kullanılır.
- **Detay**: [08-claude-code-main.md](08-claude-code-main.md).

---

## 6. Scripts

- **scripts/run-in-terminal.js**: Claude’u ayrı terminal penceresinde çalıştırır; bittiğinde API’ye `POST /api/run/finished` ile bildirir (Windows/Unix uyumlu davranış için kullanılır).

---

## 7. Dokümantasyon

- **docs/**: Tüm proje dokümanları (00-overview, 01-vision, 02-agent-skills, 03-project-structure, 04-layers, 05-agent-catalog-and-roles, 06-run-pipeline-and-contracts, 07-work-plan, agent-teams, architecture).

Bu yapı [04-layers-and-data-flow.md](04-layers-and-data-flow.md) ile birlikte veri akışı ve katman sorumluluklarını tamamlar.
