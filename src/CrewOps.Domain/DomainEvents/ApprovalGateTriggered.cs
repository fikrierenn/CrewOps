namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Bir onay kapısı tetiklendiğinde üretilir.
/// Governance katmanı bu event'i alarak ilgili onay akışını başlatır.
/// </summary>
public sealed record ApprovalGateTriggered(
    Guid ProjectId,
    string GateName,
    string RequiredApprover,
    DateTime OccurredAt) : IDomainEvent;
