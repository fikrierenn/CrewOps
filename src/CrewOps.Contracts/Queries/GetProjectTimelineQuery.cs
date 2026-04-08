using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Queries;

public sealed record GetProjectTimelineQuery(
    Guid ProjectId,
    DateTime? From = null,
    DateTime? To = null) : IRequest<IReadOnlyList<AuditEventDto>>;
