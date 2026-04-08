namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// İnsan kullanıcı tarafından mutabakat belgesi onaylandığında üretilir.
/// Bu event, planlama fazının başlangıcını tetikler.
/// </summary>
public sealed record AgreementApproved(
    Guid ProjectId,
    Guid AgreementId,
    string ApprovedBy,
    DateTime OccurredAt) : IDomainEvent;
