namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Bir görev başarıyla tamamlandığında ve onaylandığında üretilir.
/// Orchestration loop bu event'i dinleyerek bağımlı görevleri kuyruğa alır.
/// </summary>
public sealed record TaskCompleted(
    Guid ProjectId,
    Guid TaskId,
    string RoleId,
    DateTime OccurredAt) : IDomainEvent;
