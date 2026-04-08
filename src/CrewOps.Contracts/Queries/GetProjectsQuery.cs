using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Queries;

public sealed record GetProjectsQuery() : IRequest<IReadOnlyList<ProjectDto>>;
