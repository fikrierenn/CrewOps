namespace CrewOps.Contracts.Dtos;

public sealed record TeamTemplateDto(
    Guid Id,
    string Name,
    string Domain,
    string Description,
    string DefaultOutputType,
    IReadOnlyList<RoleSlotDto> Roles);

public sealed record RoleSlotDto(
    string RoleId,
    string DisplayName,
    string ModelTier,
    bool IsRequired);
