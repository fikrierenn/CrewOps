---
name: domain-classifier
description: Use when classifying a business sector from user input. Extracts sector code, subcategory, search keywords, and typical service list from free-text project description.
---

# Domain Classifier

Kullanıcı mesajından sektör/kategori ve alt bilgileri çıkarır. Hardcode if/else yerine bu skill kullanılır.

## Input Format

```
Kullanıcı mesajı: "Bursa'daki erkek berberlerini bul"
```

## Output Format (JSON)

```json
{
  "sector": "berber",
  "sectorLabel": "Erkek Berberleri",
  "category": "kişisel bakım",
  "searchKeywords": ["erkek berber", "erkek kuaför", "barber", "berber salonu"],
  "typicalServices": ["Saç Kesimi", "Sakal Tıraşı", "Cilt Bakımı", "Damat Tıraşı", "Çocuk Kesimi", "Saç Boyama"],
  "serviceEmojis": ["💈", "✂️", "🪒", "👔", "👦", "🎨"],
  "sloganStyle": "erkeksi, güven veren, usta-çırak geleneği",
  "reviewStyle": "samimi, usta övgüsü, randevu kolaylığı",
  "mapSearchQuery": "erkek berber {district} {city}"
}
```

## Bilinen Sektörler

| Sektör | searchKeywords | typicalServices |
|--------|---------------|-----------------|
| berber | erkek berber, barber, erkek kuaför | Saç Kesimi, Sakal Tıraşı, Cilt Bakımı, Damat Tıraşı |
| güzellik | güzellik salonu, kadın kuaförü, beauty center | Cilt Bakımı, Saç Bakımı, Manikür, Epilasyon, Kaş Kirpik |
| diş | diş kliniği, diş hekimi, ağız diş sağlığı | İmplant, Ortodonti, Kanal Tedavisi, Beyazlatma, Çocuk Diş |
| restoran | restoran, lokanta, cafe, kafe | Kahvaltı, Öğle Yemeği, Akşam Yemeği, Paket Servis |
| veteriner | veteriner, hayvan hastanesi, pet klinik | Muayene, Aşılama, Cerrahi, Diş Bakımı, Tıraş |
| avukat | avukat, hukuk bürosu, noter | Ceza Hukuku, İş Hukuku, Aile Hukuku, İcra |
| oto | oto yıkama, oto servis, lastikçi | Yıkama, Bakım, Lastik, Rot Balans, Boya |
| emlak | emlak, gayrimenkul, kiralık | Satılık, Kiralık, Değerleme, Danışmanlık |
| eğitim | kurs, dershane, özel ders | Matematik, İngilizce, YKS, KPSS |
| sağlık | klinik, muayenehane, doktor | Muayene, Teşhis, Tedavi, Kontrol |

## Bilinmeyen Sektör

Listede yoksa:
```json
{
  "sector": "unknown",
  "sectorLabel": "İşletmeler",
  "needsSkillCreation": true,
  "suggestedKeywords": ["kullanıcı mesajından çıkarılan anahtar kelimeler"]
}
```

Bu durumda `skill-creator` devreye girer ve yeni sektör skill'i oluşturur.

## Kurallar
- Türkçe ve İngilizce girdileri anlayabilmeli
- Birden fazla sektör ipucu varsa en spesifik olanı seç
- "diş kliniği" → "diş", "güzellik salonu" → "güzellik" (alt kategoriye in)
- Şehir/ilçe bilgisini sektörle karıştırma
