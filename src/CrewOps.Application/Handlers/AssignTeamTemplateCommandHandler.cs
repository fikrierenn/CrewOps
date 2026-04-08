using CrewOps.Application.Mapping;
using CrewOps.Capabilities;
using CrewOps.Contracts.Commands;
using CrewOps.Contracts.Dtos;
using CrewOps.Domain.Ports;
using MediatR;

namespace CrewOps.Application.Handlers;

public sealed class AssignTeamTemplateCommandHandler : IRequestHandler<AssignTeamTemplateCommand, ProjectDto>
{
    private readonly IProjectRepository _projectRepo;
    private readonly ICapabilityRegistry _registry;

    public AssignTeamTemplateCommandHandler(IProjectRepository projectRepo, ICapabilityRegistry registry)
    {
        _projectRepo = projectRepo;
        _registry = registry;
    }

    public async Task<ProjectDto> Handle(AssignTeamTemplateCommand request, CancellationToken ct)
    {
        var project = await _projectRepo.FindByIdAsync(request.ProjectId, ct)
            ?? throw new InvalidOperationException($"Proje bulunamadı: {request.ProjectId}");

        var template = _registry.GetTeamTemplate(request.TeamTemplateId)
            ?? throw new InvalidOperationException($"Takım şablonu bulunamadı: {request.TeamTemplateId}");

        project.AssignTeamTemplate(template.Id, template.Name, template.Governance);
        await _projectRepo.UpdateAsync(project, ct);

        return DtoMapper.ToDto(project);
    }
}
