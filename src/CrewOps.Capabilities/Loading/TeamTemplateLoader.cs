using System.Text.Json;
using System.Text.Json.Serialization;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities.Loading;

/// <summary>
/// templates/team-templates/*.json dosyalarını okuyarak TeamTemplate listesi oluşturur.
/// </summary>
public sealed class TeamTemplateLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    /// <summary>
    /// Verilen dizindeki tüm .json dosyalarını TeamTemplate olarak yükler.
    /// </summary>
    /// <param name="templatesDirectory">templates/team-templates/ dizini yolu.</param>
    public IReadOnlyList<TeamTemplate> Load(string templatesDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templatesDirectory);

        if (!Directory.Exists(templatesDirectory))
            return [];

        var results = new List<TeamTemplate>();

        foreach (var file in Directory.GetFiles(templatesDirectory, "*.json"))
        {
            var template = LoadFile(file);
            if (template is not null)
                results.Add(template);
        }

        return results.AsReadOnly();
    }

    private static TeamTemplate? LoadFile(string filePath)
    {
        try
        {
            var json = File.ReadAllText(filePath);
            var dto = JsonSerializer.Deserialize<TeamTemplateDto>(json, JsonOptions);
            if (dto is null || string.IsNullOrWhiteSpace(dto.Name))
                return null;

            var governance = new GovernancePreset
            {
                RequireAgreement = dto.Governance?.RequireAgreement ?? true,
                RequirePlanApproval = dto.Governance?.RequirePlanApproval ?? true,
                RequireHumanReview = dto.Governance?.RequireHumanReview ?? true,
                HasQaPhase = dto.Governance?.HasQaPhase ?? false,
                HasStagingGate = dto.Governance?.HasStagingGate ?? false,
                HasProductionGate = dto.Governance?.HasProductionGate ?? false
            };

            var roleSlots = (dto.Roles ?? [])
                .Select(r => new TeamRoleSlot(
                    r.RoleId ?? "unknown",
                    r.DisplayName ?? r.RoleId ?? "unknown",
                    r.ModelTier ?? ModelTier.Complex,
                    r.IsRequired ?? true))
                .ToList()
                .AsReadOnly();

            return new TeamTemplate(
                Id: dto.Id ?? Guid.NewGuid(),
                Name: dto.Name,
                Domain: dto.Domain ?? "general",
                Description: dto.Description ?? string.Empty,
                Governance: governance,
                DefaultOutputType: dto.DefaultOutputType ?? OutputType.Document,
                RoleSlots: roleSlots);
        }
        catch
        {
            return null;
        }
    }

    // ─── DTO'lar ─────────────────────────────────────────────

    private sealed class TeamTemplateDto
    {
        public Guid? Id { get; set; }
        public string? Name { get; set; }
        public string? Domain { get; set; }
        public string? Description { get; set; }
        public OutputType? DefaultOutputType { get; set; }
        public GovernanceDto? Governance { get; set; }
        public List<RoleSlotDto>? Roles { get; set; }
    }

    private sealed class GovernanceDto
    {
        public bool? RequireAgreement { get; set; }
        public bool? RequirePlanApproval { get; set; }
        public bool? RequireHumanReview { get; set; }
        public bool? HasQaPhase { get; set; }
        public bool? HasStagingGate { get; set; }
        public bool? HasProductionGate { get; set; }
    }

    private sealed class RoleSlotDto
    {
        public string? RoleId { get; set; }
        public string? DisplayName { get; set; }
        public ModelTier? ModelTier { get; set; }
        public bool? IsRequired { get; set; }
    }
}
