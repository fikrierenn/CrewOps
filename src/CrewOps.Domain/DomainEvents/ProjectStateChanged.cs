using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Proje state machine'i her başarılı geçişte bu event'i üretir.
/// Audit log ve UI güncelleme akışları bu event'i dinler.
/// </summary>
public sealed record ProjectStateChanged(
    Guid ProjectId,
    ProjectState FromState,
    ProjectState ToState,
    string? TriggeredBy,
    DateTime OccurredAt) : IDomainEvent;
