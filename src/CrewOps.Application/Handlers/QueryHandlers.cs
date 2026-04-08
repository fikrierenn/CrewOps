using CrewOps.Application.Mapping;
using CrewOps.Contracts.Dtos;
using CrewOps.Contracts.Queries;
using CrewOps.Domain.Ports;
using MediatR;

namespace CrewOps.Application.Handlers;

// ─── GetProjectById ──────────────────────────────────────────

public sealed class GetProjectByIdQueryHandler : IRequestHandler<GetProjectByIdQuery, ProjectDto?>
{
    private readonly IProjectRepository _repo;
    public GetProjectByIdQueryHandler(IProjectRepository repo) => _repo = repo;

    public async Task<ProjectDto?> Handle(GetProjectByIdQuery request, CancellationToken ct)
    {
        var project = await _repo.FindByIdAsync(request.ProjectId, ct);
        return project is null ? null : DtoMapper.ToDto(project);
    }
}

// ─── GetProjects ─────────────────────────────────────────────

public sealed class GetProjectsQueryHandler : IRequestHandler<GetProjectsQuery, IReadOnlyList<ProjectDto>>
{
    private readonly IProjectRepository _repo;
    public GetProjectsQueryHandler(IProjectRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<ProjectDto>> Handle(GetProjectsQuery request, CancellationToken ct)
    {
        var projects = await _repo.GetAllAsync(ct);
        return projects.Select(DtoMapper.ToDto).ToList().AsReadOnly();
    }
}

// ─── GetTasksByProject ───────────────────────────────────────

public sealed class GetTasksByProjectQueryHandler : IRequestHandler<GetTasksByProjectQuery, IReadOnlyList<TaskDto>>
{
    private readonly ITaskRepository _repo;
    public GetTasksByProjectQueryHandler(ITaskRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<TaskDto>> Handle(GetTasksByProjectQuery request, CancellationToken ct)
    {
        var tasks = await _repo.GetByProjectIdAsync(request.ProjectId, ct);
        return tasks.Select(DtoMapper.ToDto).ToList().AsReadOnly();
    }
}

// ─── GetProjectTimeline ──────────────────────────────────────

public sealed class GetProjectTimelineQueryHandler : IRequestHandler<GetProjectTimelineQuery, IReadOnlyList<AuditEventDto>>
{
    private readonly IAuditEventRepository _repo;
    public GetProjectTimelineQueryHandler(IAuditEventRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<AuditEventDto>> Handle(GetProjectTimelineQuery request, CancellationToken ct)
    {
        var events = await _repo.GetByProjectIdAsync(request.ProjectId, request.From, request.To, ct);
        return events.Select(DtoMapper.ToDto).ToList().AsReadOnly();
    }
}

// ─── GetRunsByProject ────────────────────────────────────────

public sealed class GetRunsByProjectQueryHandler : IRequestHandler<GetRunsByProjectQuery, IReadOnlyList<ExecutionRunDto>>
{
    private readonly IExecutionRunRepository _repo;
    public GetRunsByProjectQueryHandler(IExecutionRunRepository repo) => _repo = repo;

    public async Task<IReadOnlyList<ExecutionRunDto>> Handle(GetRunsByProjectQuery request, CancellationToken ct)
    {
        var runs = await _repo.GetByProjectIdAsync(request.ProjectId, ct);
        return runs.Select(DtoMapper.ToDto).ToList().AsReadOnly();
    }
}
