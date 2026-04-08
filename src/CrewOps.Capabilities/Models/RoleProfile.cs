using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities.Models;

/// <summary>
/// templates/roles/*.json dosyasından yüklenen rol profili.
/// Bir rolün hangi becerilere sahip olduğunu, varsayılan model seviyesini
/// ve tamamlanma kriterlerini tanımlar.
/// </summary>
public sealed record RoleProfile
{
    /// <summary>Rol tanımlayıcısı (örn. "backend", "pm", "qa").</summary>
    public required string RoleId { get; init; }

    /// <summary>Görünen ad (örn. "Backend Engineer").</summary>
    public required string DisplayName { get; init; }

    /// <summary>Emoji avatar.</summary>
    public string? Avatar { get; init; }

    /// <summary>Rolün becerileri listesi.</summary>
    public IReadOnlyList<string> Skills { get; init; } = [];

    /// <summary>Çalışma tarzı açıklaması.</summary>
    public string? WorkStyle { get; init; }

    /// <summary>Varsayılan model seviyesi (V1 complex → Critical, medium → Complex, simple → Operational).</summary>
    public ModelTier DefaultModelTier { get; init; } = ModelTier.Complex;

    /// <summary>Tamamlanma kriterleri listesi.</summary>
    public IReadOnlyList<string> DefinitionOfDone { get; init; } = [];
}
