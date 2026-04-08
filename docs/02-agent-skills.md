# Agent Skills – Yapı ve CrewOps Entegrasyonu

Bu belge [Anthropic Agent Skills Overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) dokümanına dayanır. Skill’lerin çalışma mantığı, dosya yapısı ve CrewOps’a nasıl dahil edileceği özetlenir.

---

## 1. Agent Skills Nedir?

Agent Skills, Claude’un yeteneklerini **modüler paketler** ile genişleten yapılardır. Her Skill:

- **Talimatlar**, **metadata** ve isteğe bağlı **kaynaklar** (script, şablon) içerir.
- Claude tarafından **ilgili olduğunda** otomatik kullanılır.
- **Progressive disclosure** ile yalnızca ihtiyaç duyulan içerik context’e alınır; token tasarrufu sağlanır.

**Faydalar:**

- Claude’u alan odaklı uzmanlaştırma (PDF, API tasarımı, test pattern’leri vb.).
- Aynı rehberi her sohbette tekrar yazmaktan kurtulma.
- Birden fazla Skill’i bir arada kullanarak karmaşık iş akışları oluşturma.

---

## 2. Skill İçeriğinin Üç Seviyesi

| Seviye | Ne zaman yüklenir | Token maliyeti | İçerik |
|--------|-------------------|----------------|--------|
| **1: Metadata** | Her zaman (başlangıçta) | Skill başına ~100 token | YAML frontmatter: `name`, `description` |
| **2: Instructions** | Skill tetiklendiğinde | Genelde &lt;5k token | SKILL.md gövdesi: iş akışları, en iyi uygulamalar |
| **3: Resources** | İhtiyaç halinde | İçerik yüklendiği kadar | Ek .md dosyaları, script’ler, referanslar |

**Progressive disclosure:** Claude önce metadata ile Skill’in varlığını ve ne zaman kullanılacağını bilir; tetiklenince SKILL.md’yi okur; SKILL.md’de referans verilen diğer dosyaları gerektikçe okur veya script’leri çalıştırır.

---

## 3. Skill Dosya Yapısı

Her Skill **bir dizin** ve içinde en az **SKILL.md** içerir:

```
skill-name/
├── SKILL.md          # Zorunlu: frontmatter + ana talimatlar
├── FORMS.md          # Opsiyonel: ek rehber
├── REFERENCE.md      # Opsiyonel: referans
└── scripts/
    └── fill_form.py  # Opsiyonel: çalıştırılabilir script
```

### 3.1. SKILL.md Zorunlu Format

```yaml
---
name: your-skill-name
description: Kısa açıklama ve ne zaman kullanılacağı. Use when ...
---

# Skill Adı

## Talimatlar
[Adım adım rehber]

## Örnekler
[Somut kullanım örnekleri]
```

**Frontmatter kuralları:**

- `name`: Zorunlu; küçük harf, rakam, tire; max 64 karakter; "anthropic", "claude" yasak.
- `description`: Zorunlu; ne yaptığı + ne zaman kullanılacağı; max 1024 karakter.

**description** hem “ne yapar” hem “when to use” içermelidir; böylece Claude doğru anda Skill’i tetikler.

---

## 4. Skill’lerin Çalışma Ortamları

Anthropic dokümanına göre Skill’ler şu yüzeylerde kullanılabilir:

- **Claude API**: Pre-built ve custom Skill’ler; `skill_id` ve code execution container ile.
- **Claude Code**: Sadece **Custom Skill’ler**; dosya sistemi tabanlı (`.claude/skills/` veya plugin).
- **Claude.ai**: Pre-built + custom; custom zip ile yüklenir.
- **Agent SDK**: `.claude/skills/` altında dosya tabanlı.

CrewOps şu an **Claude Code / Gemini CLI** ile tek seferlik prompt gönderdiği için, Skill’leri “CLI’nin dosya sisteminde” değil **CrewOps tarafında** prompt’a enjekte edecek şekilde kullanır (aşağıda).

---

## 5. CrewOps’ta Skill Kullanımı (Entegrasyon Planı)

CrewOps’un mevcut akışı:

- Her koşuda **tek bir büyük prompt** oluşturulur: Rol/Agent + Görev + Hafıza + Task contract + Output contract.
- Bu prompt doğrudan `claude` veya `gemini` CLI’ye verilir; Claude Code’un kendi Skill VM’i veya dosya erişimi kullanılmaz.

Bu yüzden Skill’leri iki şekilde dahil edebiliriz:

### 5.1. Seçenek A: Skill içeriğini prompt’a gömmek

- Seçilen **agent** için ilgili **Skill’leri** (agents-main’deki `plugins/<plugin>/skills/*/SKILL.md`) tespit ederiz.
- Bu Skill’lerin **Level 2 (Instructions)** içeriğini (SKILL.md gövdesi) prompt’un “Skills” bölümüne ekleriz.
- Avantaj: Tek koşuda tüm gerekli bilgi LLM’e gider. Dezavantaj: Token artışı; çok Skill varsa hepsini göndermemek için filtreleme gerekir.

### 5.2. Seçenek B: Sadece Skill metadata’sını göstermek

- Prompt’a yalnızca Skill **name** ve **description** (Level 1) ekleriz.
- “İhtiyaç duyarsan bu Skill’lerin tam talimatlarına şu dosyalardan erişebilirsin” gibi bir not verilebilir; ancak CLI tek seferlik çalıştığı için aynı koşuda dosya okutmak pratikte zor. Bu yüzden CrewOps için **Seçenek A** (seçilmiş Skill gövdelerini prompt’a eklemek) daha uyumludur.

### 5.3. Önerilen uygulama adımları

1. **Agent–Skill eşlemesi**: agents-main’de her plugin’in `plugin.json` veya dizin yapısından hangi skill’lerin hangi agent’a ait olduğu çıkarılır (örn. aynı plugin altındaki `skills/`).
2. **Skill yükleme**: `loadAgent(rootDir, agentId)` gibi bir akışta, o agent’ın plugin’ine ait Skill dizinleri taranır; her biri için `SKILL.md` okunur, frontmatter + body ayrıştırılır.
3. **Prompt’a ekleme**: Rol/Agent gövdesinden sonra “## İlgili Skills” benzeri bir bölümde, seçilen Skill’lerin **gövde** metni (ve gerekirse kısa metadata) eklenir. Token üst sınırı konulabilir (örn. toplam 8k token).
4. **İleride**: Level 3 kaynaklar (ek .md, script) için “bu dosyalara referans verildi” notu eklenebilir; tam içerik eklemek token’a göre opsiyonel hale getirilebilir.

---

## 6. agents-main Skill Dizin Yapısı (Referans)

agents-main’de Skill’ler plugin bazında tutulur:

```
agents-main/plugins/<plugin-name>/
├── agents/           # Agent .md dosyaları
├── commands/         # Slash komutları
└── skills/           # Skill dizinleri
    ├── skill-name-a/
    │   └── SKILL.md
    └── skill-name-b/
        └── SKILL.md
```

CrewOps’ta `agentCatalog` şu an sadece `agents/*.md` tarıyor. Skill entegrasyonu için aynı plugin altındaki `skills/*/SKILL.md` okunacak ve agent’a bağlanacak şekilde genişletilebilir (bkz. [07-work-plan-and-roadmap.md](07-work-plan-and-roadmap.md)).

---

## 7. Özet

- **Agent Skills**: Metadata (her zaman) + Instructions (tetiklenince) + Resources (ihtiyaç halinde); progressive disclosure ile token verimliliği.
- **Dosya yapısı**: Skill dizini + zorunlu `SKILL.md` (YAML frontmatter + gövde).
- **CrewOps**: CLI tek-seferlik çalıştığı için Skill’leri prompt içine (Level 2 Instructions) ekleyerek kullanmak hedeflenir; agent–skill eşlemesi ve token bütçesi roadmap’e alınmıştır.

Resmi detaylar: [Agent Skills Overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).
