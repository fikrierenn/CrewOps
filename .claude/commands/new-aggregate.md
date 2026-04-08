---
description: "Yeni DDD aggregate root oluştur (factory method, domain events, EF Core uyumlu)"
argument-hint: "<AggregateName> [--with-events] [--with-repo]"
---

# Yeni Aggregate Root Oluştur

Kullanıcının verdiği isimle CrewOps DDD kurallarına uygun yeni bir aggregate root scaffold'la.

## Ön Kontroller

1. `src/CrewOps.Domain/Aggregates/` dizinini oku — mevcut aggregate'leri öğren
2. Kullanıcının verdiği isim zaten var mı kontrol et
3. Mevcut aggregate'lerin pattern'ini incele (Project.cs, CrewOpsTask.cs referans)

## Aggregate Dosyası Oluştur

Dosya: `src/CrewOps.Domain/Aggregates/{AggregateName}.cs`

Şablon kuralları:
- `sealed class` kullan
- Private parameterless constructor (EF Core için)
- `static {AggregateName} Create(...)` factory method
- `IReadOnlyList<IDomainEvent> DomainEvents` property
- `ClearDomainEvents()` method
- `DateTime CreatedAt` ve `DateTime UpdatedAt` timestamps
- XML doc comment'ler Türkçe
- Namespace: `CrewOps.Domain.Aggregates`

## İsteğe Bağlı: Domain Event

`--with-events` flag'i varsa `src/CrewOps.Domain/DomainEvents/` altına ilgili event record'u oluştur:

```csharp
public record {AggregateName}Created(
    Guid {AggregateName}Id,
    DateTime OccurredAt) : IDomainEvent;
```

## İsteğe Bağlı: Repository Port

`--with-repo` flag'i varsa `src/CrewOps.Domain/Ports/I{AggregateName}Repository.cs` oluştur:

```csharp
public interface I{AggregateName}Repository
{
    Task<{AggregateName}?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync({AggregateName} entity, CancellationToken ct = default);
    Task UpdateAsync({AggregateName} entity, CancellationToken ct = default);
}
```

## Tamamlama

1. Oluşturulan dosyaları listele
2. `dotnet build src/CrewOps.Domain/` ile derleme kontrolü yap
3. Hata varsa düzelt
