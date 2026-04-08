# CrewOps - AI Takım Orkestratörü

## Proje Nedir?
PM-first, onay-yönetimli, evrensel AI takım orkestratörü. Kullanıcı SADECE PM ile konuşur, seçilen domain'e göre (yazılım, pazarlama, SEO, blog, finans vb.) agent takımı oluşturulur ve işi halleder.

## Tech Stack
- **V2 (aktif geliştirme):** .NET 10, C# 13, ASP.NET Core Minimal API, Blazor Server, SQL Server, EF Core, MediatR, Serilog, SignalR
- **V1 (referans, çalışır durumda):** Node.js, TypeScript, Express, React/Vite, SQLite
- **Test:** xUnit + FluentAssertions

## Repo Yapısı
```
src/                          ← V2 .NET projeleri
  CrewOps.Domain/             → Aggregates, value objects, state machine, ports
  CrewOps.Contracts/          → DTOs, commands, queries (no logic)
  CrewOps.Capabilities/       → CapabilityRegistry, SkillSourceScanner, RoleProfile
apps/                         ← V1 Node.js (referans)
packages/                     ← V1 shared libraries
agents-main/plugins/          ← 74 plugin, 112 agent, 147 skill (SkillSourceScanner kaynağı)
templates/                    ← Rol JSON'ları, output contract'lar, team template'ler
docs/                         ← 17+ planlama belgesi
tests/                        ← V2 unit testler
```

## Mimari Kurallar

### DDD & CQRS
- Domain katmanı saf: dış bağımlılık yok, persistence-ignorant
- State geçişleri yalnızca ProjectStateMachine üzerinden
- Domain event'ler transient — dispatch sonrası temizlenir
- MediatR ile command/query ayrımı

### Universal Orchestrator
- **TeamTemplate**: Domain-specific takım şablonu (roller + governance + output type)
- **GovernancePreset**: Hangi state'lerin erişilebilir olduğunu belirler (pazarlama → staging atlanır)
- **OutputType**: CodePatch | Document | Analysis | Plan
- **SkillSourceScanner**: agents-main/ dizinini tarar, YAML frontmatter parse eder
- RoleId her zaman string — dinamik roller için hazır

### ModelTier
- Operational → Haiku (rutin, düşük risk)
- Complex → Sonnet (orta karmaşıklık)
- Critical → Opus (mimari, güvenlik, kritik karar)

### Dil Kuralı
- Teknik isimler (class, method, property, enum): İngilizce
- XML doc comments, UI metinleri, açıklamalar: Türkçe
- Commit mesajları: Türkçe veya İngilizce (karışık OK)

## Kodlama Standartları

### C# Conventions
- File-scoped namespaces
- Primary constructors tercih edilir (record'lar için)
- `sealed` class default
- `ArgumentException.ThrowIfNullOrWhiteSpace()` validation
- `IReadOnlyList<T>` external exposure, `List<T>` internal
- Private parameterless constructor for EF Core
- Factory method pattern (static Create/CreateXxx)

### Test Conventions
- xUnit + FluentAssertions
- Test method naming: `MethodName_Scenario_ExpectedResult` (Türkçe açıklama OK)
- Arrange-Act-Assert pattern
- Her aggregate için ayrı test class

## Önemli Dosyalar
| Dosya | Açıklama |
|-------|----------|
| `docs/IMPLEMENTATION_PLAN.md` | 5 fazlı implementasyon planı |
| `docs/CAPABILITY_MODEL.md` | CapabilityPack, RoleProfile, WorkflowBundle şemaları |
| `docs/WORKFLOW_STATE_MACHINE.md` | Tüm state geçiş kuralları |
| `docs/TARGET_ARCHITECTURE.md` | V2 hedef mimari |
| `docs/MVP_SCOPE.md` | MVP sınırları |
| `docs/GOVERNANCE_MODEL.md` | Onay kapıları ve risk değerlendirmesi |

## Geliştirme Workflow Protokolü

### Feature Geliştirme
1. `/design-gate` — 9 adımlı tasarım keşfi, atom plan, kullanıcı onayı
2. `/feature-dev` — Onaylanan plan'ı domain-first sırada implemente et
3. `/review-two-stage` — Stage 1: spec uyumu, Stage 2: kod kalitesi
4. `/verify` — Her teknik iddiayı kanıtla (build, test, endpoint)

### Bug Fix
1. `/debug` — 4 fazlı sistematik debugging (root cause → fix)
2. `/tdd-cycle` — Failing test yaz → fix → doğrula
3. `/verify` — Fix'in çalıştığını kanıtla

### Kurallar
- Kanıtsız iddia YASAK — "should work" yerine `/verify` çalıştır
- Tasarımsız implementasyon YASAK — `/design-gate` ile başla
- Yanlış kodu cilalama — `/review-two-stage` ile önce spec kontrolü

## Session Yönetimi
- Her oturumun başında `docs/SESSION_LOG.md` dosyasını oku, nerede kaldığını anla
- Her oturumun sonunda (veya önemli milestone'larda) SESSION_LOG.md'ye tarih + yapılanlar + kalan işler yaz
- Session düşse bile bir sonraki oturum bu dosyadan devam edebilmeli
- Format: `## YYYY-MM-DD` başlığı altında maddeler

## Yapma
- Domain katmanına infrastructure bağımlılığı ekleme
- Enum yerine string kullanma (ProjectState, TaskStatus, ModelTier enum kalacak)
- State geçişini aggregate'in dışından yapma — her zaman StateMachine üzerinden
- V1 kodunu silme veya bozma — referans olarak kalacak
- agents-main/ içeriğini değiştirme — read-only kaynak
