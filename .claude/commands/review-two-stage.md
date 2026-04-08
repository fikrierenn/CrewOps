---
description: "İki aşamalı kod inceleme — önce spec uyumu, sonra kod kalitesi. Yanlış kodu cilalamayı önler."
argument-hint: "[dosya veya PR açıklaması]"
---

# Two-Stage Code Review

İki aşamalı inceleme: önce DOĞRU MU, sonra İYİ Mİ. Bu sıra değişmez.

## Neden İki Aşama?

Tek aşamalı review'da ekipler yanlış kodu cilalamaya zaman harcar.
Spec uyumu geçmeden kod kalitesine bakmanın anlamı yoktur.

---

## Stage 1: Spec Uyumu (Gereksinim Kontrolü)

Stage 1 geçmeden Stage 2'ye GEÇME.

### Kontrol Listesi

1. **Tasarım eşleşmesi**: Onaylanan design-gate çıktısıyla birebir uyumlu mu?
2. **Kabul kriterleri**: Her kriter karşılanıyor mu? Eksik olan var mı?
3. **Atom tamamlanma**: Planlanan tüm atom görevler yapıldı mı?
4. **Test kapsamı**: Kabul kriterlerini doğrulayan testler var mı?
5. **Davranış doğruluğu**: Happy path + failure path çalışıyor mu?

### Stage 1 Sonucu

- **GEÇTI** → Stage 2'ye ilerle
- **KALDI** → Eksikleri listele, implementor'a gönder, düzeltme sonrası tekrar Stage 1

---

## Stage 2: Kod Kalitesi (Sadece Stage 1 Geçtiyse)

### DDD Saflık Kontrolü
- [ ] Domain katmanında infrastructure bağımlılığı yok
- [ ] State geçişleri sadece ProjectStateMachine üzerinden
- [ ] Aggregate invariant'ları korunuyor
- [ ] Domain event'ler doğru yayınlanıyor
- [ ] Value object'ler immutable

### Kodlama Standartları
- [ ] File-scoped namespace
- [ ] `sealed` class (gerekmedikçe)
- [ ] `IReadOnlyList<T>` external exposure
- [ ] Factory method pattern (static Create)
- [ ] XML doc comment'ler Türkçe
- [ ] `ArgumentException.ThrowIfNullOrWhiteSpace()` validation

### Performans & Güvenlik
- [ ] N+1 query riski yok
- [ ] Gereksiz async/await zinciri yok
- [ ] SQL injection riski yok (parameterized queries)
- [ ] Hassas veri log'lanmıyor

### Test Kalitesi
- [ ] `MethodName_Scenario_ExpectedResult` naming
- [ ] Arrange-Act-Assert pattern
- [ ] Her test bağımsız
- [ ] Edge case'ler kapsanmış

### Stage 2 Sonucu

Bulgular kategorize edilir:
- **KRİTİK**: Hemen düzelt (güvenlik, veri kaybı, invariant ihlali)
- **ÖNEMLİ**: Merge'den önce düzelt (pattern ihlali, eksik test)
- **ÖNERİ**: İsteğe bağlı (isimlendirme, yorum, minor refactor)

---

## Çıktı Formatı

```
## Stage 1: Spec Uyumu
Sonuç: GEÇTI / KALDI
[Detaylar...]

## Stage 2: Kod Kalitesi
Sonuç: GEÇTI / KALDI
Kritik: X bulgu
Önemli: Y bulgu
Öneri: Z bulgu
[Detaylar...]
```
