---
description: "Doğrulama kapısı — her iddia kanıtla desteklenmeli. 5 adım: Identify → Run → Read → Verify → Claim."
argument-hint: "<doğrulanacak iddia> (örn: 'testler geçiyor', 'build başarılı', 'endpoint 200 dönüyor')"
---

# Verification Gate

Kanıtsız iddia YASAK. Her teknik iddia 5 adımla doğrulanır.

## Yasak İfadeler

Bu ifadeler asla kullanılmaz:
- "Should work now"
- "Looks correct"
- "I'm confident that..."
- "This should fix it"
- "It probably works"

Bunların yerine: komutu çalıştır, çıktıyı oku, kanıtla göster.

## 5 Adımlı Doğrulama

### 1. IDENTIFY — Ne Doğrulanacak?
İddianı tek cümleyle yaz:
- "Tüm testler geçiyor"
- "Build sıfır warning ile tamamlanıyor"
- "POST /api/projects 201 dönüyor"
- "Domain katmanında dış bağımlılık yok"

### 2. RUN — Doğrulama Komutunu Çalıştır
İddiaya uygun komutu belirle ve çalıştır:

| İddia | Komut |
|-------|-------|
| Build başarılı | `dotnet build` |
| Testler geçiyor | `dotnet test` |
| Endpoint çalışıyor | `curl -s -o /dev/null -w "%{http_code}" http://...` |
| Dış bağımlılık yok | `dotnet list src/CrewOps.Domain/ package` |
| Migration uygulandı | `dotnet ef database update --dry-run` |

### 3. READ — Çıktıyı Tamamen Oku
- Exit code kontrol et (0 = başarı)
- Warning'leri oku (warning = potansiyel sorun)
- Error mesajlarını tam oku (ilk satırda değil, tam stack trace'de)
- Çıktıyı kısaltma veya özetleme — tam oku

### 4. VERIFY — Çıktı İddiayla Eşleşiyor mu?
- Beklenen vs gerçek sonucu karşılaştır
- Eşleşiyorsa → Adım 5
- Eşleşmiyorsa → İddiayı DÜZELT, sorunu TANI, tekrar Adım 1'den başla

### 5. CLAIM — Kanıtla İddia Et

Format:
```
✓ DOĞRULANDI: [iddia]
  Komut: [çalıştırılan komut]
  Sonuç: [exit code + özet]
  Kanıt: [çıktıdan ilgili satır]
```

## Yaygın Doğrulama Senaryoları

### Feature Tamamlama
```
/verify "Build sıfır warning"
/verify "115+ test geçiyor"
/verify "Domain'de dış bağımlılık yok"
```

### Bug Fix
```
/verify "Bug reproduce edildi (test kırmızı)"
/verify "Fix uygulandı (test yeşil)"
/verify "Regression yok (tüm testler geçiyor)"
```

### Deployment
```
/verify "Health endpoint 200 dönüyor"
/verify "Migration başarılı"
/verify "Yeni endpoint erişilebilir"
```
