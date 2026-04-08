namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir takım şablonundaki tek bir rol slotunu tanımlar.
/// RoleId dinamik roller için her zaman string kalır.
/// </summary>
public sealed record TeamRoleSlot(
    string RoleId,
    string DisplayName,
    ModelTier ModelTier,
    bool IsRequired);
