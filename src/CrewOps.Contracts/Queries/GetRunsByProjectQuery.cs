using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Queries;

public sealed record GetRunsByProjectQuery(Guid ProjectId) : IRequest<IReadOnlyList<ExecutionRunDto>>;
