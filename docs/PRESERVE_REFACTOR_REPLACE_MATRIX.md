# CrewOps V1 → V2 — Koru / Refactor / Değiştir / Kaldır / Sonraya Bırak Matrisi

Bu belge, V1 codebase'inin her bileşeni için V2 geçiş kararını kayıt altına alır. Her karar: gerekçe ve V2 karşılığı ile birlikte verilmiştir.

---

## Karar Kategorileri

| Kategori | Anlamı |
|----------|--------|
| **KORU** | Doğrudan V2'ye taşı — mantık değişmez |
| **PORT ET** | Kavramı koru, ama dili/platformu değiştir (TypeScript → C#) |
| **REFACTOR** | Yeniden yaz, daha iyi tasarımla |
| **DEĞİŞTİR** | Farklı bir teknoloji veya yaklaşımla yenile |
| **KALDIR** | Kullanılmıyor, gereksiz, veya zararlı |
| **SONRAYA BIRAK** | V2.1+ için planla |

---

## 1. Domain Kavramları ve Tipler

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| `Project` interface | `packages/shared/src/index.ts` | **PORT ET** | Temel domain kavramı, değişmez | `Project` aggregate (Domain katmanı) |
| `Task` interface | shared | **PORT ET** | DAG bağımlılık modeli korunur | `Task` aggregate |
| `Run` interface | shared | **PORT ET** | Execution kaydı — hâlâ geçerli | `ExecutionRun` aggregate |
| `Artifact` interface | shared | **PORT ET** | Artifact persistence kavramı korunur | `ExecutionArtifact` entity |
| `Role` interface | shared | **PORT ET** | Role profil modeli korunur | `RoleProfile` (Capabilities katmanı) |
| `ChatMessage` interface | shared | **PORT ET** | PM sohbet geçmişi | `PmMessage` entity |
| `PlanDraft` interface | shared | **PORT ET** | Agreement taslağı | `AgreementDraft` entity |
| `TaskReview` interface | shared | **PORT ET** | Review kararı kaydı | `TaskReview` entity |
| `DeliveryReport` interface | shared | **REFACTOR** | Yapısal iyileştirme gerekli | `DeliveryReport` (Releases katmanı) |
| `ProjectPhase` string union | shared | **DEĞİŞTİR** | String union → formal enum + state machine | `ProjectState` enum + `ProjectStateMachine` |
| `OrchestrationEvent` interface | shared | **PORT ET** | Event tipolojisi korunur | `OrchestrationEvent` domain event |
| `CostLedgerEntry` interface | shared | **PORT ET** | Maliyet takibi | `CostRecord` entity |

---

## 2. Veritabanı Katmanı

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| SQLite (better-sqlite3) | `packages/db/` | **DEĞİŞTİR** | Üretim için SQL Server; concurrency ve reporting | SQL Server + EF Core |
| WAL modu | schema.ts | **KALDIR** | SQL Server'da gerekmiyor | EF Core transaction |
| 8 migration şeması | schema.ts | **PORT ET** (mantık) | Tablo yapıları V2 entity tasarımına referans | EF Core migration'ları |
| Repository fonksiyonları | `packages/db/src/index.ts` | **PORT ET** (mantık) | CRUD operasyonları korunur | EF Core repository implementations |
| `orchestrator.db` dosyası | repo kökü | **KALDIR** | V2'de SQL Server | — |

---

## 3. API Katmanı

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| Express.js | `apps/api/` | **DEĞİŞTİR** | .NET 10 platformu, tip güvenliği, performans | ASP.NET Core Minimal API |
| 30+ Express endpoint | `apps/api/src/index.ts` | **PORT ET** (mantık) | API surface korunur, implementasyon değişir | Minimal API route registration |
| SSE (Server-Sent Events) | API | **DEĞİŞTİR** | SignalR daha güçlü (reconnect, gruplar) | SignalR hub |
| Auth yok | API | **REFACTOR** | V2'de auth ekleniyor | ASP.NET Core cookie/JWT auth |
| Rate limiting yok | API | **REFACTOR** | V2'de eklenecek | ASP.NET Core rate limiting middleware |

---

## 4. Web UI

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| Vite + React + React Router | `apps/web/` | **DEĞİŞTİR** | .NET ekosistemi, SignalR circuit, server-side rendering | Blazor Server |
| Tailwind CSS | apps/web | **KALDIR** | Blazor'da kullanılabilir ama MudBlazor/Bootstrap daha yaygın | MudBlazor veya Bootstrap |
| PmChat sayfası | apps/web/src/pages/ | **PORT ET** (UI mantığı) | Sohbet arayüzü kavramı korunur | Blazor PmChat component |
| Dashboard sayfası | apps/web/src/pages/ | **PORT ET** (mantık) | Proje özeti korunur | Blazor Dashboard component |
| Tasks sayfası | apps/web/src/pages/ | **PORT ET** (mantık) | Task list + DAG viewer | Blazor TaskGraph component |
| RunConsole bileşeni | apps/web/src/components/ | **DEĞİŞTİR** | SSE → SignalR | Blazor RunConsole (SignalR ile) |
| TaskDagGraph bileşeni | apps/web/src/components/ | **PORT ET** (konsept) | DAG görselleştirme | Blazor TaskDagGraph |
| Kalan 5 sayfa (Roles, Memory, History, Orchestration, PlanReview) | apps/web | **REFACTOR** | İçerik korunur, Blazor componentlere dönüştürülür | Blazor pages |

---

## 5. Çekirdek Motorlar (packages/core)

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| `PmChatEngine` | pmChatEngine.ts | **PORT ET** | PM chat mantığı değişmez | `PmService` (Application katmanı) |
| `PmPlannerEngine` | pmPlannerEngine.ts | **PORT ET** | Agreement → task decomposition mantığı | `PlannerService` (Application katmanı) |
| `PmReviewEngine` | pmReviewEngine.ts | **PORT ET** | approve/revise/escalate kararı | `ReviewService` (Application katmanı) |
| `OrchestrationLoop` | orchestrationLoop.ts | **PORT ET** | Paralel DAG yürütme mantığı | `OrchestrationLoop` (Orchestration katmanı) |
| `WorkflowEngine` (canRunTask) | workflowEngine.ts | **PORT ET** | Dependency kontrolü mantığı | `TaskGraphBuilder.CanRunTask()` |
| `LLMRunner` | llmRunner.ts | **DEĞİŞTİR** | Interface arkasına alınır | `ILlmClient` + `AnthropicHttpClient` |
| `ClaudeCodeRunner` | claudeCodeRunner.ts | **PORT ET** (mantık) | CLI spawn mantığı | `LocalClaudeWorker : IExecutionWorker` |
| `GeminiRunner` | geminiRunner.ts | **SONRAYA BIRAK** | MVP'de Gemini yok | V2.1 `GeminiWorker` |
| `GeminiApiRunner` | geminiApiRunner.ts | **SONRAYA BIRAK** | MVP'de Gemini yok | V2.1 |
| `OutputParser` | outputParser.ts | **PORT ET** | 5-bölüm sözleşme parsing mantığı | `WorkerResultNormalizer` (Execution katmanı) |
| `PlanningOutputParser` | planningOutputParser.ts | **PORT ET** | Plan parsing mantığı | `PlanOutputParser` (Application katmanı) |
| `PatchApplier` | patchApplier.ts | **PORT ET** (mantık) | git apply mantığı | `PatchApplier` servis |
| `MemoryEngine` | memoryEngine.ts | **KALDIR** | V2'de file-based memory yok | DB state (Projects tablosu) |
| `ArtifactManager` | artifactManager.ts | **PORT ET** (mantık) | Artifact persistence mantığı | `ArtifactCollector` (Execution katmanı) |
| `CostEstimator` | costEstimator.ts | **PORT ET** | Token/maliyet tahmini | `ExecutionCostTracker` (Execution katmanı) |
| `RoleRegistry` | roleRegistry.ts | **PORT ET** (mantık) | Rol yükleme mantığı | `RoleProfileLoader` (Capabilities katmanı) |
| `agentCatalog` | agentCatalog.ts | **PORT ET** (mantık) | Agent tarama mantığı | `FileSystemCapabilityLoader` (Infrastructure) |
| `AgentRouter` | agentRouter.ts | **PORT ET** (mantık) | Skill-based routing | `TaskDispatcher` (Orchestration katmanı) |
| `SkillScanner` | skillScanner.ts | **PORT ET** (mantık) | Skill içerik tarama | `SkillManifestLoader` (Capabilities katmanı) |
| `sanitizeSkillContent()` | orchestrationLoop.ts | **PORT ET** | Güvenlik kritik — C#'a taşı | `SkillContentSanitizer` (Capabilities katmanı) |
| `DeliveryEngine` | deliveryEngine.ts | **REFACTOR** | Delivery katmanı ile entegre olacak | `ReleaseService` (Releases katmanı) |
| `dependencyInstaller` | dependencyInstaller.ts | **SONRAYA BIRAK** | V2 agent execution'da gerekebilir | V2.1 |

---

## 6. Şablonlar ve Sözleşmeler

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| 7 rol tanımı (JSON) | `templates/roles/*.json` | **PORT ET** | Rol profilleri V2'ye taşınır | `templates/role-profiles/*.json` |
| `output_contract.md` | templates/ | **PORT ET** | 5-bölüm format korunur | Worker prompt template |
| `task_contract.md` | templates/ | **PORT ET** | Task yürütme gereksinimleri | Worker prompt template |
| `pm_chat_contract.md` | templates/ | **PORT ET** | PM chat format | `PmService` system prompt |
| `pm_planning_contract.md` | templates/ | **PORT ET** | Planlama format | `PlannerService` system prompt |
| `pm_review_contract.md` | templates/ | **PORT ET** | Review format | `ReviewService` system prompt |

---

## 7. Agent Ekosistemi

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| `.claude/agents/` (7 agent MD) | .claude/agents/ | **PORT ET** | Built-in agent tanımları | `templates/capability-packs/builtin/` |
| `agents-main/` (73 plugin, 112 agent, 129 skill) | agents-main/ | **KORU (referans)** | V2 CapabilityRegistry seed kaynağı | `v1/agents-main/` → startup scan |

---

## 8. Altyapı ve Konfigürasyon

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| `package.json` (root monorepo) | / | **KALDIR** | V2 .NET solution | `CrewOps.sln` |
| `tsconfig.base.json` | / | **KALDIR** | TypeScript artık yok | — |
| `.env` | / | **REFACTOR** | Secrets yönetimi düzenlenir | `appsettings.json` + User Secrets |
| `apps/orchestrator/` (Ink TUI) | apps/orchestrator/ | **KALDIR** | Kullanılmıyor, legacy | — |
| `memory/` dizini (3 dosya) | memory/ | **KALDIR** | V2'de DB state kullanılır | — (memory/ dosyaları temizlenecek) |
| `orchestrator.db` | / | **KALDIR** | V2'de SQL Server | — |

---

## 9. Dokümantasyon

| V1 Bileşen | Dosya | Karar | Gerekçe | V2 Karşılığı |
|------------|-------|-------|---------|-------------|
| `docs/00-overview.md` vb. (10 eski belge) | docs/ | **KALDIR (arşivle)** | V2 belgeleri bunların yerini alıyor | `docs/archive/` |
| `docs/TARGET_ARCHITECTURE.md` | docs/ | **KORU + GENIŞLET** | V2 mimarisi zaten doğru tanımlanmış | Güncelleme ile korunur |
| `README.md` | / | **REFACTOR** | V2 için yeniden yazılacak | V2 README |

---

## 10. Özet Sayılar

| Karar | Adet |
|-------|------|
| KORU | 3 |
| PORT ET | 31 |
| REFACTOR | 8 |
| DEĞİŞTİR | 7 |
| KALDIR | 11 |
| SONRAYA BIRAK | 4 |

**Temel mesaj:** V1'in mimarisini değiştiriyoruz ama iş mantığını koruyoruz. Kodun çoğu yeniden yazılır; kavramların çoğu hayatta kalır.

---

*Son güncelleme: 2026-03-08*
