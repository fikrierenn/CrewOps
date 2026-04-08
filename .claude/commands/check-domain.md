---
description: "Domain katmanı sağlık kontrolü — invariant, state machine, event tutarlılığı"
---

# Domain Katmanı Sağlık Kontrolü

CrewOps.Domain projesinin DDD kurallarına uygunluğunu kontrol et.

## Kontrol 1: Derleme

```bash
dotnet build src/CrewOps.Domain/
```

Hata varsa raporla ve dur.

## Kontrol 2: Aggregate Kuralları

`src/CrewOps.Domain/Aggregates/` altındaki her dosya için kontrol et:
- [ ] `sealed class` mı?
- [ ] Private parameterless constructor var mı? (EF Core)
- [ ] Static factory method var mı? (Create/CreateXxx)
- [ ] `IReadOnlyList<IDomainEvent> DomainEvents` property var mı?
- [ ] `ClearDomainEvents()` method var mı?
- [ ] Public setter var mı? (OLMAMALI — `private set` kullanılmalı)
- [ ] Constructor'dan direkt `new` ile oluşturuluyor mu? (OLMAMALI — factory method)

## Kontrol 3: Value Object Kuralları

`src/CrewOps.Domain/ValueObjects/` altındaki her dosya için:
- [ ] Record veya enum mı? (class olmamalı)
- [ ] Mutable property var mı? (OLMAMALI)

## Kontrol 4: State Machine Tutarlılığı

- [ ] ProjectState enum'daki tüm state'ler GovernancePreset ile tutarlı mı?
- [ ] GovernancePreset.Minimal ile erişilemeyen state'ler doğru mu? (InQa, staging/prod state'leri)
- [ ] Terminal state'lerden (Completed, Failed, RolledBack) çıkış yolu yok mu?

## Kontrol 5: Domain Event Bütünlüğü

`src/CrewOps.Domain/DomainEvents/` altındaki her event için:
- [ ] `IDomainEvent` interface'ini implement ediyor mu?
- [ ] `record` olarak tanımlı mı? (class değil)
- [ ] `DateTime OccurredAt` property var mı?
- [ ] En az bir aggregate tarafından emit ediliyor mu?

## Kontrol 6: Port Tutarlılığı

`src/CrewOps.Domain/Ports/` altındaki her interface için:
- [ ] Karşılık gelen aggregate mevcut mu?
- [ ] Async method'lar `CancellationToken ct = default` parametresi alıyor mu?
- [ ] Return type'lar doğru mu? (nullable single, list for collections)

## Kontrol 7: Bağımlılık Kontrolü

```bash
dotnet list src/CrewOps.Domain/CrewOps.Domain.csproj package
```

- [ ] Sıfır dış bağımlılık olmalı (Domain katmanı saf kalmalı)

## Rapor

Tüm kontrollerin sonucunu tablo halinde göster:

| Kontrol | Durum | Detay |
|---------|-------|-------|
| Derleme | OK/FAIL | ... |
| Aggregate kuralları | OK/FAIL | ... |
| ... | ... | ... |

Sorun varsa düzeltme önerisi sun.
