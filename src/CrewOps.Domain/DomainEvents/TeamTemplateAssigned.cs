namespace CrewOps.Domain.DomainEvents;

/// <summary>
/// Projeye bir takım şablonu atandığında üretilir.
/// Governance preset ve rol slotları bu andan itibaren projeye bağlıdır.
/// </summary>
public sealed record TeamTemplateAssigned(
    Guid ProjectId,
    Guid TeamTemplateId,
    string TemplateName,
    DateTime OccurredAt) : IDomainEvent;
