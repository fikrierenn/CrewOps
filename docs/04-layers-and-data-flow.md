# Katmanlar ve Veri Akışı

Bu belge CrewOps’un katmanlarını ve koşu (run) sırasındaki veri akışını özetler.

---

## 1. Katman Özeti

| Katman | Paket/Uygulama | Sorumluluk |
|--------|----------------|------------|
| **Sunum** | apps/web, apps/orchestrator | Kullanıcı arayüzü; proje/görev/rol seçimi; koşu başlatma; çıktı/diff/komut listesi gösterme. |
| **API** | apps/api | REST CRUD; GET /agent-catalog; POST /run/start; SSE /run/stream; POST /run/finished. |
| **İş mantığı** | packages/core | Prompt oluşturma, LLM runner (Claude/Gemini), katalog, hafıza, parser, artefact, maliyet. |
| **Veri** | packages/db, packages/shared | Kalıcı veri (projeler, görevler, koşular, roller, artefact’lar). |

Templates ve memory dosya sistemi üzerinden core tarafından okunur; CLI’lar (claude, gemini) core tarafından çağrılır.

---

## 2. Koşu (Run) Veri Akışı

1. **Kullanıcı**: Web’den veya TUI’den “Başla” seçer; proje, görev, rol/agent ve (varsa) model seçilidir.
2. **API**: `POST /run/start` body’de `projectId`, `taskId`, `roleId` (veya katalog agent id’si), `modelOverride` alır.
3. **Core**:
   - Proje ve görev DB’den okunur.
   - Rol: `roleId` built-in ise `RoleRegistry`’den, değilse `loadAgent(rootDir, roleId)` ile katalogdan alınır; `agentToRoleConfig` ile RoleConfig’e çevrilir.
   - Hafıza: `MemoryEngine` ile NOW/DECISIONS/ARCH_SHORT okunur.
   - Sözleşmeler: `output_contract.md`, `task_contract.md` okunur.
   - Tek bir **prompt** birleştirilir (rol/agent + görev + hafıza + task contract + output contract).
4. **Runner**:
   - **Claude**: `ClaudeCodeRunner.runWithStream` ile prompt dosyası oluşturulur, `claude run` (veya benzeri) `--cwd` ile hedef proje dizininde çalıştırılır. İsteğe bağlı: ayrı terminal için `scripts/run-in-terminal.js` kullanılır; bittiğinde `POST /api/run/finished` çağrılır.
   - **Gemini**: Model adı `gemini:` ile başlıyorsa `GeminiRunner` ile prompt stdin’e verilir; çıktı SSE ile dinlenir (ayrı terminal yok).
5. **Çıktı işleme**: Ham çıktı `OutputParser` ile ayrıştırılır (SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY). Artefact ve run kaydı güncellenir.
6. **Sunum**: Web’de RunConsole SSE ile satır satır çıktı gösterir; bittiğinde özet, patch (diff) ve komut listesi gösterilir. Guarded Mode: patch yalnızca kullanıcı onayıyla `git apply` ile uygulanır; komutlar asla otomatik çalıştırılmaz.

---

## 3. Agent Kataloğu Akışı

- **Liste**: `GET /api/agent-catalog` → Core `listAgents(rootDir)` → agents-main/plugins/*/agents/*.md taranır → id, name, description, plugin, path döner.
- **Koşuda kullanım**: Görev için “rol” olarak katalog agent id’si seçilmişse, `loadAgent(rootDir, agentId)` ile içerik alınır, `agentToRoleConfig` ile RoleConfig’e çevrilir; prompt’ta built-in rol gibi kullanılır.

Detay: [05-agent-catalog-and-roles.md](05-agent-catalog-and-roles.md).

---

## 4. Hafıza ve Sözleşmeler

- **Hafıza**: Her koşuda proje `memory/` dizini (veya proje bazlı yol) okunur; içerik prompt’a eklenir.
- **Task contract**: Görevin nasıl yorumlanacağı ve raporlanacağı.
- **Output contract**: Çıktının SUMMARY / PATCH / COMMANDS_TO_RUN_MANUALLY bloklarına uyması zorunludur; böylece parsing ve Guarded Mode tutarlı çalışır.

Detay: [06-run-pipeline-and-contracts.md](06-run-pipeline-and-contracts.md).
