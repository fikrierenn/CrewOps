namespace CrewOps.Contracts.Dtos;

public sealed record ExecutionRunDto(
    Guid Id,
    Guid TaskId,
    Guid ProjectId,
    string RoleId,
    string ModelTier,
    string Status,
    int AttemptNumber,
    int InputTokens,
    int OutputTokens,
    decimal CostUsd,
    long DurationMs,
    string? RawOutput,
    string? ErrorMessage,
    DateTime CreatedAt,
    DateTime? StartedAt,
    DateTime? CompletedAt);
