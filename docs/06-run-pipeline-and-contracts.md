# Koşu Akışı ve Sözleşmeler

Bu belge run (koşu) pipeline’ını, çıktı sözleşmesini ve Guarded Mode’u açıklar.

---

## 1. Run Pipeline Özeti

1. **Başlatma**: API `POST /run/start` veya TUI’den koşu başlatılır; projectId, taskId, roleId (veya katalog agent id), modelOverride ile.
2. **Hazırlık**: Core proje/görev/rol (veya agent) ve hafıza/sözleşmeleri yükleyip tek prompt üretir; run kaydı “running” olarak güncellenir.
3. **Çalıştırma**:
   - **Claude**: Prompt dosyası + `claude run` (veya eşdeğer) `--cwd` ile hedef dizinde; isteğe bağlı ayrı terminal (run-in-terminal.js) ve bittiğinde `POST /api/run/finished`.
   - **Gemini**: Prompt stdin’e verilir; çıktı SSE ile alınır.
4. **Parse**: Ham çıktı `OutputParser` ile SUMMARY, PATCH, COMMANDS_TO_RUN_MANUALLY bloklarına ayrıştırılır.
5. **Saklama**: Run durumu “completed”/“failed” güncellenir; artefact (ham + parse edilmiş) kaydedilir.
6. **Sunum**: Web’de SSE ile canlı çıktı; bittiğinde özet, diff ve komut listesi. Patch yalnızca kullanıcı onayıyla uygulanır.

---

## 2. Output Contract (Çıktı Sözleşmesi)

**Dosya**: `templates/output_contract.md`

- **SUMMARY**: Yapılanların kısa özeti (metin).
- **PATCH**: Tüm dosya değişiklikleri **sadece** unified diff formatında; başka dosya yazma/okuma talimatı yok.
- **COMMANDS_TO_RUN_MANUALLY**: Çalıştırılması önerilen komutlar listesi; **hiçbiri otomatik çalıştırılmaz**.

Kurallar (sözleşmede vurgulanır):

- Dosya değişikliği **yalnızca** PATCH bloğunda; LLM dosya oluşturma/silme komutu çalıştırmamalı.
- Komut çalıştırma **yasak**; sadece COMMANDS_TO_RUN_MANUALLY’de listeleme.

Bu sayede Guarded Mode tutarlı çalışır: tek uygulama noktası `git apply` (kullanıcı onayı sonrası).

---

## 3. Task Contract

**Dosya**: `templates/task_contract.md`

- Rolün görevi nasıl yorumlayacağı, nasıl raporlayacağı ve output contract’a nasıl uyacağı anlatılır.
- Prompt’ta output contract ile birlikte kullanılır.

---

## 4. Guarded Mode

- **Amaç**: Kullanıcı onayı olmadan ne dosya değişikliği ne komut çalıştırma.
- **Dosya**: LLM sadece PATCH üretir; uygulama kullanıcı “Apply” dediğinde `git apply` ile yapılır.
- **Komutlar**: Sadece COMMANDS_TO_RUN_MANUALLY’de listelenir; kullanıcı isterse kendisi terminalde çalıştırır.
- **Güvenlik**: Sadece güvenilir agent/skill kaynakları kullanılmalı; sözleşme kuralları prompt’ta sabittir.

---

## 5. Özet

- Run: start → hazırlık (prompt) → runner (Claude/Gemini) → parse → saklama → sunum.
- Output contract: SUMMARY + PATCH (tek değişiklik yöntemi) + COMMANDS_TO_RUN_MANUALLY (sadece liste).
- Guarded Mode: Otomatik komut yok; patch yalnızca kullanıcı onayıyla uygulanır.
