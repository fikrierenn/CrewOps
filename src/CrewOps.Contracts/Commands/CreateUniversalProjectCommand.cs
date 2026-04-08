using CrewOps.Contracts.Dtos;
using MediatR;

namespace CrewOps.Contracts.Commands;

/// <summary>Herhangi bir domain için evrensel proje oluşturur.</summary>
public sealed record CreateUniversalProjectCommand(
    string Name,
    string InitialRequest,
    string? RepoPath = null,
    string? Stack = null,
    string? Domain = null) : IRequest<ProjectDto>;
