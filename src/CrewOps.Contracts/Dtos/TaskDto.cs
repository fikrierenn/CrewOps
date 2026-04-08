namespace CrewOps.Contracts.Dtos;

public sealed record TaskDto(
    Guid Id,
    Guid ProjectId,
    string Title,
    string Description,
    string RoleId,
    string ComplexityHint,
    string? DomainHint,
    string Status,
    int RetryCount,
    IReadOnlyList<Guid> DependencyIds,
    DateTime CreatedAt,
    DateTime UpdatedAt);
