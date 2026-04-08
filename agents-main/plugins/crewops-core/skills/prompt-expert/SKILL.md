---
name: prompt-expert
description: Use when generating sector-specific Google Maps search prompts. Creates optimized search queries and result format instructions based on sector classification from domain-classifier.
---

# Prompt Expert

Sektöre özel Google Maps arama prompt'u oluşturur. Her sektör için optimize edilmiş arama sorgusu ve JSON format talimatı üretir.

## Input

```json
{
  "sector": "berber",
  "sectorLabel": "Erkek Berberleri",
  "city": "Bursa",
  "district": "Nilüfer",
  "searchKeywords": ["erkek berber", "barber", "erkek kuaför"],
  "minRating": 4.0,
  "minReviews": 30
}
```

## Output

System prompt + user prompt olarak iki parça döner:

### System Prompt
```
Sen bir araştırma agent'ısın. Google Maps'te gerçek işletme araması yapıyorsun.

## GÖREV
Bursa ili Nilüfer ilçesindeki erkek berberlerini bul.

## ARAMA STRATEJİSİ
Google Maps'te şu sorguları yap:
1. "erkek berber Nilüfer Bursa"
2. "barber shop Nilüfer Bursa"  
3. "erkek kuaför Nilüfer Bursa"

## FİLTRE KRİTERLERİ
- Google puanı 4.0 ve üzeri
- En az 30 yorum
- SADECE erkek berber/kuaför kategorisinde olan işletmeler
- Güzellik salonu, kadın kuaförü, unisex salon DAHİL DEĞİL
- Belediye, okul, hastane gibi alakasız yerler DAHİL DEĞİL

## FORMAT
JSON array formatında ver:
[{"ad":"İşletme Adı","adres":"Tam adres","ilce":"Nilüfer","telefon":"+90...","puan":4.5,"yorumSayisi":150,"siteDurumu":"yok","siteUrl":null}]

## KRİTİK KURALLAR
1. SADECE Google Maps verisini kullan
2. HALÜSİNASYON YAPMA — bulamadığını ÜRETME
3. En az 5, mümkünse 10+ işletme bul
4. SADECE erkek berberi kategorisi — başka kategori YAZMA
```

## Sektör-Spesifik Filtreler

| Sektör | Dahil | Hariç |
|--------|-------|-------|
| berber | erkek berber, barber, erkek kuaför | güzellik salonu, kadın kuaför, unisex |
| güzellik | güzellik salonu, güzellik merkezi, beauty center | berber, erkek kuaför |
| diş | diş kliniği, diş polikliniği, diş hekimi | hastane, eczane |
| restoran | restoran, lokanta, kebapçı, pizzacı | market, bakkal |
| veteriner | veteriner kliniği, hayvan hastanesi | eczane, pet shop |
| avukat | avukat, hukuk bürosu | noter, muhasebeci |
| oto | oto yıkama, oto servis, lastikçi | benzinlik, otopark |

## Kurallar
- Her sektör için negatif filtre (hariç tutulan kategoriler) ZORUNLU
- Arama sorguları Türkçe + İngilizce varyasyonlar içermeli
- Minimum 3 farklı arama sorgusu öner
- JSON format her zaman aynı — ad, adres, ilce, telefon, puan, yorumSayisi, siteDurumu
