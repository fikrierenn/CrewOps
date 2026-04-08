---
description: "Sistematik debugging — root cause önce, fix sonra. 4 faz: Root Cause → Pattern → Hypothesis → Fix."
argument-hint: "<hata açıklaması veya stack trace>"
---

# Systematic Debugging

Kök neden araştırması YAPILMADAN fix YAZILMAZ.

## Yasak Yaklaşımlar

- Rastgele try-catch ekleyerek hatayı gizleme
- Stack trace okumadan "tahminle" fix deneme
- Aynı fix'i 3 kez tekrarlama (3. denemede mimariyi sorgula)
- "Works on my machine" deyip devam etme

---

## Faz 1: Root Cause Investigation

### 1.1 Hatayı Reproduce Et
- Hatayı tetikleyen adımları belirle
- Aynı hatayı tutarlı şekilde tekrarlayabildiğini doğrula
- Reproduce adımlarını yaz (başkası da tekrarlayabilmeli)

### 1.2 Error Message'ı OKU
- Stack trace'in TAMAMINI oku (sadece ilk satır değil)
- Inner exception var mı?
- Hangi katmanda patlıyor? (Domain / Application / Infrastructure / API / UI)

### 1.3 Son Değişiklikleri Kontrol Et
- `git diff` ile son değişiklikleri incele
- `git log --oneline -10` ile son commit'leri gör
- Hata yeni mi yoksa mevcut muydu?

### 1.4 Diagnostic Bilgi Topla
- Serilog çıktısını kontrol et
- İlgili entity'nin DB state'ini oku
- Request/response body'lerini logla (gerekiyorsa)

---

## Faz 2: Pattern Analysis

### Yaygın .NET / CrewOps Hata Pattern'leri

| Pattern | Belirti | Olası Neden |
|---------|---------|-------------|
| NullReferenceException | `Object reference not set` | Nullable property, factory method eksik |
| InvalidOperationException | `Invalid state transition` | ProjectStateMachine kuralı ihlali |
| DbUpdateException | `violation of UNIQUE constraint` | Duplicate key, missing migration |
| ArgumentException | `Value cannot be null` | Validation eksik, boş input |
| InvalidCastException | `Unable to cast` | EF Core configuration hatası |
| TimeoutException | `The operation has timed out` | DB bağlantısı, deadlock |
| JsonException | `could not be converted` | DTO mismatch, serialization ayarı |

### Çalışan vs Bozuk Karşılaştırma
1. Benzer çalışan kodu bul
2. İki kod arasındaki TÜM farkları listele
3. Her farkın potansiyel etkisini değerlendir

---

## Faz 3: Hypothesis & Testing

### Hipotez Oluştur
Tek, spesifik bir hipotez kur:
- "NullRef çünkü `Project.GovernancePreset` EF Core'dan nullable olarak dönüyor ama kod null check yapmıyor"
- "State transition başarısız çünkü `GovernancePreset.HasQaPhase = false` iken QA state'ine geçiş deneniyor"

### Minimal Test
- Hipotezi doğrulayacak en küçük değişikliği yap
- Değişikliği yaptıktan sonra AYNI hatayı tekrar dene
- Sonucu gözlemle (düzeldi mi, aynı mı, farklı hata mı?)

### 3 Deneme Kuralı
- 3 başarısız denemeden sonra → MIMARIYI SORGULA
- Belki sorun fix'te değil, tasarımda
- Kullanıcıya durumu bildir ve alternatif yaklaşım öner

---

## Faz 4: Implementation

### 4.1 Failing Test Yaz
```
/tdd-cycle RED: [hata senaryosu]
```
- Hatayı tetikleyen bir test yaz
- Testin KIRMIZI olduğunu doğrula

### 4.2 Minimal Fix Uygula
- TEK bir değişiklik yap (birden fazla şeyi aynı anda değiştirme)
- Testin YEŞİL olduğunu doğrula
- Tüm testlerin hala geçtiğini doğrula

### 4.3 Doğrula
```
/verify "Bug fix çalışıyor ve regression yok"
```

---

## Çıktı Formatı

```
## Debug Raporu

### Hata
[Hata açıklaması + stack trace özeti]

### Root Cause
[Kök neden — tek cümle]

### Fix
[Yapılan değişiklik — dosya:satır]

### Doğrulama
[Test sonuçları + kanıt]

### Önlem
[Bu tür hatanın tekrarını önlemek için ne yapılmalı]
```
