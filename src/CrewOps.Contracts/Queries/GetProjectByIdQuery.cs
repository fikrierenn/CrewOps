using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Queries;

public sealed record GetProjectByIdQuery(Guid ProjectId) : IRequest<ProjectDto?>;
