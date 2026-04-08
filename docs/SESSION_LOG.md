# CrewOps V2 - Session Log

Her oturumdaki ilerleme kronolojik olarak kaydedilir. Session düşse bile buradan devam edilir.

---

## 2026-04-06
**Odak:** Evrensel Orkestratör altyapı hazırlığı

### Tamamlanan
- GovernancePreset.cs oluşturuldu (FullSoftware + Minimal preset)
- OutputType.cs oluşturuldu (CodePatch, Document, Analysis, Plan)
- CrewOpsTask.cs'e DomainHint property eklendi
- Project.cs docstring güncellendi (evrensel domain desteği)
- CLAUDE.md oluşturuldu (proje kökü — mimari kurallar, kodlama standartları)
- 11 agent tanımı (.claude/agents/) — 7 güncellenen + 4 yeni
- 9 slash command (.claude/commands/)
- settings.local.json güncellendi

### Kalan İşler
- 9 iş kalemi belirlendi (Project.cs güncelleme, TeamTemplate, ExecutionRun, StateMachine, Capabilities, Tests)

---

## 2026-04-07
**Odak:** 5 fazlı implementasyon planı + observability vizyonu

### Tamamlanan
- 5 fazlı implementasyon planı yazıldı (`docs/V2_IMPLEMENTATION_PHASES.md`)
- Mevcut domain model keşfi yapıldı (tüm dosyalar incelendi)
- Observability gereksinimleri eklendi (AuditEvent, SignalR, Blazor Dashboard)
- 5 use case örneği tanımlandı (güzellik salonu, SEO audit, içerik fabrikası, rakip analizi, e-ticaret)
- SESSION_LOG.md sistemi kuruldu
- CLAUDE.md'ye session yönetimi kuralı eklendi
- Memory dosyaları güncellendi

### Plan Özeti (5 Faz)
1. **Faz 1 — Domain Model:** Project.cs güncelleme, TeamTemplate, ExecutionRun, ProjectStateMachine, unit tests (~12 dosya)
2. **Faz 2 — Capabilities:** SkillSourceScanner, InMemoryCapabilityRegistry, RoleProfile, 6 TeamTemplate JSON (~15 dosya)
3. **Faz 3 — Infrastructure:** EF Core DbContext, entity configs, SQL Server, repositories (~12 dosya)
4. **Faz 4 — Observability:** AuditEvent, SignalR hub, 6 Blazor dashboard sayfası, analytics (~18 dosya)
5. **Faz 5 — API:** Minimal API endpoints, MediatR handlers, Contracts, integration tests (~15 dosya)

### Kalan İşler
- Faz 1'den başlayarak implementasyona geçilecek
- İlk iş: Project.cs güncelleme + ExecutionRun aggregate + ProjectStateMachine

### Notlar
- Kullanıcı tam izlenebilirlik istiyor — her şey DB'ye, anlık Blazor dashboard
- Güzellik salonu use case: sitesi olmasa bile Google yorumları iyi olan salonlar hedef
- Geliştirme bir sonraki oturuma bırakıldı

---

## 2026-04-08
**Odak:** Faz 1 — Domain Model Tamamlama (implementasyon)

### Tamamlanan
- **Project.cs güncellendi:** nullable RepoPath/Stack, Domain, TeamTemplateId, GovernancePreset, CreateUniversal factory, AssignTeamTemplate method
- **TeamTemplate.cs** value object oluşturuldu (record: Id, Name, Domain, Governance, RoleSlots)
- **TeamRoleSlot.cs** value object oluşturuldu (record: RoleId, DisplayName, ModelTier, IsRequired)
- **ExecutionRun.cs** aggregate oluşturuldu (tam lifecycle: Created→Queued→...→Completed/Failed/TimedOut, metrik takibi)
- **ProjectStateMachine.cs** implemente edildi (24+ base transition, governance shortcuts: QA skip, deploy skip)
- **IProjectStateMachine.cs** interface oluşturuldu
- **3 yeni domain event:** TeamTemplateAssigned, ExecutionRunStarted, ExecutionRunCompleted
- **TaskStatus ambiguity fix:** CrewOpsTask.cs ve ITaskRepository.cs'e using alias eklendi
- **4 test dosyası yazıldı:** ProjectTests (15), ExecutionRunTests (11), CrewOpsTaskTests (11), ProjectStateMachineTests (56 — Theory dahil)
- **93 test PASSED, 0 fail, 0 error**

### Dosya Değişiklikleri
| Dosya | İşlem |
|-------|-------|
| `src/CrewOps.Domain/Aggregates/Project.cs` | Güncellendi |
| `src/CrewOps.Domain/Aggregates/ExecutionRun.cs` | Yeni |
| `src/CrewOps.Domain/Aggregates/CrewOpsTask.cs` | Fix (using alias) |
| `src/CrewOps.Domain/ValueObjects/TeamTemplate.cs` | Yeni |
| `src/CrewOps.Domain/ValueObjects/TeamRoleSlot.cs` | Yeni |
| `src/CrewOps.Domain/StateMachine/IProjectStateMachine.cs` | Yeni |
| `src/CrewOps.Domain/StateMachine/ProjectStateMachine.cs` | Yeni |
| `src/CrewOps.Domain/DomainEvents/TeamTemplateAssigned.cs` | Yeni |
| `src/CrewOps.Domain/DomainEvents/ExecutionRunStarted.cs` | Yeni |
| `src/CrewOps.Domain/DomainEvents/ExecutionRunCompleted.cs` | Yeni |
| `src/CrewOps.Domain/Ports/ITaskRepository.cs` | Fix (using alias) |
| `tests/CrewOps.Domain.Tests/Aggregates/ProjectTests.cs` | Yeni |
| `tests/CrewOps.Domain.Tests/Aggregates/ExecutionRunTests.cs` | Yeni |
| `tests/CrewOps.Domain.Tests/Aggregates/CrewOpsTaskTests.cs` | Yeni |
| `tests/CrewOps.Domain.Tests/StateMachine/ProjectStateMachineTests.cs` | Yeni |
| `tests/CrewOps.Domain.Tests/UnitTest1.cs` | Silindi |

### Sıradaki İş
- ~~Faz 2: Capabilities Katmanı~~ → **TAMAMLANDI** (aynı oturumda)

---

### Faz 2 Tamamlanan (aynı oturum devamı)
- **CrewOps.Capabilities projesi** oluşturuldu (net10.0, YamlDotNet, ref: CrewOps.Domain)
- **4 model:** SkillManifest, RoleProfile, CapabilityPack, DomainInfo
- **ICapabilityRegistry + InMemoryCapabilityRegistry** — case-insensitive, thread-safe read
- **SkillSourceScanner** — agents-main/plugins/*/skills/*/SKILL.md tarar, YAML frontmatter parse eder
- **RoleProfileLoader** — templates/roles/*.json → V1 formatından V2 RoleProfile'a
- **TeamTemplateLoader** — templates/team-templates/*.json → TeamTemplate
- **6 TeamTemplate JSON:** full-stack-software, backend-api, frontend-spa, marketing-content, seo-optimization, data-analytics
- **22 Capabilities test PASSED** (Scanner, Loader, Registry)
- **Toplam: 115 test (93 Domain + 22 Capabilities), hepsi geçti**

### Faz 3 Tamamlanan (aynı oturum devamı)
- **CrewOps.Infrastructure projesi** oluşturuldu (EF Core SqlServer, MediatR)
- **CrewOpsDbContext** — SaveChangesAsync override ile domain event collect → persist → MediatR publish → clear
- **DomainEventNotification** — IDomainEvent → INotification wrapper
- **3 Entity Configuration:**
  - ProjectConfiguration: GovernancePreset owned entity, State string conversion, IX_Projects_State
  - CrewOpsTaskConfiguration: DependencyIds JSON column, IX_Tasks_ProjectId_Status
  - ExecutionRunConfiguration: CostUsd precision(18,6), IX_ExecutionRuns_TaskId, IX_ExecutionRuns_ProjectId_CreatedAt
- **3 Repository:** ProjectRepository, TaskRepository (GetReadyToRunAsync memory filter), ExecutionRunRepository
- **Docker Compose** — SQL Server 2022 Developer (infra/docker/docker-compose.yml)
- **6 proje build: 0 error, 0 warning**
- **115 test (93 Domain + 22 Capabilities): hepsi geçti**

### Faz 4 Tamamlanan (aynı oturum devamı)
- **AuditEvent entity** (append-only, immutable) + AuditEventType enum (17 tip)
- **IAuditEventRepository** port + EF Core implementasyonu
- **AuditEventConfiguration** — IX_AuditEvents_ProjectId_OccurredAt, IX_AuditEvents_EventType
- **AuditEventPublisher** — MediatR handler, her domain event → AuditEvent → DB (hata safe)
- **ProjectHub** (SignalR) — JoinProjectGroup/LeaveProjectGroup, proje bazlı real-time
- **SignalREventForwarder** — domain event → IHubContext → ilgili proje grubuna push
- **CrewOps.Api projesi** oluşturuldu — Minimal API + Blazor Server + SignalR tek host
- **Program.cs** — DI (DbContext, MediatR, repos, StateMachine), Serilog, SignalR, Blazor
- **6 Blazor dashboard sayfası:**
  1. Dashboard.razor — proje listesi, aktif/tamamlanan/toplam kartlar
  2. ProjectOverview.razor — state machine görünümü, izin verilen geçişler, audit timeline
  3. TaskBoard.razor — görev tablosu (rol, durum, karmaşıklık, dependency, retry)
  4. ExecutionTimeline.razor — yürütme kaydı (süre, token, maliyet)
  5. AgentActivityLog.razor — filtrelenebilir AuditEvent tablosu
  6. Analytics.razor — tamamlanma oranları, model kullanımı, maliyet, rol dağılımı
- **7 proje build: 0 error, 0 warning**
- **115 test: hepsi geçti**

### Faz 5 Tamamlanan (aynı oturum devamı)
- **CrewOps.Contracts** dolduruldu:
  - DTOs: ProjectDto, TaskDto, ExecutionRunDto, AuditEventDto, TeamTemplateDto, RoleSlotDto
  - Commands: CreateProjectCommand, CreateUniversalProjectCommand, AssignTeamTemplateCommand, TransitionProjectCommand
  - Queries: GetProjectByIdQuery, GetProjectsQuery, GetTasksByProjectQuery, GetProjectTimelineQuery, GetRunsByProjectQuery
- **CrewOps.Application** projesi oluşturuldu:
  - DtoMapper (statik, açık mapping — AutoMapper yok)
  - 4 Command Handler: CreateProject, CreateUniversal, AssignTeamTemplate, TransitionProject
  - 5 Query Handler: GetProjectById, GetProjects, GetTasksByProject, GetProjectTimeline, GetRunsByProject
- **5 Minimal API Route dosyası:**
  - ProjectRoutes: CRUD + team-template assign + state transition
  - TaskRoutes, ExecutionRoutes, AuditRoutes, CapabilityRoutes
- **Program.cs** tam entegrasyon: EF Core + MediatR (App+Infra) + Repos + StateMachine + Capabilities (startup scan) + SignalR + Blazor + Serilog
- **8 proje build: 0 error, 0 warning**
- **115 test: hepsi geçti**

### Oturum Genel Özet (2026-04-08)
**5 FAZ TAMAMLANDI — TEK OTURUMDA**

| Faz | İçerik | Dosya Sayısı |
|-----|--------|-------------|
| 1 | Domain Model (Project, ExecutionRun, StateMachine) | 16 |
| 2 | Capabilities (Scanner, Registry, Loaders, 6 JSON) | 17 |
| 3 | Infrastructure (DbContext, Configs, Repos, Docker) | 9 |
| 4 | Observability (AuditEvent, SignalR, 6 Blazor sayfa) | 15 |
| 5 | API & Entegrasyon (Contracts, Application, Routes) | 20 |
| **TOPLAM** | | **~77 dosya** |

**8 proje:** Domain, Contracts, Capabilities, Infrastructure, Application, Api, Domain.Tests, Capabilities.Tests
**115 test:** 93 Domain + 22 Capabilities, hepsi geçti

### Uygulama Ayağa Kaldırıldı ve Test Edildi
- EF Core migration oluşturuldu (`InitialCreate`)
- `CrewOps` DB oluşturuldu (localhost\SQLEXPRESS)
- Uygulama port 5037'de çalıştı
- **Test edilen endpoint'ler:**
  - `GET /api/health` → ✅ `{"status":"healthy"}`
  - `POST /api/projects/universal` → ✅ Marketing projesi oluşturuldu
  - `GET /api/projects` → ✅ Proje listesi döndü
  - `PUT /api/projects/{id}/team-template` → ✅ Marketing Content şablonu atandı
  - `POST /api/projects/{id}/transition` → ✅ New → Discovery geçişi
  - `GET /api/projects/{id}/timeline` → ✅ 2 AuditEvent (TeamTemplateAssigned + StateChanged)
  - `GET /api/team-templates` → ✅ 6 şablon listelendi
  - `GET /api/roles` → ✅ 7 rol listelendi
  - `GET /api/skills` → ✅ 147 skill listelendi

### PM Chat + LLM + Orkestrasyon (aynı oturum devamı)
- LlmClient: multi-provider (Claude/OpenAI/Gemini fallback chain)
- Google Search + Maps Grounding: agent'lar gerçek Google araması yapıyor
- PmAgentService, PlanParser, OrchestrationEngine, LeadParser
- Lead entity + Leads DB tablosu
- PM Chat sayfası (Blazor), proje adı otomatik, linkler tıklanabilir
- Sidebar proje listesi + alt menüler, DbContextFactory concurrency fix
- **Gerçek sonuç:** 8 İstanbul güzellik salonu DB'ye kaydedildi (Google doğrulamalı, site yok)
- Lead parse: code block strip, JSON + tablo formatı, duplicate kontrolü
- Regex fix: greedy quantifier, backtick desteği, blok parse
- Proje adı: PM önerisi veya plan başlığından otomatik kayıt

### DB'deki Gerçek Lead'ler (8 adet)
| Salon | Puan | Yorum | Telefon |
|-------|------|-------|---------|
| Euphoria Beauty Center | 4.8 | 618 | +905461612147 |
| SECRET BEAUTY CENTER / Taksim | 4.8 | 638 | bilinmiyor |
| Alena Güzellik İstanbul | 4.9 | 143 | +905353438265 |
| Cherry Beauty Center | 4.9 | 137 | +902122963436 |
| Merve Sayın Ağda & Güzellik | 4.9 | 177 | +905414976286 |
| DOLU DOLU GÜZELLİK SALONU | 4.8 | 146 | +905389256602 |
| AS Güzellik Salonu | 4.5 | 229 | +902125342476 |
| Arden Beauty | 4.5 | 221 | +902126353955 |

### Tamamlanan Ek İşler
- **LeadVerifier** — Gemini Search ile web sitesi doğrulama (YOK/KÖTÜ/İYİ). 8 lead → 3 sitesiz, 1 iyi siteli çıkarıldı
- **DemoSiteGenerator** — her lead için HTML demo site oluşturma (7 site oluşturuldu)
- **API endpoint'leri:** `/verify-leads`, `/generate-demos`

### Bilinen Sorunlar
- **Demo siteler kalitesiz:** Hepsi aynı tasarım, fotoğraf yok, salon'a özel içerik yok. Satılabilir düzeyde DEĞİL.
- **Lead sayısı az:** Google Search Grounding tek sorguda sınırlı sonuç. İlçe ilçe strateji lazım.
- **Web sitesi doğrulama:** Gemini bazen yanlış "yok" diyor. Places API aktif edilmeli.

### Araştırma Notu
- System Prompts Leaks reposu incelendi (github.com/asgeirtj/system_prompts_leaks, 37.7k ⭐)
- Claude Code, GPT-5 (8 kişilik), Gemini, Grok, Copilot system prompt'ları mevcut
- Memory'ye kaydedildi: `research_system_prompts.md`
- CrewOps agent kişilikleri ve prompt iyileştirme için referans olacak

### Oturum Genel Özet (2026-04-08)

**YAPILAN HER ŞEY — TEK OTURUMDA:**

| Kategori | Detay |
|----------|-------|
| **Altyapı** | 5 faz, ~90 dosya, 8 .NET projesi, 115 test |
| **Domain** | Project, CrewOpsTask, ExecutionRun, ProjectStateMachine (24+ transition, governance shortcuts) |
| **Capabilities** | SkillSourceScanner (147 skill), InMemoryCapabilityRegistry, 6 TeamTemplate JSON |
| **Infrastructure** | EF Core, SQL Server, 4 repository, AuditEvent (append-only), domain event dispatch |
| **API** | 15+ Minimal API endpoint, MediatR CQRS, Serilog |
| **UI** | 8 Blazor sayfa, premium dark theme CSS, sidebar proje listesi, tab navigation |
| **LLM** | Multi-provider (Claude/OpenAI/Gemini fallback), Google Search + Maps Grounding |
| **PM Chat** | Gerçek sohbet, plan çıkarma, otomatik onay → orkestrasyon |
| **Orkestrasyon** | Plan parse → görev oluştur → agent zinciri → sonuç kaydet |
| **Lead Pipeline** | Salon bul → DB kaydet → web sitesi doğrula (YOK/KÖTÜ/İYİ) → demo site oluştur |
| **Sonuç** | 8 gerçek İstanbul güzellik salonu, 7 demo site oluşturuldu |

### 2026-04-08 (devam) — Demo Site + Pipeline İyileştirme

**Yapılan:**
- OrchestrationEngine genişletildi: araştırma → lead kayıt → doğrulama → demo site → pazarlama mesajı (tek akış)
- LeadVerifier: Gemini Search ile web sitesi doğrulama (YOK/KÖTÜ/İYİ)
- DemoSiteGenerator: 2 farklı premium template (fullscreen hero + split hero)
  - Farklı renk temaları (6 renk paleti)
  - Unsplash güzellik fotoğrafları
  - Google Maps embed
  - Responsive, animasyonlu
  - Gemini ile salon'a özel içerik (slogan, hakkımızda, hizmetler, yorumlar)
- Pazarlama mesaj generator: WhatsApp/mail şablonu (Gemini ile)
- 7 demo site oluşturuldu ve test edildi
- Anthropic frontend-design skill incelendi ve prompt'a eklendi

**Değerlendirme:**
- Template yaklaşımı güvenilir ama sıkıcı (sadece renk değişiyor)
- Gemini full HTML yaklaşımı yaratıcı ama token limiti yüzünden kesilme sorunu
- Karar: Lokal LLM (Ollama) ile sınırsız token + yaratıcı HTML üretimi

### Sıradaki İşler (Sonraki Oturum)
**LOKAL LLM (ÖNCELİK 1):**
1. Ollama kur (https://ollama.ai)
2. Model çek: qwen2.5-coder:14b veya llama3.1:8b
3. LlmClient'a Ollama provider ekle (OpenAI uyumlu API)
4. Demo site generation'ı lokal LLM ile yap (sınırsız token)

**DEMO SİTE KALİTESİ:**
5. Lokal LLM ile komple benzersiz HTML üretimi (template'siz)
6. 3-4 farklı layout template (fallback için)
7. Salon'a özel fotoğraf araması

**SİPARİŞ SONRASI PIPELINE (Production):**
8. Demo → Production dönüşümü (domain, hosting)
9. Basit admin panel (içerik güncelleme)
10. Cloudflare Pages deploy otomasyonu
11. Aylık hosting/bakım SaaS modeli

**TEKNİK BORÇ:**
12. Git commit
13. Google Places API aktif et
14. İlçe ilçe arama stratejisi

---

## 2026-04-08
**Odak:** Superpowers + MagicUI entegrasyon planı ve implementasyon

### Araştırma
- **obra/superpowers** (v5.0.7) derinlemesine incelendi: 7-phase workflow, design gate, two-stage review, atomic planning, verification-first, systematic debugging
- **magicuidesign/magicui** (20.6k stars) derinlemesine incelendi: 73 animated component, CSS animation patterns, design system, copy-paste architecture
- CrewOps mevcut yapı analizi yapıldı (agent/skill sistemi, DemoSiteGenerator, LlmClient, Blazor sayfaları)

### Track A Tamamlandı — Superpowers Workflow Adaptasyonu
- 11 agent description → "Use when..." format (Superpowers triggering pattern)
- 4 yeni command oluşturuldu:
  - `/design-gate` — 9 adımlı tasarım keşfi, atom plan, onaysız implementasyon yasak
  - `/review-two-stage` — Stage 1: spec uyumu, Stage 2: kod kalitesi (yanlış kodu cilalamayı önler)
  - `/verify` — 5 adım: Identify → Run → Read → Verify → Claim (kanıtsız iddia yasak)
  - `/debug` — 4 faz: Root Cause → Pattern Analysis → Hypothesis → Implementation
- `/feature-dev` güçlendirildi (atom plan zorunluluğu, placeholder yasak)
- `CLAUDE.md`'ye workflow protokolü eklendi

### Track B Tamamlandı — MagicUI Demo Site Kalite Devrimi
- Animasyon CSS referans dosyası oluşturuldu (13 pattern: marquee, shimmer, border-beam, blur-fade, aurora, retro-grid, meteor, magic-card, glass, typing, pulse, dot-pattern, scroll-reveal)
- **6 premium template** oluşturuldu (eski 2 template'i replace):
  1. **Luxury Dark** — Koyu bg, gold accent, aurora + meteor + glass cards
  2. **Modern Minimal** — Beyaz, temiz, blur-fade text + border-beam + shimmer btn
  3. **Warm Organic** — Toprak tonları, serif, retro grid + overlapping layout
  4. **Bold Gradient** — Canlı gradient'ler, gradient mesh + pulsing borders
  5. **Magazine Editorial** — Büyük tipografi, striped pattern + pull-quote
  6. **Interactive Card** — Card-based, magic card (mouse tracking) + marquee carousel
- **DemoSiteGenerator.cs** güncellendi:
  - Template otomatik tarama (demo-template-*.html pattern)
  - Akıllı template seçimi (puan/yorum/isim bazlı)
  - Renk temaları 6 → 12'ye genişletildi
  - Hero image havuzu 6 → 12'ye genişletildi
  - Eski template'lere fallback desteği
- **Preview endpoint** eklendi: `GET /api/demo-templates/preview?template=luxury&color=0`

### Memory Consolidation
- 3 stale dosya güncellendi (current-state, universal_orchestrator, claude_tooling)
- 1 stale dosya silindi (debugging.md)
- 2 yeni referans eklendi (reference_superpowers.md, reference_magicui.md)
- MEMORY.md index güncellendi

### Diğer
- Groq API key `.env` dosyasına eklendi (GROQ_API_KEY)
- **Build: 0 hata, 0 uyarı. Testler: 115/115 geçti.**

### Dosya Değişiklikleri

| Dosya | İşlem |
|-------|-------|
| `.claude/agents/*.md` (11 dosya) | Description güncellendi |
| `.claude/commands/design-gate.md` | Yeni |
| `.claude/commands/review-two-stage.md` | Yeni |
| `.claude/commands/verify.md` | Yeni |
| `.claude/commands/debug.md` | Yeni |
| `.claude/commands/feature-dev.md` | Güncellendi |
| `CLAUDE.md` | Workflow protokolü eklendi |
| `src/CrewOps.Api/wwwroot/demo-assets/animations.css` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-luxury.html` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-minimal.html` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-organic.html` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-gradient.html` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-editorial.html` | Yeni |
| `src/CrewOps.Api/wwwroot/demo-template-cards.html` | Yeni |
| `src/CrewOps.Api/Services/DemoSiteGenerator.cs` | Güncellendi (6 template, akıllı seçim, 12 renk) |
| `src/CrewOps.Api/Routes/OrchestrationRoutes.cs` | Preview endpoint eklendi |
| `.env` | Groq API key eklendi |

### Groq Entegrasyonu
- `LlmClient.cs`'e `CallGroqAsync` eklendi (OpenAI uyumlu API)
- Default model: `llama-3.3-70b-versatile`
- Akıllı routing: `useWebSearch=true` → Gemini önce, `false` → Groq önce
- `appsettings.json`'a `Groq` bölümü eklendi
- Provider chain: `groq → gemini → claude`

### Pipeline İyileştirmeleri
- **İlçe ilçe arama stratejisi**: OrchestrationEngine'de research-agent için `ExecuteDistrictSearchAsync`
  - Proje adından şehir + ilçe otomatik çıkarılıyor (`ExtractCity`, `ExtractDistricts`)
  - İşletme türü otomatik (`ExtractBusinessType`: diş kliniği, güzellik salonu, restoran, vb.)
  - Her ilçe ayrı Google araması, 3sn rate limit
  - İstanbul, Bursa, Ankara, İzmir, Antalya ilçeleri tanımlı
- **LeadParser güçlendirildi**: Birden fazla JSON bloğu parse, kesilmiş JSON düzeltme (`FixTruncatedJson`), duplicate kontrolü
- **PM Chat API endpoint**: `POST /api/projects/{id}/chat` + `GET /api/projects/{id}/chat` (history)
- **Data cleanup endpoint**: `DELETE /api/projects/cleanup`

### Pipeline Testi — Bursa Diş Klinikleri
- 3 ilçe (Nilüfer, Osmangazi, Yıldırım) × 3 görev = 9 Google araması
- **39 diş kliniği** bulundu
- **24 sitesiz**, 6 kötü siteli, 9 iyi siteli (çıkarıldı)
- **30 demo site** yeni premium template'lerle oluşturuldu
- **21+ pazarlama mesajı** hazırlandı

### Chat & Sidebar İyileştirmeleri
- **Quick action butonları**: Onayla, Detaylandır, Değiştir, Daha Fazla
- **Provider badge**: Aktif LLM provider gösterimi
- **Sidebar proje silme**: 🗑️ buton + cascade delete (leads, runs, tasks, audits)
- **Domain etiketi**: Proje kartında domain gösterimi
- **Hover aksiyonlar**: Proje üzerine gelince 💬 👥 🗑️ aksiyonlar

### Ek Dosya Değişiklikleri

| Dosya | İşlem |
|-------|-------|
| `src/CrewOps.Api/Services/LlmClient.cs` | Groq provider + akıllı routing |
| `src/CrewOps.Api/Services/OrchestrationEngine.cs` | İlçe ilçe arama stratejisi |
| `src/CrewOps.Api/Services/LeadParser.cs` | Multi-JSON parse + truncated fix |
| `src/CrewOps.Api/Routes/ProjectRoutes.cs` | PM Chat API + cleanup + delete |
| `src/CrewOps.Api/Components/Pages/PmChat.razor` | Quick actions + provider badge |
| `src/CrewOps.Api/Components/Layout/MainLayout.razor` | Proje silme + domain etiketi |
| `src/CrewOps.Api/wwwroot/css/chat.css` | Quick action + badge stilleri |
| `src/CrewOps.Api/wwwroot/css/app.css` | Sidebar project actions stili |
| `src/CrewOps.Api/wwwroot/demo-preview.html` | Template preview sayfası |
| `src/CrewOps.Api/appsettings.json` | Groq config eklendi |

### SEO Modülü Planı (sonraki oturum)
- WebsiteProber: Gerçek HTTP kontrolü (HEAD request, SSL, redirect)
- SeoAnalyzer: Meta tag, mobile, h1, img alt, robots.txt, sitemap
- Lead'e SeoScore (0-100) + SeoReport (JSON) alanları
- Akış: Lead Bulma → WebsiteProber → LeadVerifier → SeoAnalyzer → Demo Site → Mesaj
