namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Domain'e özgü takım şablonu. Rolleri, yönetişim kurallarını ve varsayılan çıktı tipini tanımlar.
/// JSON dosyalarından startup'ta yüklenir, runtime'da değişmez (immutable value object).
/// </summary>
public sealed record TeamTemplate(
    Guid Id,
    string Name,
    string Domain,
    string Description,
    GovernancePreset Governance,
    OutputType DefaultOutputType,
    IReadOnlyList<TeamRoleSlot> RoleSlots);
