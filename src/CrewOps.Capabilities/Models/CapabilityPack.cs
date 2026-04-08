namespace CrewOps.Capabilities.Models;

/// <summary>
/// Versiyonlanmış, domain kapsamlı yetenek paketi.
/// Bir veya birden fazla SkillManifest'i bir arada gruplar.
/// </summary>
public sealed record CapabilityPack
{
    /// <summary>Paket tanımlayıcısı (örn. "backend-excellence").</summary>
    public required string Id { get; init; }

    /// <summary>Semantik versiyon.</summary>
    public string Version { get; init; } = "1.0.0";

    /// <summary>Domain kapsamı (örn. "backend", "marketing").</summary>
    public required string Domain { get; init; }

    /// <summary>Görünen ad.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Açıklama.</summary>
    public string? Description { get; init; }

    /// <summary>Bu paketle uyumlu rol ID'leri.</summary>
    public IReadOnlyList<string> CompatibleRoles { get; init; } = [];

    /// <summary>Paketteki skill ID'leri.</summary>
    public IReadOnlyList<string> SkillIds { get; init; } = [];
}
