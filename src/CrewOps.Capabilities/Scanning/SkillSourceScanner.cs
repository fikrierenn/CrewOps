using CrewOps.Capabilities.Models;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace CrewOps.Capabilities.Scanning;

/// <summary>
/// agents-main/plugins/ dizinini tarar, SKILL.md dosyalarını parse eder
/// ve SkillManifest listesi döner.
///
/// SKILL.md formatı:
/// ---
/// name: skill-adı
/// description: Skill açıklaması
/// ---
/// # Markdown içerik (Tier 2)
/// </summary>
public sealed class SkillSourceScanner
{
    private readonly IDeserializer _yamlDeserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    /// <summary>
    /// Verilen kök dizin altında agents-main/plugins/*/skills/*/SKILL.md dosyalarını tarar.
    /// </summary>
    /// <param name="agentsMainPath">agents-main/ dizininin tam yolu.</param>
    /// <returns>Bulunan tüm skill manifest'leri.</returns>
    public IReadOnlyList<SkillManifest> Scan(string agentsMainPath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(agentsMainPath);

        var pluginsDir = Path.Combine(agentsMainPath, "plugins");
        if (!Directory.Exists(pluginsDir))
            return [];

        var results = new List<SkillManifest>();

        foreach (var pluginDir in Directory.GetDirectories(pluginsDir))
        {
            var pluginName = Path.GetFileName(pluginDir);
            var skillsDir = Path.Combine(pluginDir, "skills");

            if (!Directory.Exists(skillsDir))
                continue;

            foreach (var skillDir in Directory.GetDirectories(skillsDir))
            {
                var skillFile = Path.Combine(skillDir, "SKILL.md");
                if (!File.Exists(skillFile))
                    continue;

                var manifest = ParseSkillFile(skillFile, pluginName);
                if (manifest is not null)
                    results.Add(manifest);
            }
        }

        return results.AsReadOnly();
    }

    private SkillManifest? ParseSkillFile(string filePath, string pluginName)
    {
        try
        {
            var content = File.ReadAllText(filePath);
            var (frontmatter, body) = ExtractFrontmatter(content);

            if (string.IsNullOrWhiteSpace(frontmatter))
                return null;

            var meta = _yamlDeserializer.Deserialize<SkillFrontmatter>(frontmatter);
            if (string.IsNullOrWhiteSpace(meta?.Name))
                return null;

            var skillDirName = Path.GetFileName(Path.GetDirectoryName(filePath))!;
            var referencesDir = Path.Combine(Path.GetDirectoryName(filePath)!, "references");

            return new SkillManifest
            {
                Id = $"{pluginName}/{skillDirName}",
                Name = meta.Name,
                Description = meta.Description ?? string.Empty,
                PluginDomain = pluginName,
                MarkdownBody = string.IsNullOrWhiteSpace(body) ? null : body.Trim(),
                ResourcePath = Directory.Exists(referencesDir) ? referencesDir : null,
                SourcePath = filePath
            };
        }
        catch
        {
            // Parse hatası olan SKILL.md dosyaları sessizce atlanır
            return null;
        }
    }

    private static (string? Frontmatter, string? Body) ExtractFrontmatter(string content)
    {
        if (!content.StartsWith("---"))
            return (null, content);

        var endIndex = content.IndexOf("---", 3, StringComparison.Ordinal);
        if (endIndex < 0)
            return (null, content);

        var frontmatter = content[3..endIndex].Trim();
        var body = content[(endIndex + 3)..];

        return (frontmatter, body);
    }

    /// <summary>YAML frontmatter deserialization hedefi.</summary>
    private sealed class SkillFrontmatter
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
    }
}
