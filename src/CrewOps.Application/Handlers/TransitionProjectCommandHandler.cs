using CrewOps.Application.Mapping;
using CrewOps.Contracts.Commands;
using CrewOps.Contracts.Dtos;
using CrewOps.Domain.Ports;
using CrewOps.Domain.StateMachine;
using CrewOps.Domain.ValueObjects;
using MediatR;

namespace CrewOps.Application.Handlers;

public sealed class TransitionProjectCommandHandler : IRequestHandler<TransitionProjectCommand, ProjectDto>
{
    private readonly IProjectRepository _repo;
    private readonly IProjectStateMachine _stateMachine;

    public TransitionProjectCommandHandler(IProjectRepository repo, IProjectStateMachine stateMachine)
    {
        _repo = repo;
        _stateMachine = stateMachine;
    }

    public async Task<ProjectDto> Handle(TransitionProjectCommand request, CancellationToken ct)
    {
        var project = await _repo.FindByIdAsync(request.ProjectId, ct)
            ?? throw new InvalidOperationException($"Proje bulunamadı: {request.ProjectId}");

        if (!Enum.TryParse<ProjectState>(request.TargetState, ignoreCase: true, out var targetState))
            throw new ArgumentException($"Geçersiz state: {request.TargetState}");

        _stateMachine.Transition(project, targetState, request.TriggeredBy);
        await _repo.UpdateAsync(project, ct);

        return DtoMapper.ToDto(project);
    }
}
