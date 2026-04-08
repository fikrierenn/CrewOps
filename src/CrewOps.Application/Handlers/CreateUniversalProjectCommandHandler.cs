using CrewOps.Application.Mapping;
using CrewOps.Contracts.Commands;
using CrewOps.Contracts.Dtos;
using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using MediatR;

namespace CrewOps.Application.Handlers;

public sealed class CreateUniversalProjectCommandHandler : IRequestHandler<CreateUniversalProjectCommand, ProjectDto>
{
    private readonly IProjectRepository _repo;

    public CreateUniversalProjectCommandHandler(IProjectRepository repo) => _repo = repo;

    public async Task<ProjectDto> Handle(CreateUniversalProjectCommand request, CancellationToken ct)
    {
        var project = Project.CreateUniversal(
            request.Name, request.InitialRequest,
            request.RepoPath, request.Stack, request.Domain);
        await _repo.AddAsync(project, ct);
        return DtoMapper.ToDto(project);
    }
}
