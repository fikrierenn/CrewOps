# CrewOps V1 — Mevcut Durum Değerlendirmesi

Bu belge, V1 CrewOps codebase'inin gerçek durumunu kayıt altına alır. Abartılı değil, küçümseyici de değil: ne çalışıyor, ne yarım, ne yok, ne silinmeli.

---

## 1. Platform Özeti

| Parametre | Değer |
|-----------|-------|
| Runtime | Node.js 20 / TypeScript 5 |
| Monorepo | pnpm workspaces |
| Veritabanı | SQLite (better-sqlite3, WAL modu, 8 migration) |
| API | Express.js, ~1567 satır, 30+ endpoint |
| UI | Vite + React 18, React Router, Tailwind CSS — 9 sayfa |
| Çekirdek | packages/core — 22 TypeScript motoru |
| Genel Tamamlanma | ~%70 — pipeline çalışıyor, UI ve governance eksik |
| Konum | D:\Dev\CrewOps\ |

---

## 2. Mimari Görünüm (V1)

```
Kullanıcı (Tarayıcı)
    │ HTTP
    ▼
Web UI (React/Vite, port 3000)
    │ HTTP
    ▼
API Sunucusu (Express, port 3999)
    ├── SQLite (orchestrator.db)
    ├── Memory Engine (memory/ dizini — 3 dosya)
    ├── Role Registry (templates/roles/*.json)
    ├── Agent Catalog (agents-main/ — 73 plugin)
    ├── LLM Runner ─► Claude Code CLI (spawn)
    │                └► Gemini CLI/API
    ├── Patch Applier (git apply)
    └── Artifact Manager (artifacts/ dizini)
```

---

## 3. Çalışan Akışlar

Aşağıdaki akışlar V1'de uçtan uca çalışmaktadır:

### 3.1 PM Chat + Mutabakat
- `PmChatEngine.chat()` / `chatWithStream()` — multi-turn PM sohbeti
- `[MUTABAKAT_HAZIR]` marker algılama — mutabakat belgesi ayrıştırma
- Sohbet geçmişi DB'ye kaydedilir (`chat_messages` tablosu)
- **Durum**: Tam çalışıyor, streaming destekli

### 3.2 Plan Üretimi ve Materializasyonu
- `PmPlannerEngine.generatePlan()` — mutabakat → yapılandırılmış plan
- `PmPlannerEngine.materializePlan()` — plan → DB'de görevler + memory dosyaları
- Plan taslağı `plan_drafts` tablosuna kaydedilir
- **Durum**: Tam çalışıyor

### 3.3 Orchestration Loop
- `OrchestrationLoop.start()` — DAG sıralı/paralel görev yürütme
- `maxConcurrentTasks` (varsayılan: 3) — paralel yürütme desteği
- Skill injection — agent catalog'dan ilgili skill'ler role config'e eklenir
- **Durum**: Tam çalışıyor

### 3.4 LLM Yürütme
- `LLMRunner.run()` / `runWithStream()` — claude: / gemini: prefix dispatch
- `ClaudeCodeRunner` — Claude Code CLI spawn (Windows: `cmd /c start`, Linux: `xterm`)
- `GeminiApiRunner` — Gemini HTTP API
- **Durum**: Claude Code tam çalışıyor; Gemini API entegrasyonu kısmen çalışıyor

### 3.5 Çıktı Parsing ve Review
- `OutputParser.parse()` — katı 5-bölüm sözleşme (SUMMARY/FILES_CHANGED/PATCH/NEXT/RISKS)
- `PmReviewEngine.review()` — approve / revise / escalate kararı
- Task review `task_reviews` tablosuna kaydedilir
- **Durum**: Tam çalışıyor

### 3.6 Patch Uygulama
- `PatchApplier.apply()` — dry-run doğrulamalı `git apply`
- `autoCommit` desteği
- **Durum**: Tam çalışıyor

### 3.7 Artifact ve Maliyet Takibi
- `ArtifactManager.persistArtifacts()` — artifacts/ dizinine ham/parsed/patch/log yazılır
- `CostEstimator.recordCost()` — tahmini token/maliyet `cost_ledger` tablosuna
- **Durum**: Tam çalışıyor

### 3.8 Agent Catalog ve Skill Routing
- `AgentRouter.route()` — task description'a göre en uygun agent/skill eşleştirmesi
- `SkillScanner.getSkillsByPlugin()` — agents-main'den skill içeriği okuma
- `sanitizeSkillContent()` — prompt injection koruması (unsafe pattern blacklist)
- **Durum**: Tam çalışıyor, güvenlik sanitasyonu yerinde

---

## 4. Kısmen Tamamlanan Bileşenler

| Bileşen | Tamamlanma | Eksiklik |
|---------|------------|---------|
| Web UI sayfa iskeletleri | %30 | 9 sayfa routing var, detay implementasyonu yok |
| PmChat sayfası | %50 | API bağlantısı var, streaming UI eksik |
| Tasks sayfası | %50 | Liste var, çalıştırma tetikleyici eksik |
| Gemini API runner | %60 | HTTP client var, hata handling eksik |
| Delivery Engine | %40 | Temel rapor üretimi var, tam teslim akışı yok |
| apps/orchestrator (Ink TUI) | %20 | Scaffold var, aktif kullanılmıyor |

---

## 5. Mevcut Olmayan Bileşenler

Bunlar V1'de hiç tanımlanmamış — V2'ye özgü özellikler:

| Eksik Bileşen | Durum | V2'de Karşılığı |
|---------------|-------|----------------|
| Formal state machine | Yok | `ProjectStateMachine` (Domain katmanı) |
| ApprovalGate mekanizması | Yok | `ApprovalGateEngine` (Governance katmanı) |
| RiskGate | Yok | `RiskGateEngine` (Governance katmanı) |
| ReleaseRequest / DeploymentRecord | Yok | `CrewOps.Releases` |
| Rollback planı | Yok | `RollbackAuthority` (Governance katmanı) |
| Domain events | Yok | MediatR domain event pipeline |
| Kimlik doğrulama (auth) | Yok | ASP.NET Core cookie/JWT |
| Worker isolation (workspace per run) | Yok | `WorkspaceManager` |
| Stuck task detection | Yok | `StuckTaskDetector` |
| Audit event tablosu | Yok | `AuditEvent` entity + publisher |
| SignalR streaming | Yok | SignalR hub (SSE yerine) |
| FluentValidation | Yok | Command nesnelerinde validasyon |

---

## 6. Bilinen Anomaliler

### 6.1 Memory Dosyaları Kirlenmiş
`memory/` klasöründeki üç dosya (NOW.md, DECISIONS.md, ARCH_SHORT.md) **farklı bir projeye ait içerik** barındırmaktadır. Bu dosyalar bir toplantı yönetim uygulaması (PostgreSQL/Prisma) bağlamında başka bir Claude Code oturumu tarafından yazılmıştır.

**Etki**: V1'in memory engine'i bu dosyaları LLM prompt'una enjekte eder. Yanlış context enjeksiyon riski var.

**Aksiyon**: V2 geçişinde bu dosyalar temizlenecek. V2'de memory file sistemi yoktur — tüm durum DB'de tutulur.

### 6.2 apps/orchestrator Legacy
`apps/orchestrator/` (Ink TUI) aktif olarak kullanılmamaktadır. `package.json`'da `dev` scripti hâlâ bunu çalıştırıyor, ancak birincil arayüz React web UI'dır.

**Aksiyon**: V2 yapısında bu dizin kaldırılır.

### 6.3 Phase String Tabanlı Durum Yönetimi
`ProjectPhase` tipi düz string union'dır (`"mutabakat_bekliyor" | "mutabakat_devam" | ...`). Geçişler kod içine dağılmış, enforce eden merkezi bir mekanizma yok.

**Aksiyon**: V2'de `ProjectStateMachine` bu sorunu çözer.

### 6.4 API Kimlik Doğrulama Yok
Express API'sinde herhangi bir authentication middleware yoktur. Tüm endpoint'ler açıktır.

**Aksiyon**: V2'de ASP.NET Core auth eklenecek.

---

## 7. Korunacak Değerler

V1'deki aşağıdaki unsurlar doğrudan V2'ye taşınmalıdır (implementasyonu değil, mantığı):

1. **PM chat + agreement marker pattern** — `[MUTABAKAT_HAZIR]` → V2'de `[AGREEMENT_READY]` veya korunur
2. **OrchestrationLoop paralel DAG** — maxConcurrentTasks, dependency graph mantığı
3. **5-bölüm çıktı sözleşmesi** — SUMMARY/FILES_CHANGED/PATCH/NEXT/RISKS
4. **Skill injection güvenlik sanitasyonu** — `sanitizeSkillContent()` C#'a port edilir
5. **Approve/revise/escalate review gate** — `PmReviewEngine` mantığı
6. **Agreement → tasks otomasyonu** — `materializePlan()` mantığı
7. **7 built-in rol tanımı** — `templates/roles/*.json` → `templates/role-profiles/`
8. **agents-main marketplace** — V2 CapabilityRegistry için seed kaynağı
9. **DAG dependency modeli** — `dependencyIds: number[]` → V2'de entity ilişkisi
10. **Cost ledger** — `CostLedgerEntry` → V2'de `CostRecord` entity

---

## 8. V2'ye Geçiş Hazırlığı

**Güçlü yönler geçişe yardımcı olur:**
- Zengin type sistemi (`packages/shared/src/index.ts`) — C# entity tasarımına referans
- DB şeması (8 migration) — EF Core entity konfigürasyonu için referans
- 30+ API endpoint — V2 minimal API tasarımı için referans
- 5-bölüm output contract — `WorkerResultNormalizer` implementasyonu için referans
- V2 hedef mimarisi zaten belgelenmiş (`docs/TARGET_ARCHITECTURE.md`)

**Geçiş riski:**
- Node.js → .NET 10 tam rewrite — kod migration değil, mantık migration
- SQLite → SQL Server — veri migration scripti gerekli (istenirse)
- React → Blazor — UI bileşenleri yeniden yazılacak

**Öneri:** V1 çalışmaya devam etsin. V2 `src/` altında sıfırdan inşa edilsin. Paralel geliştirme stratejisi.

---

*Son güncelleme: 2026-03-08*
