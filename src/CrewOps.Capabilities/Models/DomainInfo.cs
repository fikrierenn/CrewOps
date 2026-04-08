using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities.Models;

/// <summary>
/// Bir iş alanının (software, marketing, seo vb.) temel bilgilerini tanımlar.
/// TeamTemplate seçimi ve varsayılan yapılandırma için kullanılır.
/// </summary>
public sealed record DomainInfo
{
    /// <summary>Domain tanımlayıcısı (örn. "software", "marketing").</summary>
    public required string Id { get; init; }

    /// <summary>Görünen ad (örn. "Yazılım Geliştirme").</summary>
    public required string DisplayName { get; init; }

    /// <summary>Açıklama.</summary>
    public string? Description { get; init; }

    /// <summary>Bu domain'deki projelerin varsayılan çıktı tipi.</summary>
    public OutputType DefaultOutputType { get; init; } = OutputType.Document;

    /// <summary>Bu domain'deki projelerin varsayılan yönetişim kuralları.</summary>
    public GovernancePreset DefaultGovernance { get; init; } = GovernancePreset.Minimal;

    /// <summary>Bu domain'de varsayılan olarak kullanılacak rol ID'leri.</summary>
    public IReadOnlyList<string> DefaultRoleIds { get; init; } = [];
}
