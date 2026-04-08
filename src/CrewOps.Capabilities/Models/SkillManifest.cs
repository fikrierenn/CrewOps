namespace CrewOps.Capabilities.Models;

/// <summary>
/// agents-main/plugins/ altındaki SKILL.md dosyasından parse edilen bilgi birimi.
/// Üç katmanlı bilgi modeli:
/// - Tier 1 (Metadata): Name, Description — her zaman yüklü (~100 token)
/// - Tier 2 (Instructions): MarkdownBody — aktivasyonda yüklenir (~500-2000 token)
/// - Tier 3 (Resources): ResourcePath — isteğe bağlı yüklenir (değişken token)
/// </summary>
public sealed record SkillManifest
{
    /// <summary>Benzersiz tanımlayıcı (plugin-adı/skill-adı formatında).</summary>
    public required string Id { get; init; }

    /// <summary>YAML frontmatter'daki name alanı.</summary>
    public required string Name { get; init; }

    /// <summary>YAML frontmatter'daki description alanı.</summary>
    public required string Description { get; init; }

    /// <summary>Üst plugin dizininden türetilen domain adı (örn. "backend-development").</summary>
    public required string PluginDomain { get; init; }

    /// <summary>Tier 2: YAML frontmatter sonrasındaki markdown içeriği.</summary>
    public string? MarkdownBody { get; init; }

    /// <summary>Tier 3: references/ dizini varsa yolu.</summary>
    public string? ResourcePath { get; init; }

    /// <summary>SKILL.md dosyasının tam yolu.</summary>
    public required string SourcePath { get; init; }
}
