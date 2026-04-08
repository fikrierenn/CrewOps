## CrewOps – AI Team Orchestrator (MVP)

CrewOps, **çok-ajanlı yazılım süreçlerini yöneten orkestrasyon arayüzüdür**: agent kataloglarını (ör. agents-main) besleyen, roller ve görevleri yöneten, Claude Code ve Gemini CLI ile çalışan tek merkez. Terminal tabanlı, Claude Code destekli, rol bazlı (PM/ARCH/SQL/BACKEND/FRONTEND/QA/DEVOPS) bir “AI Team Orchestrator” MVP’sidir.

**Proje dokümantasyonu** (yapı, katmanlar, Agent Skills, run pipeline, sözleşmeler): **[docs/00-overview.md](docs/00-overview.md)** — buradan tüm MD dokümanlarına erişilir.

Tamamen yerel çalışır, SQLite + dosya sistemi kullanır ve Guarded Mode ile patch'leri asla otomatik uygulamaz.

### Kurulum

1. Gerekli araçlar:
   - Node.js 18+ (Windows 10+ üzerinde test edilmeli)
   - Git (patch uygulamak için)
   - `claude-code` CLI (PATH içinde olmalı)

2. Bağımlılıkları yükleyin:

```bash
npm install
```

### Çalıştırma

**Yönetim arayüzü (önerilen):** Ekranınız terminal olmadan, tarayıcıda formlar ve listelerle yönetim; "Başla" dediğinizde çıktı sayfa içindeki gömülü konsolda canlı akar.

1. API sunucusunu başlatın (monorepo kökünden):

```bash
npm run dev:api
```

2. Başka bir terminalde web arayüzünü başlatın:

```bash
npm run dev:web
```

3. Tarayıcıda http://localhost:3000 açın. Projeler, görevler, roller, hafıza ve geçmiş buradan yönetilir. Bir görevi çalıştırmak için **Görevler** sayfasında **Başla** butonuna basın: **Claude Code yeni açılan bir terminal penceresinde** çalışır; çıktı orada canlı görünür. İş bittiğinde terminaldeki script API'ye haber verir ve görev durumu güncellenir.

**Terminal TUI (isteğe bağlı):** Eski akış için Ink tabanlı TUI:

```bash
npm run dev
```

Bu komut, `apps/orchestrator` içinde Ink tabanlı TUI uygulamasını çalıştırır.

### Temel Akış

1. **Project ekleme / seçme**
   - TUI açıldığında `2` ile **Projects** ekranına geçin.
   - Yeni proje eklemek için:
     - `a` tuşuna basın.
     - Şu formatta değer girin ve Enter'a basın:
       - `name|absoluteRepoPath|stack`
       - Örnek: `CrewOps MVP|D:\Dev\CrewOps|node+ink+sqlite`
   - Proje seçmek için:
     - `s` tuşuna basın.
     - Proje ID'sini yazıp Enter'a basın (örn. `1`).

2. **Rolleri Yükleme**
   - `3` ile **Roles** ekranına geçin.
   - Rol tanımları `templates/roles/*.json` içindedir.
   - `r` ile şablonları diskten tekrar yükleyebilir, `i` ile aktif proje için bu şablonları DB'ye import edebilirsiniz.

3. **Görev oluşturma**
   - `4` ile **Tasks** ekranına geçin.
   - Yeni görev için:
     - `a` tuşuna basın.
     - Şu formatta girin:
       - `title|description|roleId|complexity(simple|medium|complex)|dependencyIdsCsv`
       - Örnek self-test:
         - `Self test sandbox|Sandbox klasörüne dummy dosya oluştur|backend|simple|`
   - Görev seçmek için:
     - `s` tuşuna basın.
     - Görev ID'sini yazıp Enter'a basın.

4. **Hafıza dosyaları**
   - Zorunlu dosyalar: `memory/NOW.md`, `memory/DECISIONS.md`, `memory/ARCH_SHORT.md`.
   - Eksikse:
     - `7` ile **Memory** ekranına geçin.
     - `c` tuşuna basarak varsayılan hafıza dosyalarını oluşturun.
   - Bu üç dosya, her rol koşumunda prompt'a eklenir (token-minimal hafıza).

5. **Görev çalıştırma (claude-code)**
   - `5` ile **Run** ekranına geçin.
   - Seçili görev tüm bağımlılıkları tamamlanmışsa:
     - `r` tuşuna basarak `claude-code` koşusunu başlatın.
   - Orchestrator:
     - Rol bilgisini ve görev açıklamasını birleştirir.
     - `memory/NOW.md`, `DECISIONS.md`, `ARCH_SHORT.md` içeriklerini prompt'a ekler.
     - `templates/task_contract.md` ve `templates/output_contract.md` sözleşmelerini ekler.
     - `claude-code run --model ... --file <prompt> --cwd <repoPath>` komutunu çalıştırır.
     - `stdout` çıktısını **sıkı çıktı sözleşmesine göre** parse eder.
     - Sonucu `runs`, `artifacts` ve `cost_ledger` tablolarına yazar.

6. **Review & Guarded Mode ile Patch uygulama**
   - Çıktı içinde `PATCH:` bölümü boş değilse:
     - TUI otomatik olarak `5` yani **Review** ekranına geçer.
     - PATCH içeriğinin ilk satırlarını ve `FILES_CHANGED` listesini gösterir.
     - Patch **hiçbir zaman** otomatik uygulanmaz.
   - Kullanıcı olarak:
     - Patch'i uygulamak için `y` tuşuna basın.
       - Orchestrator, patch'i geçici bir `.diff` dosyasına yazar.
       - İlgili projenin `repoPath` dizininde `git apply <patchPath>` çalıştırır.
     - Red etmek için `n` tuşuna basın.
       - Patch uygulanmaz; sadece artefact olarak disk ve DB'de kalır.

7. **History & Artefact'lar**
   - `7` ile **History** ekranına geçerek son 20 koşuyu görebilirsiniz.
   - Detaylı raw output, parse edilmiş JSON ve patch dosyaları:
     - `artifacts/project-<pid>/task-<tid>/run-<rid>/` altında tutulur.

### Self-Test Görevi Önerisi

İlk uçtan uca testi yapmak için şu tarz bir görev tanımı kullanabilirsiniz:

- Proje repo yolu: bu monorepo'nun kökü (`D:\Dev\CrewOps` vb.).
- Görev:
  - Başlık: `Self test sandbox`
  - Açıklama: `Bu görevde, repo kökünde 'sandbox/self-test.txt' dosyası oluşturulacak ve içine kısa bir doğrulama metni yazılacak. Değişiklikler sadece bu dosya ile sınırlı olacak.`
  - Rol: `backend`
  - Karmaşıklık: `simple`
  - Bağımlılık: boş.

Prompt içinde `claude-code`'dan özellikle şunları isteyin:
- Sadece `sandbox/self-test.txt` dosyasını oluşturup yazmasını,
- Tüm değişikliği `PATCH:` bölümündeki `diff` içinde vermesini,
- Çıktıyı `templates/output_contract.md` sözleşmesine **birebir** uygun üretmesini.

Bu sayede:
- Görev oluşturma,
- Hafıza dosyası kullanımı,
- `claude-code` ile koşu,
- Çıktının parse edilmesi,
- Review ekranında diff görüntüleme,
- Guarded Mode ile `git apply` üzerinden patch uygulama
akışını uçtan uca doğrulayabilirsiniz.



### Claude Code Subagent'ları ve Agent Teams

Bu repo, Claude Code'un [subagents](https://code.claude.com/docs/en/sub-agents) ve [agent teams](https://code.claude.com/docs/en/agent-teams) yapısıyla uyumludur:

- **Proje subagent'ları**: `.claude/agents/` altında her rol için bir Markdown dosyası vardır (`pm`, `architect`, `backend`, `frontend`, `sql`, `qa`, `devops`). Bu repoda `claude code` kullanırken Claude bu rollere görev devredebilir.
- **Roller**: TUI'deki roller (`templates/roles/*.json`) ile `.claude/agents/` içeriği aynı rol setine karşılık gelir; subagent'lar rol davranışını (workStyle, definition of done) tanımlar.
- **Agent teams**: Çoklu oturumlu ekip modu için `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` ile deneyebilirsiniz. Detaylı açıklama ve eşleme tablosu için bkz. [docs/agent-teams.md](docs/agent-teams.md).

### Notlar

- Tüm kod Node.js tarafında çalışır, harici servis kullanmaz.
- SQLite dosyası repo kökünde `orchestrator.db` olarak oluşturulur.
- Windows uyumluluğu için tüm komutlar `npm` script'leri ve `child_process` üzerinden çalıştırılır; bash'e özel script yoktur.

