# CrewOps Nasıl Kullanılır?

Bu rehber, **web arayüzü** ile CrewOps’u adım adım kullanmanızı anlatır.

---

## Hızlı erişim (arka planda çalışıyorsa)

| Ne | Adres |
|----|--------|
| **Arayüz (projeler, görevler, mutabakat)** | **[http://localhost:3000](http://localhost:3000)** |
| API (doğrudan test için) | http://localhost:3999 |

Tarayıcıda **http://localhost:3000** açın. Projeler, Görevler, Roller, Hafıza, Geçmiş bu arayüzden yönetilir.  
Port 3000 doluysa Vite bir sonraki portu (örn. 3001) kullanır; terminalde yazılan `Local: http://localhost:XXXX` adresini kullanın.

**Önemli:** LLM (Claude/Gemini) ürettiği kodu yalnızca **PATCH (diff)** olarak verir. Dosyalar proje klasörüne **ancak siz "Patch uygula" dedikten sonra** yazılır. `npm install` gibi komutlar **hiç otomatik çalışmaz**; **Geçmiş** sayfasında run detayında "Elle çalıştırmanız gereken komutlar" listesinde görünür, siz proje dizininde terminalde çalıştırırsınız.

---

## 1. Projeyi çalıştırma

İki terminal açın; ikisi de **CrewOps repo kökünde** (monorepo dizininde) olsun.

**Terminal 1 – API:**
```powershell
cd d:\Dev\CrewOps
npm run dev:api
```
Çıktıda `CrewOps API http://localhost:3999` görünmeli.

**Terminal 2 – Web:**
```powershell
cd d:\Dev\CrewOps
npm run dev:web
```
Çıktıda `Local: http://localhost:3000/` görünmeli.

Tarayıcıda **http://localhost:3000** adresini açın. Ekranda Dashboard ve sol menü (Projeler, Görevler, Roller, Hafıza, Geçmiş) görünecektir.

---

## 2. İlk kullanım sırası

### Adım 1: Proje ekle

- Sol menüden **Projeler**’e tıklayın.
- **Yeni proje** (veya “Proje ekle”) butonuna basın.
- Formu doldurun:
  - **Ad:** Projenin adı (örn. “CrewOps Test”).
  - **Repo yolu:** Üzerinde çalışacağınız klasörün **tam yolu** (örn. `D:\Dev\CrewOps` veya başka bir repo).
  - **Stack:** Teknoloji kısaltması (örn. `node+express+postgres`); isteğe bağlı.
- Kaydedin. Proje listede görünür.

Bu proje, görevlerin ve koşuların “hangi dizinde” çalışacağını belirler.

### Adım 2: Rolleri projeye al

- **Roller** sayfasına gidin.
- Proje seçiliyse, **Rolleri içe aktar** (veya “Import”) gibi bir seçenek varsa kullanın. Böylece built-in roller (backend, frontend, pm, qa vb.) ve **agent kataloğundaki** agent’lar (agents-main / development-team) bu projede kullanılabilir hale gelir.
- Rol listesinde hem şablon roller hem katalog agent’ları (örn. `backend-architect`, `code-explorer`) görünür.

### Adım 3: Hafıza dosyalarını oluştur (gerekirse)

- **Hafıza** sayfasına gidin.
- Sistem, proje repo yolunda `memory/NOW.md`, `memory/DECISIONS.md`, `memory/ARCH_SHORT.md` arar. Eksikse uyarı veya “Varsayılan hafıza oluştur” butonu çıkar.
- Bu butona basarak üç dosyayı oluşturun. İçeriklerini istersen sonra düzenleyebilirsiniz. Her koşuda bu hafıza prompt’a eklenir.

### Adım 4: Görev oluştur

- **Görevler** sayfasına gidin.
- Projeyi seçin (dropdown veya üstteki proje seçici).
- **Yeni görev** (veya “Görev ekle”) ile formu açın.
  - **Başlık:** Kısa isim (örn. “API endpoint ekle”).
  - **Açıklama:** Ne yapılacak; LLM’e gidecek ana metin (örn. “Kullanıcı listesi için GET /users endpoint’i ekle, pagination desteklesin”).
  - **Rol:** Backend, frontend, code-explorer, test-runner vb. listeden birini seçin (built-in veya katalog agent).
  - **Karmaşıklık:** simple / medium / complex (isteğe bağlı).
  - **Bağımlılık:** Başka görevlere bağlıysa seçin; yoksa boş bırakın.
- Kaydedin.

### Adım 5: Görevi çalıştır (Başla)

- Görevler listesinde ilgili görevin yanındaki **Başla** butonuna tıklayın.
- Sistem:
  - Seçilen rol/agent + görev + hafıza + sözleşmeleri tek prompt’ta birleştirir.
  - **Claude** kullanıyorsanız: Yeni bir **terminal penceresi** açılır; `claude` orada çalışır, çıktı orada akar. Bittiğinde API’ye bildirilir.
  - **Gemini** kullanıyorsanız: Çıktı web sayfasındaki **gömülü konsol**da (SSE ile) akar.
- Sayfada koşu durumu (running / completed) ve (bittiğinde) özet görünür. Çıktıda **SUMMARY**, **PATCH** ve **COMMANDS_TO_RUN_MANUALLY** blokları parse edilir.

### Adım 6: Patch ve komutları değerlendir (Guarded Mode)

- Koşu bittikten sonra:
  - **PATCH** varsa: Önerilen dosya değişiklikleri diff olarak gösterilir. **Hiçbir şey otomatik uygulanmaz.** İsterseniz “Patch uygula” benzeri bir onayla `git apply` ile uygulatırsınız; reddederseniz sadece kayıt/artefact olarak kalır.
  - **COMMANDS_TO_RUN_MANUALLY:** Önerilen komutlar listelenir. Bunları siz kendi terminalinizde çalıştırırsınız; CrewOps komut çalıştırmaz.

---

## 3. Geçmiş ve artefact’lar

- **Geçmiş** sayfasından projeye ait son koşuları listeleyebilirsiniz.
- Her koşu için özet, durum ve (varsa) parse edilmiş çıktı / patch bilgisi görüntülenir. Ham çıktı ve patch dosyaları `artifacts/` altında saklanır.

---

## 4. Özet akış

1. **Proje ekle** → repo yolu + ad.
2. **Rolleri içe aktar** → built-in + katalog agent’ları kullanılabilir yap.
3. **Hafıza** → NOW/DECISIONS/ARCH_SHORT oluştur veya düzenle.
4. **Görev oluştur** → başlık, açıklama, rol/agent, karmaşıklık.
5. **Başla** → koşu terminalde veya gömülü konsolda çalışır.
6. **Çıktıyı incele** → SUMMARY/PATCH/komut listesi; patch’i isteğe bağlı uygula, komutları kendin çalıştır.

---

## 5. Hata durumunda ne yapılır?

- **"Parse edilemedi"**  
  LLM çıktısı SUMMARY / PATCH / COMMANDS_TO_RUN_MANUALLY formatına uymamıştır. **Geçmiş** → ilgili run → **Kod / Patch göster** ile ham çıktıyı açıp inceleyin; gerekirse görev açıklamasını “Çıktıyı SUMMARY, PATCH (```diff), COMMANDS_TO_RUN_MANUALLY bölümleriyle ver” şeklinde netleştirip yeniden deneyin.

- **Orkestrasyon durdu (bir görev başarısız)**  
  Orkestrasyon sayfasında **failed** durumunda ekrandaki “Ne yapabilirsiniz?” kutusundaki adımları izleyin: Geçmiş’te run detayına bakın, **Görevler** sayfasında başarısız görev için **Yeniden dene** deyip **Başla** ile tekrar çalıştırın.

- **Başarısız görevi tekrar çalıştırmak**  
  **Görevler** sayfasında ilgili görevin yanındaki **Yeniden dene** butonu görevi tekrar *pending* yapar; ardından **Başla** ile aynı görevi yeniden koşturabilirsiniz.

- **Patch uygulanamadı**  
  Geçmiş’te **Patch uygula** hata veriyorsa: proje repo yolunun doğru ve Git ile açılmış olduğundan emin olun; ham çıktıdaki PATCH’in geçerli bir unified diff olduğunu kontrol edin.

---

## 6. Gereksinimler

- **Node.js 18+**
- **Git** (patch uygulamak için)
- **Claude Code CLI** (`claude`) veya **Gemini CLI** (`gemini`) — PATH’te olmalı. Model seçimi (Claude vs Gemini) arayüzde veya görev/rol ayarında yapılır.

Daha fazla teknik detay için: [00-overview.md](00-overview.md), [06-run-pipeline-and-contracts.md](06-run-pipeline-and-contracts.md). Hata senaryoları için yukarıdaki **§5. Hata durumunda ne yapılır?** bölümüne bakın.
