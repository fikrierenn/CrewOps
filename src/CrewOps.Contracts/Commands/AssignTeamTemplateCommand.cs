using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Commands;

/// <summary>Projeye takım şablonu atar.</summary>
public sealed record AssignTeamTemplateCommand(
    Guid ProjectId,
    Guid TeamTemplateId) : IRequest<ProjectDto>;
