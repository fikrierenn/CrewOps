namespace CrewOps.Contracts.Dtos;

public sealed record ProjectDto(
    Guid Id,
    string Name,
    string? RepoPath,
    string? Stack,
    string? Domain,
    string State,
    Guid? TeamTemplateId,
    string? AgreementSummary,
    DateTime CreatedAt,
    DateTime UpdatedAt);
