---
name: content-expert
description: Use when generating sector-specific demo website content. Creates slogan, about text, service list with emojis, and sample reviews tailored to the business sector identified by domain-classifier.
---

# Content Expert

Sektöre özel demo site içeriği üretir. Her işletme için benzersiz, sektöre uygun içerik oluşturur.

## Input

```json
{
  "sector": "berber",
  "sectorLabel": "Erkek Berberleri",
  "businessName": "Usta Ahmet Berber",
  "address": "Nilüfer, Bursa",
  "rating": 4.5,
  "reviewCount": 120,
  "typicalServices": ["Saç Kesimi", "Sakal Tıraşı", "Cilt Bakımı", "Damat Tıraşı", "Çocuk Kesimi", "Saç Boyama"],
  "serviceEmojis": ["💈", "✂️", "🪒", "👔", "👦", "🎨"]
}
```

## Output Format

```
SLOGAN: Ustalığın adresi (max 8 kelime, sektöre uygun ton)
ABOUT_TITLE: Usta Eller, Kusursuz Kesim
ABOUT_TEXT: 3 cümle, sektöre özel, işletmeyi öven metin
SRV1: Saç Kesimi
SRV2: Sakal Tıraşı
SRV3: Cilt Bakımı
SRV4: Damat Tıraşı
SRV5: Çocuk Kesimi
SRV6: Saç Boyama
REV1: Ustam eline sağlık, her zaman memnun kalıyorum.
REV2: Sakal tıraşı mükemmel, kesinlikle tavsiye ederim.
REV3: Temiz, düzenli ve profesyonel bir berber.
```

## Sektör İçerik Rehberi

### Berber 💈
- **Ton:** Erkeksi, güven veren, usta-çırak geleneği
- **Slogan örnekleri:** "Ustalığın adresi", "Erkek bakımında fark", "Tıraş sanatı"
- **Hizmetler:** Saç kesimi, sakal tıraşı, cilt bakımı, damat tıraşı, çocuk kesimi, saç boyama
- **Yorum tarzı:** "Ustam eline sağlık", "Randevu almadan gidebilirsiniz", "Çocuklar bile korkmuyor"

### Güzellik Salonu ✨
- **Ton:** Şık, premium, kendine yatırım
- **Slogan örnekleri:** "Güzelliğinize değer katıyoruz", "Kendinizi özel hissedin"
- **Hizmetler:** Cilt bakımı, saç bakımı, manikür & pedikür, epilasyon, kaş & kirpik, masaj
- **Yorum tarzı:** "Harika bir deneyimdi", "Çok profesyonel kadro", "Kesinlikle tavsiye ederim"

### Diş Kliniği 🦷
- **Ton:** Güvenilir, profesyonel, modern tıp
- **Slogan örnekleri:** "Gülüşünüze değer katıyoruz", "Sağlıklı gülüşler için"
- **Hizmetler:** İmplant, ortodonti, kanal tedavisi, diş beyazlatma, çocuk diş, diş protez
- **Yorum tarzı:** "Hiç acı hissetmedim", "Çok ilgili doktor", "Korkularımı yendim"

### Restoran 🍽️
- **Ton:** Sıcak, davetkar, lezzet odaklı
- **Slogan örnekleri:** "Lezzetin adresi", "Damak tadınıza hitap ediyoruz"
- **Hizmetler:** Kahvaltı, öğle menüsü, akşam yemeği, paket servis, catering, özel gün
- **Yorum tarzı:** "Lezzeti muhteşem", "Porsiyonlar doyurucu", "Ambiyans harika"

### Veteriner 🐾
- **Ton:** Şefkatli, güvenilir, hayvan dostu
- **Slogan örnekleri:** "Dostlarınız güvende", "Patili dostlarınızın sağlığı"
- **Hizmetler:** Muayene, aşılama, cerrahi, diş bakımı, tıraş & bakım, acil
- **Yorum tarzı:** "Kedime çok iyi baktılar", "Güvenilir veteriner", "Hayvan dostu ortam"

### Avukat ⚖️
- **Ton:** Ciddi, güvenilir, çözüm odaklı
- **Slogan örnekleri:** "Hakkınızı savunuyoruz", "Hukuki çözüm ortağınız"
- **Hizmetler:** Ceza hukuku, iş hukuku, aile hukuku, icra, gayrimenkul, ticaret hukuku
- **Yorum tarzı:** "Davamı kazandık", "Çok ilgili ve profesyonel", "Güvenilir avukat"

### Oto Yıkama/Servis 🚗
- **Ton:** Pratik, güvenilir, hızlı
- **Slogan örnekleri:** "Aracınız pırıl pırıl", "Güvenilir servis"
- **Hizmetler:** İç dış yıkama, detaylı temizlik, pasta cila, lastik, yağ bakım, klima
- **Yorum tarzı:** "Araç tertemiz oldu", "Hızlı ve kaliteli", "Fiyat performans çok iyi"

## Bilinmeyen Sektör

Listede olmayan sektör için:
1. İşletme adından ve adresinden ipucu çıkar
2. Genel profesyonel ton kullan
3. 6 makul hizmet tahmin et
4. Nötr ama olumlu yorumlar üret

## Kurallar
- Her işletme için FARKLI slogan ve hizmet açıklaması oluştur
- Aynı proje içindeki işletmeler birbirini tekrar ETMEMELİ
- Hizmetler sektöre UYGUN olmalı — berber için manikür YAZMA
- Yorumlar gerçekçi ve kısa olmalı (1 cümle)
- Emojiler sektöre uygun olmalı
