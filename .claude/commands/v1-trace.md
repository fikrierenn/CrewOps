---
description: "V1 engine'den V2 karşılığını bul — kod akışı izleme ve çeviri"
argument-hint: "<V1 engine veya feature adı>"
---

# V1 → V2 Kod İzleme

Belirtilen V1 engine veya feature'ın kod akışını izle, V2 karşılığını belirle.

## Adım 1: V1 Kaynağını Bul

Kullanıcının belirttiği engine/feature'ı ara:

1. `packages/core/` altında ilgili TypeScript dosyasını bul
2. `apps/api/` altında ilgili endpoint'leri bul
3. `packages/db/` altında ilgili repository'yi bul

Dosyaları oku ve ana akışı anla.

## Adım 2: Kod Akışını İzle

V1'deki data flow'u çıkar:

```
[Giriş noktası] → [İşlem 1] → [İşlem 2] → ... → [Çıkış]
```

Örnek:
```
API endpoint (apps/api/)
  → Engine method (packages/core/)
    → DB query (packages/db/)
    → LLM call (ClaudeCodeRunner/GeminiRunner)
    → Output parse (OutputParser)
  → Response
```

## Adım 3: V2 Karşılık Tablosu

Her V1 bileşeni için V2 karşılığını belirle:

| V1 Bileşen | V1 Dosya | V2 Karşılık | V2 Modül |
|------------|----------|-------------|----------|
| Express endpoint | apps/api/... | Minimal API | CrewOps.Api |
| Engine method | packages/core/... | MediatR handler | CrewOps.Application |
| SQLite query | packages/db/... | EF Core | CrewOps.Infrastructure |
| SSE push | apps/api/... | SignalR | CrewOps.Api |
| ... | ... | ... | ... |

## Adım 4: Davranış Farkları

V1 ve V2 arasındaki davranış farklarını belgele:
- Aynı kalan davranışlar
- Değişen davranışlar (ve neden)
- V2'de eklenen yeni davranışlar

## Adım 5: Migrasyon Notları

- Kritik iş mantığı doğru taşınmış mı?
- Edge case'ler korunuyor mu?
- V1'de test var mı? Varsa V2'ye port edilmeli mi?

## Referans Belgeler

- `docs/PRESERVE_REFACTOR_REPLACE_MATRIX.md` — neyi koru, neyi değiştir
- `docs/METHOD_SOURCES_AND_TRANSLATION.md` — metod seviyesi çeviri
- `docs/V1_TO_V2_TRANSITION_PLAN.md` — genel migrasyon stratejisi
- `docs/CURRENT_STATE_ASSESSMENT.md` — V1 tamamlanma durumu
