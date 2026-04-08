using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Queries;

public sealed record GetTasksByProjectQuery(Guid ProjectId) : IRequest<IReadOnlyList<TaskDto>>;
