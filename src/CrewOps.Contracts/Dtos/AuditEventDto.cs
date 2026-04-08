namespace CrewOps.Contracts.Dtos;

public sealed record AuditEventDto(
    Guid EventId,
    Guid ProjectId,
    string EventType,
    string ActorId,
    string? Payload,
    DateTime OccurredAt);
