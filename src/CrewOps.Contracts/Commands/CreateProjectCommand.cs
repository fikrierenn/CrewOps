using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Commands;

/// <summary>Yazılım projesi oluşturur (RepoPath ve Stack zorunlu).</summary>
public sealed record CreateProjectCommand(
    string Name,
    string RepoPath,
    string Stack,
    string InitialRequest) : IRequest<ProjectDto>;
