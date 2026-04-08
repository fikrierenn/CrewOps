# Agent Teams ve Subagents (Claude Code Resmi Yapısı)

Bu belge, [Claude Code – Subagents](https://code.claude.com/docs/en/sub-agents) ve [Claude Code – Agent Teams](https://code.claude.com/docs/en/agent-teams) dokümantasyonuna göre yapıyı özetler. Uydurma yok; tamamen resmi dokümana dayanır.

---

## Subagents vs Agent Teams

| | Subagents | Agent Teams |
|--|-----------|-------------|
| **Bağlam** | Tek oturum; kendi context penceresi, sonuç ana agent’a döner | Her teammate ayrı Claude Code **oturumu**; tam bağımsız |
| **İletişim** | Sadece ana agent’a rapor | Teammate’lar birbirine **doğrudan mesaj** atar |
| **Koordinasyon** | Ana agent tüm işi yönetir | **Ortak task listesi** + kendi aralarında koordinasyon |
| **En uygun** | Sadece sonucun önemli olduğu odaklı işler | Tartışma, birbirini zorlama ve işbirliği gerektiren karmaşık iş |
| **Token maliyeti** | Daha düşük (sonuç özetlenir) | Daha yüksek (her teammate ayrı instance) |

- **Subagents**: Hızlı, odaklı çalışanlar; sadece sonucu döndürür. Tek oturumda çalışır.
- **Agent teams**: Teammate’lar birbirleriyle konuşur, task paylaşır, kendi kendine koordinasyon yapar. Birden fazla oturum (her teammate bir Claude Code instance).

Kaynak: [Agent teams – Compare with subagents](https://code.claude.com/docs/en/agent-teams#compare-with-subagents).

---

## Subagents (Tek Oturum)

- **Tanım**: Belirli iş türleri için özelleşmiş yardımcılar. Kendi system prompt’u, tool erişimi ve izinleri var.
- **Ne zaman kullanılır**: Araştırma, planlama, kod incelemesi gibi işler ana sohbetten ayrılsın; sadece özet/sonuç ana agent’a dönsün.
- **Konumlar** (öncelik sırasıyla):
  1. `--agents` CLI flag (sadece o oturum)
  2. **Proje**: `.claude/agents/` (versiyon kontrolüne girebilir)
  3. **Kullanıcı**: `~/.claude/agents/` (tüm projelerde)
  4. Plugin’in `agents/` dizini

CrewOps’taki roller (PM, ARCH, SQL, BACKEND, FRONTEND, QA, DEVOPS) **proje seviyesinde subagent** olarak bu repoda `.claude/agents/` altında tanımlıdır. Format: Markdown + YAML frontmatter; `name`, `description` zorunlu; `tools`, `model`, `permissionMode` vb. opsiyonel.

---

## Agent Teams (Çoklu Oturum)

- **Açma**: Varsayılan kapalı. Açmak için:
  - Ortam değişkeni: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
  - veya `settings.json`: `{"env": {"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"}}`
- **Bileşenler**:
  - **Team lead**: Takımı kuran, teammate’ları spawn eden, işi dağıtan ana oturum.
  - **Teammate’lar**: Ayrı Claude Code instance’ları; her biri kendi context’inde çalışır.
  - **Task list**: Ortak görev listesi; pending / in progress / completed; bağımlılıklar var.
  - **Mailbox**: Agent’lar arası mesajlaşma.
- **Saklama**:
  - Takım config: `~/.claude/teams/{team-name}/config.json`
  - Task list: `~/.claude/tasks/{team-name}/`
- **Görüntü**:
  - **In-process**: Tüm teammate’lar aynı terminalde; Shift+Up/Down ile seçip doğrudan mesaj.
  - **Split panes**: Her teammate ayrı pane (tmux veya iTerm2 gerekir).
- **Delegate mode**: Lead sadece koordinasyon yapar (spawn, mesaj, task, kapatma); Shift+Tab ile açılır.

CrewOps TUI’deki “roller” ve “görevler” kavramı, agent teams’teki **teammate tipleri** ve **task list** ile kavramsal olarak uyumludur; ancak Claude Code’un yerel agent teams’i ayrı oturumlar açar, bizim runner’ımız ise tek `claude` çağrısıyla tek rol çalıştırır.

---

## Bu Repodaki Eşleme

- **`templates/roles/*.json`**: CrewOps’un rol tanımları (TUI, workflow, prompt kompozisyonu için).
- **`.claude/agents/*.md`**: Aynı rollerin Claude Code **subagent** formatında kopyası; bu repoda `claude code` veya `claude run` kullanırken Claude’un otomatik delegate etmesi için.
- **Agent team kullanımı**: Bu repoda doğrudan Claude Code’u açıp “Create an agent team with a PM, an architect and a backend teammate…” gibi doğal dille takım kurulur; teammate tipleri için `.claude/agents/` altındaki açıklamalar rehber niteliğindedir (Claude Code’un kendi team spawn mantığı vardır).

Özet: **Subagents** = tek oturum, rol bazlı delegate (`.claude/agents/`). **Agent teams** = çoklu oturum, lead + teammate’lar + ortak task list; deneysel flag ile açılır.
