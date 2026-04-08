---
name: skill-creator
description: Use when a sector-specific skill does not exist in the registry. Auto-generates prompt-expert and content-expert skill variants for unknown sectors by analyzing the sector name and creating appropriate SKILL.md files.
---

# Skill Creator (Meta-Skill)

Yeni sektör tespit edildiğinde o sektör için eksik skill'leri otomatik oluşturur. Sistem kendini genişletir.

## Ne Zaman Tetiklenir?

```
domain-classifier → sector: "unknown" veya needsSkillCreation: true
  → skill-creator devreye girer
    → prompt-expert-{sector} SKILL.md oluşturur
    → content-expert-{sector} SKILL.md oluşturur
    → SkillSourceScanner tekrar tarar
    → Pipeline yeni skill'lerle çalışır
```

## Input

```json
{
  "sector": "pet-shop",
  "userMessage": "İstanbul'daki pet shop'ları bul",
  "suggestedKeywords": ["pet shop", "evcil hayvan mağazası"]
}
```

## Yapması Gereken

### 1. Sektörü Araştır
- Sektörün tipik hizmetlerini belirle
- Yaygın arama terimlerini listele
- Hedef kitleyi tanımla
- Rekabet yapısını anla

### 2. domain-classifier Güncellemesi
domain-classifier SKILL.md'nin "Bilinen Sektörler" tablosuna yeni satır ekle:

```
| pet-shop | pet shop, evcil hayvan mağazası | Mama, Aksesuar, Bakım, Veteriner Yönlendirme |
```

### 3. prompt-expert Varyantı
Yeni sektör için arama prompt template'i:

- Arama sorguları (min 3 varyasyon)
- Dahil/hariç filtreler
- Spesifik kategori adı

### 4. content-expert Varyantı  
Yeni sektör için içerik rehberi:

- Ton/ses (formal, samimi, premium, vb.)
- 3 slogan örneği
- 6 tipik hizmet + emoji
- 3 yorum tarzı örneği

## Output Format

İki dosya oluşturur:

### Dosya 1: Sector-specific search config
```json
{
  "sector": "pet-shop",
  "sectorLabel": "Pet Shop'lar",
  "category": "evcil hayvan",
  "searchKeywords": ["pet shop", "evcil hayvan mağazası", "petshop"],
  "excludeKeywords": ["veteriner kliniği", "hayvan barınağı"],
  "typicalServices": ["Mama & Yem", "Aksesuar", "Bakım & Tıraş", "Akvaryum", "Kuş Malzemeleri", "Taşıma Çantası"],
  "serviceEmojis": ["🐕", "🦴", "✨", "🐟", "🦜", "🧳"],
  "sloganStyle": "sevecen, hayvan dostu, renkli",
  "reviewStyle": "dostça, hayvan övgüsü, ürün kalitesi",
  "mapSearchQuery": "pet shop {district} {city}"
}
```

### Dosya 2: Güncellenen skill dosyaları
`agents-main/plugins/crewops-core/skills/domain-classifier/sectors/{sector}.json`

## Kurallar
- Oluşturulan skill'ler mevcut skill format'ına UYGUN olmalı (YAML frontmatter + markdown)
- Halüsinasyon yapma — emin olmadığın hizmet/anahtar kelime ekleme
- Minimum 3 arama sorgusu, 6 hizmet, 3 yorum örneği
- Oluşturulan skill'i test et — anlamsız içerik üretmemeli
- Mevcut skill'lerin üzerine YAZMA — sadece yeni ekle
