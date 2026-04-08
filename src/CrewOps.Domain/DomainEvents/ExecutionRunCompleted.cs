namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Bir ExecutionRun tamamlandığında (başarılı veya başarısız) üretilir.
/// Maliyet takibi ve analytics bu event'i dinler.
/// </summary>
public sealed record ExecutionRunCompleted(
    Guid ProjectId,
    Guid TaskId,
    Guid RunId,
    bool Success,
    decimal CostUsd,
    DateTime OccurredAt) : IDomainEvent;
