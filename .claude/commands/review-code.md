---
description: "CrewOps DDD odaklı kod inceleme — mimari uyum, domain saflığı, invariant kontrolü"
argument-hint: "[dosya yolu veya modül adı]"
---

# CrewOps Kod İnceleme

DDD ve CrewOps mimari kurallarına göre derinlemesine kod inceleme.

## Kapsam Belirleme

Parametre verilmişse o dosya/modülü incele. Verilmemişse son değişiklikleri incele:
```bash
git diff --name-only HEAD~1
```

## İnceleme Boyutları

### 1. Domain Saflığı
- [ ] Domain katmanında dış bağımlılık var mı? (EF Core, HTTP, logging OLMAMALI)
- [ ] Infrastructure concerns domain'e sızmış mı?
- [ ] Persistence detayları (DbContext, SQL) domain'den ayrı mı?

### 2. Aggregate Bütünlüğü
- [ ] Aggregate invariant'ları korunuyor mu?
- [ ] State değişiklikleri controlled method'larla mı yapılıyor?
- [ ] Public setter var mı? (OLMAMALI)
- [ ] Factory method kullanılıyor mu? (public constructor OLMAMALI)
- [ ] Domain event'ler doğru zamanda emit ediliyor mu?

### 3. State Machine Uyumu
- [ ] GovernancePreset doğru uygulanıyor mu?
- [ ] Geçersiz state geçişleri engelleniyor mu?
- [ ] Terminal state'lerden çıkış yolu yok mu?

### 4. CQRS Pattern
- [ ] Command'lar state değiştiriyor mu? (olmalı)
- [ ] Query'ler state değiştiriyor mu? (OLMAMALI)
- [ ] Handler'lar tek sorumluluk ilkesine uyuyor mu?

### 5. Kodlama Standartları
- [ ] `sealed class` kullanılmış mı?
- [ ] `IReadOnlyList<T>` dışa açık koleksiyonlarda mı?
- [ ] XML doc comment'ler Türkçe mi?
- [ ] Teknik isimler İngilizce mi?
- [ ] Gereksiz abstraction var mı?

### 6. Test Kapsamı
- [ ] Yeni/değişen kod için test var mı?
- [ ] Happy path ve failure path test edilmiş mi?
- [ ] FluentAssertions kullanılmış mı?

### 7. Güvenlik
- [ ] Input validation yapılmış mı? (boundary'lerde)
- [ ] SQL injection riski var mı? (parameterized query kullanılmalı)
- [ ] Hassas veri loglanıyor mu? (OLMAMALI)

## Çıktı Formatı

Her bulgu için:

```
[SEVİYE] Dosya:Satır — Açıklama
Öneri: ...
```

Seviyeler:
- **KRİTİK**: Domain saflığı ihlali, güvenlik açığı, invariant bozulması
- **UYARI**: Standart ihlali, eksik test, performans riski
- **ÖNERİ**: İyileştirme fırsatı, daha iyi pattern kullanımı

## Özet

| Boyut | Durum | Bulgu Sayısı |
|-------|-------|-------------|
| Domain saflığı | OK/SORUN | ... |
| Aggregate bütünlüğü | OK/SORUN | ... |
| ... | ... | ... |
