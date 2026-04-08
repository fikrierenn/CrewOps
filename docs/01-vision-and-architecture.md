# Vizyon ve Üst Seviye Mimari

## 1. Vizyon

CrewOps, **agent’ları besleyen ve yöneten ana orkestrasyon arayüzü** olarak konumlandırılır:

- **agents-main** (ve benzeri kataloglar): Uzman agent tanımları ve skill’ler (rol + bilgi paketleri).
- **CrewOps**: Bu agent’ları hangi projede, hangi görevde, hangi sırayla ve hangi LLM sağlayıcısıyla (Claude / Gemini) çalıştıracağını belirleyen tek merkez.

Kullanıcı tarafında:

- Web arayüzünden proje ekler, görev tanımlar, **Rol/Agent** seçer.
- “Başla” dediğinde ilgili agent/rol + hafıza + sözleşmeler tek bir prompt’ta birleştirilir; Claude Code veya Gemini CLI çalıştırılır.
- Çıktı parse edilir; PATCH ve COMMANDS_TO_RUN_MANUALLY arayüzde gösterilir; dosya değişiklikleri yalnızca kullanıcı onayıyla uygulanır.

## 2. Temel Bileşenler

```
┌─────────────────────────────────────────────────────────────────┐
│  Web UI (apps/web)                                               │
│  Projeler, Görevler, Roller, Hafıza, Geçmiş, Rol/Agent seçimi   │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + SSE
┌────────────────────────────▼────────────────────────────────────┐
│  API (apps/api)                                                 │
│  CRUD, GET /agent-catalog, POST /run/start, SSE /run/stream     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Core (packages/core)                                           │
│  LLMRunner, ClaudeCodeRunner, GeminiRunner, agentCatalog,       │
│  RoleRegistry, MemoryEngine, OutputParser, WorkflowEngine         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  DB (packages/db) + Shared (packages/shared)                    │
│  SQLite: projects, tasks, runs, roles, artifacts                │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Dış Bağımlılıklar

- **Claude Code CLI** (`claude`): Görev koşumunda prompt dosyası + `--cwd` ile çağrılır.
- **Gemini CLI** (`gemini`): Model `gemini:...` ise stdin’e prompt verilerek çağrılır.
- **agents-main** (opsiyonel): `agents-main/plugins/*/agents/*.md` varsa katalogdan agent listesi ve içerik okunur.
- **Git**: PATCH uygulaması için `git apply` kullanılır.

## 4. Güvenlik Özeti

- **Guarded Mode**: Hiçbir komut otomatik çalıştırılmaz; LLM yalnızca COMMANDS_TO_RUN_MANUALLY listesinde önerir.
- **Dosya CRUD**: Sadece PATCH diff ile; kullanıcı onayı sonrası `git apply`.

Detay için [06-run-pipeline-and-contracts.md](06-run-pipeline-and-contracts.md) kullanılır.
