using CrewOps.Application.Mapping;
using CrewOps.Contracts.Commands;
using CrewOps.Contracts.Dtos;
using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using MediatR;

namespace CrewOps.Application.Handlers;

public sealed class CreateProjectCommandHandler : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    private readonly IProjectRepository _repo;

    public CreateProjectCommandHandler(IProjectRepository repo) => _repo = repo;

    public async Task<ProjectDto> Handle(CreateProjectCommand request, CancellationToken ct)
    {
        var project = Project.Create(request.Name, request.RepoPath, request.Stack, request.InitialRequest);
        await _repo.AddAsync(project, ct);
        return DtoMapper.ToDto(project);
    }
}
