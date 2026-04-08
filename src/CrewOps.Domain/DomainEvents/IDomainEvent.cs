namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Domain katmanında üretilen tüm event'lerin temel arayüzü.
/// Domain event'ler geçmişe dönük, değiştirilemez kayıtlardır.
/// </summary>
public interface IDomainEvent
{
    /// <summary>Event'in üretildiği UTC zaman damgası.</summary>
    DateTime OccurredAt { get; }
}
