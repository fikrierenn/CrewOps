# Yöntem Kaynakları ve Çeviri

Bu belge, referans repository incelemesinin sonuçlarını kayıt altına alır. Her referans için: ne öğrenildi, ne benimsendi/adapte edildi/reddedildi ve her yararlı yöntemin CrewOps'a özgü kavramlara nasıl çevrildiği açıklanır.

**Temel ilke**: CrewOps bu sistemleri kopyalamaz. En güçlü yöntemlerini kendi domain'ine çevirir.

---

## Referans Repository 1: OpenHands

**URL:** https://github.com/All-Hands-AI/OpenHands

### OpenHands Nedir

Otonom yazılım geliştirmeye odaklanmış bir AI agent orkestrasyon platformu. Çekirdeği olay-tabanlı bir state machine'dir: agent'lar eylem üretir, bir controller bunları runtime ortamına gönderir, gözlemler event olarak geri akar. Birden fazla LLM, uzak yürütme ortamları ve çok-ajan delegasyonu desteklenmektedir.

### OpenHands'in İyi Yaptıkları

1. **Tipli action/observation modeli** — Agent ile ortam arasındaki her etkileşim tipli bir event. Bu, katmanlar arası açık sözleşmeleri zorunlu kılar.
2. **Net semantikli state machine** — `RUNNING`, `AWAITING_USER_INPUT`, `FINISHED`, `PAUSED` gibi durumlar açık ve denetlenebilir.
3. **Execution engine / product surface ayrımı** — Composable SDK tasarımı, execution motoru product arayüzünden tamamen bağımsız.
4. **Çoklu LLM backend** — `ILlmClient` benzeri soyutlama, provider değişimini mümkün kılar.
5. **Workspace izolasyonu** — Her agent session kendi izole çalışma alanında (Docker container veya sandbox) çalışır.
6. **Action confirmation ve güvenlik politikası** — Bazı eylemler insan onayı gerektirir; bu politika konfigürasyona dayalı.
7. **Duraksatılabilir ve sürdürülebilir yürütme** — Session'lar duraklatılıp kaldığı yerden devam ettirilebilir.
8. **Context condensation** — Uzun çalışan iş akışlarında bağlam özetlenerek context limiti yönetilir.

### Benimsenenler → CrewOps Çevirisi

| OpenHands Yöntemi | CrewOps Çevirisi | Nerede |
|-------------------|-----------------|--------|
| Execution engine / product surface ayrımı | `IExecutionWorker` arayüzü — worker ≠ platform | `CrewOps.Execution` |
| Tipli action/observation modeli | `ExecutionRequest` / `TaskObservation` tipleri | `CrewOps.Contracts` |
| Workspace izolasyonu per session | `WorkspaceManager` — run başına izole çalışma dizini | `CrewOps.Execution` |
| Action confirmation policy | `ApprovalGate` mekanizması — governance katmanında | `CrewOps.Governance` |
| Duraksatılabilir/sürdürülebilir yürütme | `OrchestrationLoop.Pause()` / `Resume()` + DB state | `CrewOps.Orchestration` |
| Context condensation | `ContextAssembler` — tier bazlı yükleme + özetleme | `CrewOps.Capabilities` |
| ILlmClient soyutlaması | `ILlmClient` port interface | `CrewOps.Application` |

### Reddedilenler

| OpenHands Özelliği | Red Gerekçesi |
|-------------------|---------------|
| Docker containerization | CrewOps yerel-first; V2.0 için temp directory izolasyonu yeterli |
| Python SDK | CrewOps .NET 10 ekosistemi seçti |
| Tam otonom agent loop | CrewOps her approval gate'de insan kontrolü ister |
| OpenHands cloud deployment modeli | CrewOps yerel kurulum öncelikli |

---

## Referans Repository 2: wshobson/agents

**URL:** https://github.com/wshobson/agents

### wshobson/agents Nedir

Claude Code için kapsamlı bir agent, skill ve workflow sistemi: 112 özelleşmiş AI agent, 16 çok-ajan workflow orkestratorü, 146 skill ve 79 geliştirme aracı — 72 odaklanmış, tek amaçlı plugin içinde organize edilmiş.

### wshobson/agents'in İyi Yaptıkları

1. **3 katmanlı progressive disclosure** — Metadata (her zaman yüklü) → Instructions (aktivasyonda) → Resources (talep üzerine). Token verimliliği kritik avantaj.
2. **Odaklanmış tek-amaçlı plugin'ler** — Her plugin bir problemi çözer (~3.4 bileşen/plugin ortalaması). Şişirilmiş "her şeyi yapan" agent'lardan kaçınılır.
3. **Stratejik model ataması** — Opus kritik/karmaşık iş için, Sonnet orta karmaşıklık, Haiku operasyonel görevler. Model seçimi bilinçli.
4. **Çok-ajan workflow orkestratorleri** — 16 pre-built multi-agent workflow (tam-stack geliştirme, güvenlik hardening, incident response).
5. **Katkılar arası kategorizasyon** — 24 kategori: dil uzmanları, altyapı, domain uzmanları, kalite güvence.
6. **Rol bazlı uzmanlaşma** — Her agent belirli bir role odaklanır (Python expert, Kubernetes architect, security auditor).

### Benimsenenler → CrewOps Çevirisi

| wshobson Yöntemi | CrewOps Çevirisi | Nerede |
|-----------------|-----------------|--------|
| 3 katmanlı progressive disclosure | `SkillManifest.Tier` enum: `Metadata` / `Instructions` / `Resources` | `CrewOps.Capabilities` |
| Odaklanmış tek-amaçlı plugin'ler | `CapabilityPack` — tek domain, net sorumluluk | `CrewOps.Capabilities` |
| Stratejik model ataması | `ModelTier` enum: `Critical` / `Complex` / `Operational` | `CrewOps.Domain` |
| Multi-agent workflow orkestratorü | `WorkflowBundle` — tekrarlanabilir delivery playbook | `CrewOps.Capabilities` |
| Kategori bazlı agent organizasyonu | `CapabilityPack.Domain` alanı — domain etiketleme | `CrewOps.Capabilities` |
| Rol bazlı uzmanlaşma | `RoleProfile` — her rol için kabiliyet seti | `CrewOps.Capabilities` |

### Reddedilenler

| wshobson Özelliği | Red Gerekçesi |
|-------------------|---------------|
| Community marketplace dağıtımı | CrewOps internal governance gerekli; açık marketplace V2.1+ |
| Claude Code subagent orchestration | CrewOps kendi orchestration loop'una sahip |
| 146 skill'in tamamı | V2.0 MVP'de 7 built-in rol yeterli; tam katalog V2.1 |

---

## Referans Repository 3: davila7/claude-code-templates

**URL:** https://github.com/davila7/claude-code-templates

### davila7/claude-code-templates Nedir

Anthropic'in Claude Code aracı için hazır kullanımlı konfigürasyonlar koleksiyonu. AI agent'ları, özel komutlar, ayarlar, hook'lar, harici entegrasyonlar (MCP) ve proje şablonları sağlar.

### davila7/claude-code-templates'in İyi Yaptıkları

1. **6 farklı capability tipi** — Agents, Commands, MCPs, Settings, Hooks, Skills. Bu sınıflandırma konfigürasyon çakışmalarını önler.
2. **NPM-tabanlı kurulabilir paketler** — İndirme sürtünmesini azaltır; standart dağıtım.
3. **Web-first discovery dashboard** — Web üzerinden göz atma, sonra kurulum.
4. **Attribution-aware aggregation** — Lisans ve kaynak takibi; topluluk güveni.
5. **Hiyerarşik isimlendirme** — `development-team/frontend-developer` gibi namespace netliği.
6. **Diagnostics metadata** — Her capability için sağlık kontrol bilgisi.

### Benimsenenler → CrewOps Çevirisi

| davila7 Yöntemi | CrewOps Çevirisi | Nerede |
|-----------------|-----------------|--------|
| 6 capability tipi sınıflandırması | `CapabilityRegistry` tipolojisi (agents/skills/workflows/templates/commands/tools) | `CrewOps.Capabilities` |
| Hiyerarşik isimlendirme | `CapabilityPack.QualifiedName` = `{domain}/{role}` formatı | `CrewOps.Capabilities` |
| ProjectBootstrapPack konsepti | `ProjectBootstrapPack` — proje tipi bazlı varsayılanlar | `CrewOps.Capabilities` |
| Diagnostics metadata | `CapabilityDiagnostics` — her pack için sağlık durumu | `CrewOps.Observability` |
| Attribution-aware aggregation | `CapabilityPack.Attribution` alanı — kaynak ve lisans takibi | `CrewOps.Capabilities` |
| Discovery/browse önce kurulum | V2.1 Capabilities yönetim UI | `CrewOps.Web` |

### Reddedilenler

| davila7 Özelliği | Red Gerekçesi |
|------------------|---------------|
| NPM dağıtımı | CrewOps kapalı sistem; paket dağıtımı kapsam dışı |
| Harici community katkıları | CrewOps internal capability governance önce gelir |
| CLI kurulum aracı | CrewOps capability'leri startup'ta file scan ile yüklenir |

---

## Çeviri Manifestosu

Yukarıdaki tablolar, CrewOps'un bu sistemleri kopyalamadığını açıkça gösteriyor. Her yöntem:

1. **Bağlamdan çıkarılır** — Kaynak sistemin tüm tasarım kararları değil, sadece yararlı yöntem alınır
2. **CrewOps domain'ine çevrilir** — Yabancı terminoloji doğrudan kullanılmaz
3. **Governance önceliği korunur** — Otonom davranışa izin veren herhangi bir yöntem reddedilir veya governance ile sarılır
4. **PM-first ilkesi korunur** — Kullanıcı SADECE PM ile konuşur; referans sistemlerdeki doğrudan agent erişimi modeli benimsenmez

### Hangi Kavramlar CrewOps Adını Korur

| Yabancı Terim | CrewOps Terimi | Gerekçe |
|---------------|---------------|---------|
| "Agent" | `RoleProfile` | Rol vurgusu daha doğru — agent çok genel |
| "Plugin" | `CapabilityPack` | Paket içeriği (yetenekler) daha açıklayıcı |
| "Skill" | `SkillManifest` | Manifest vurgusu — sadece tanım, yürütme değil |
| "Session" | `ExecutionRun` | Run sınırları daha net |
| "Workspace" | `ExecutionWorkspace` | Execution bağlamı vurgusu |
| "Observation" | `TaskObservation` | Task bağlamı ile bağlantılı |
| "Approval" | `ApprovalGate` | Gate metaforu — engelleyici kontrol |
| "Agreement" | `Agreement` + `[MUTABAKAT_HAZIR]` | CrewOps domain dili — Türkçe marker korunur |

---

*Son güncelleme: 2026-03-08*
