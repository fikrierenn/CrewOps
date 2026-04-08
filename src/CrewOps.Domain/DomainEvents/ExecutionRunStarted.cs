namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Bir ExecutionRun worker tarafından çalıştırılmaya başlandığında üretilir.
/// Observability ve real-time dashboard güncellemeleri bu event'i dinler.
/// </summary>
public sealed record ExecutionRunStarted(
    Guid ProjectId,
    Guid TaskId,
    Guid RunId,
    string RoleId,
    DateTime OccurredAt) : IDomainEvent;
