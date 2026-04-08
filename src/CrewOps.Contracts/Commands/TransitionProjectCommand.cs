using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Commands;

/// <summary>Projeyi hedef state'e geçirir (StateMachine doğrulaması ile).</summary>
public sealed record TransitionProjectCommand(
    Guid ProjectId,
    string TargetState,
    string? TriggeredBy = null) : IRequest<ProjectDto>;
