---
description: "Design gate — implementasyondan önce zorunlu tasarım onayı. 9 adımlı keşif → atom plan → onay."
argument-hint: "<feature veya değişiklik açıklaması>"
---

# Design Gate

Kod yazmadan önce zorunlu tasarım keşfi. Onay alınmadan implementasyon BAŞLAMAZ.

## Kural

> Hiçbir kod satırı, onaylanmış bir tasarım olmadan yazılmaz.
> Hiçbir tasarım, etki analizi yapılmadan onaylanmaz.

## 9 Adımlı Keşif Süreci

### Adım 1: Etkilenen Aggregate'leri Belirle
- Hangi aggregate root'lar değişecek? (Project, CrewOpsTask, ExecutionRun, vb.)
- Yeni aggregate gerekiyor mu?
- Mevcut invariant'lar bozulur mu?

### Adım 2: State Machine Etkisi
- `docs/WORKFLOW_STATE_MACHINE.md` oku
- ProjectStateMachine'da yeni transition gerekiyor mu?
- GovernancePreset'i etkileyen bir değişiklik mi?

### Adım 3: Capability Model Etkisi
- `docs/CAPABILITY_MODEL.md` oku
- Yeni skill, rol veya TeamTemplate gerekiyor mu?
- SkillSourceScanner'ı etkiler mi?

### Adım 4: Etkilenen Katmanları Listele

| Katman | Etkilenir mi? | Detay |
|--------|:---:|-------|
| Domain (aggregates, events, value objects) | ? | |
| Application (MediatR handlers) | ? | |
| Infrastructure (EF Core, external services) | ? | |
| Capabilities (scanner, registry, loaders) | ? | |
| API (Minimal API endpoints) | ? | |
| UI (Blazor pages/components) | ? | |

### Adım 5: Mevcut Kaynak Dosyaları Oku
- Değişecek her dosyayı **şimdi** oku — tahmine dayalı tasarım YAPMA
- Mevcut method signature'ları, constructor'ları, factory method'ları not et

### Adım 6: Benzer Pattern'leri Bul
- Aynı veya benzer bir şey daha önce nasıl yapılmış?
- Örnek: yeni aggregate → ExecutionRun.cs referans, yeni event → TeamTemplateAssigned referans
- Mevcut kodu kopyala-yapıştır yerine pattern'i anla

### Adım 7: Trade-off'lu Tasarım Kararları
Her karar noktası için:
- **Seçenek A**: [açıklama] — Avantaj: ..., Dezavantaj: ...
- **Seçenek B**: [açıklama] — Avantaj: ..., Dezavantaj: ...
- **Öneri**: [hangisi, neden]

### Adım 8: Atom Görevlere Böl
Her görev 2-5 dakikalık, bağımsız, doğrulanabilir olmalı.

Format:
```
Atom 1: [kısa açıklama]
  Dosya: src/CrewOps.Domain/ValueObjects/XxxYyy.cs
  İşlem: Yeni dosya
  Kod:
    public sealed record XxxYyy(string Name, int Value);
  Doğrulama: dotnet build src/CrewOps.Domain/
```

Kurallar:
- Placeholder YASAK ("// TODO", "// implement later", "similar to X" gibi ifadeler kullanma)
- Her atom'un tam dosya yolu ve kod bloğu olmalı
- Her atom sonrası doğrulama komutu belirtilmeli

### Adım 9: Kullanıcıya Sun ve Onay Al

Sunum formatı:
1. Değişiklik özeti (1-2 cümle)
2. Etkilenen dosyalar tablosu
3. Tasarım kararları
4. Atom görev listesi
5. Risk/dikkat noktaları

> **ONAY ALMADAN İMPLEMENTASYONA GEÇME.**

## Design Gate Çıktısı

Onay alındıktan sonra:
- Atom listesi → `/feature-dev` veya manuel implementasyon için hazır
- Her atom sırayla çalıştırılır
- Her atom sonrası `dotnet build` doğrulaması zorunlu
