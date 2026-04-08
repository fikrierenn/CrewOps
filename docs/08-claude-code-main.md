# claude-code-main Klasörü

Bu belge, CrewOps repo kökündeki **claude-code-main** klasörünün ne olduğunu, yapısını ve CrewOps ile ilişkisini özetler.

---

## 1. Ne İşe Yarar?

**claude-code-main**, [Claude Code](https://code.claude.com/docs/en/overview) ürününün resmî GitHub deposunun (anthropics/claude-code) bir kopyası veya referans sürümüdür. Claude Code, terminalde çalışan, kod tabanını anlayan ve doğal dil komutlarıyla görev yapan bir “agentic coding” aracıdır.

Bu klasördeki içerik **çalışma zamanında zorunlu değildir**: CrewOps, kurulu `claude` CLI’yı çağırır; plugin’ler kullanıcının kendi Claude Code kurulumunda (ör. `~/.claude` veya proje `.claude`) yapılandırılır.

**Asistan (AI) kullanımı:** agents-main’e veya CrewOps plugin’lerine yeni **agent** veya **skill** eklerken / düzenlerken resmî format referansı **claude-code-main**’dir. Asistan bu klasördeki örneklere bakarak (örn. `plugins/pr-review-toolkit/agents/*.md`, `plugins/plugin-dev/skills/*/SKILL.md`, `plugins/README.md`) frontmatter, dizin yapısı ve gövde formatını uygular; kullanıcının manuel bakması gerekmez.

---

## 2. Dizin Yapısı

```
claude-code-main/
├── README.md              # Claude Code tanıtımı, kurulum, plugin listesi
├── plugins/               # Resmî Claude Code plugin’leri
│   ├── README.md          # Plugin’lerin listesi ve standart yapı açıklaması
│   ├── agent-sdk-dev/     # Agent SDK geliştirme
│   ├── claude-opus-4-5-migration/
│   ├── code-review/
│   ├── commit-commands/
│   ├── explanatory-output-style/
│   ├── feature-dev/
│   ├── frontend-design/
│   ├── hookify/
│   ├── learning-output-style/
│   ├── plugin-dev/        # Plugin geliştirme toolkit’i (skills, agents, commands)
│   ├── pr-review-toolkit/
│   ├── ralph-wiggum/
│   ├── security-guidance/
│   └── ...
└── scripts/               # Repo bakım script’leri (GitHub issue lifecycle, sweep, duplicate)
                           # Claude Code çalışma zamanı ile ilgili değil
```

---

## 3. Plugin Yapısı (Resmî Format)

Her plugin standart bir dizin yapısına uyar (plugins/README.md ve plugin-dev skill’lerinde anlatılır):

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Zorunlu: name, version, description, author
├── commands/              # Slash komutları (.md)
├── agents/                # Subagent tanımları (.md; YAML frontmatter: name, description, model, color)
├── skills/                # Agent Skills (her biri alt dizinde)
│   └── skill-name/
│       └── SKILL.md       # YAML frontmatter (name, description, version) + gövde
├── hooks/
│   └── hooks.json         # Event tanımları (PreToolUse, SessionStart, Stop vb.)
│   └── *.py | *.sh        # Hook script’leri
├── .mcp.json              # Opsiyonel: MCP sunucu tanımları
├── scripts/                # Yardımcı script’ler
└── README.md
```

- **commands/**: Kullanıcının `/komut-adı` yazınca tetiklenen rehberler.
- **agents/**: Subagent’lar; Claude’un belirli işler için “Task” ile delegate ettiği uzmanlar (name, description, model, gövde).
- **skills/**: Agent Skills; SKILL.md ile progressive disclosure (metadata → instructions → resources). Detay: [02-agent-skills.md](02-agent-skills.md).
- **hooks/**: Belirli olaylarda (ör. PreToolUse, SessionStart) çalışan script’ler; örn. güvenlik uyarısı, eğitimsel metin enjeksiyonu.

---

## 4. agents-main ile Fark

| | claude-code-main | agents-main |
|--|------------------|-------------|
| **Kaynak** | Claude Code resmî repo (Anthropic) | Ayrı/ topluluk plugin kataloğu (CrewOps’ta kullanılan) |
| **CrewOps’ta rolü** | Referans: plugin/agent/skill formatı, dokümantasyon | **Aktif kullanım**: `agentCatalog` buradan agent listeler ve yükler; prompt’a eklenir |
| **Konum** | `claude-code-main/` | `agents-main/` (veya CREWOPS_AGENTS_PATH) |
| **Çalışma zamanı** | CrewOps doğrudan bu klasörü okumaz | CrewOps API ve core `listAgents` / `loadAgent` ile okur |

Özet: **agents-main** CrewOps’un “hangi agent’ları rol olarak sunacağı” için kullandığı katalog; **claude-code-main** resmî plugin/skill/agent yapısını incelemek ve dokümante etmek için referans.

---

## 5. CrewOps ile İlişki

- **CLI**: CrewOps, koşu başlatırken kullanıcı sisteminde kurulu `claude` (veya `gemini`) komutunu çalıştırır. claude-code-main klasörü bu çağrıda kullanılmaz.
- **Plugin yükleme**: Plugin’ler kullanıcının Claude Code kurulumu veya proje `.claude` ayarları ile yönetilir; CrewOps bu klasörden otomatik plugin yüklemez.
- **Dokümantasyon / uyumluluk**: Agent ve Skill formatı (YAML frontmatter + markdown gövde) agents-main ve claude-code-main’de benzerdir; CrewOps’taki `agentCatalog` ve ileride Skill entegrasyonu bu ortak formatı hedefler.

---

## 6. Özet

- **claude-code-main**: Claude Code’un resmî repo kopyası; içinde resmî plugin’ler (commands, agents, skills, hooks) ve repo bakım script’leri var.
- **CrewOps’ta**: Referans amaçlı; çalışma zamanında zorunlu değil. Agent/skill yapısı agents-main ve buradaki örneklerle uyumlu tutulabilir.
- **agents-main**: CrewOps’un gerçekten taradığı ve prompt’a eklediği agent kataloğu; claude-code-main ise “resmî format ve örnekler” kaynağıdır.

Resmî dokümantasyon: [Claude Code Overview](https://code.claude.com/docs/en/overview), [Plugins](https://docs.claude.com/en/docs/claude-code/plugins).
