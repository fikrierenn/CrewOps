using System.Text.Json;
using System.Text.Json.Serialization;
using CrewOps.Capabilities.Models;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Capabilities.Loading;

/// <summary>
/// templates/roles/*.json dosyalarını okuyarak RoleProfile listesi oluşturur.
/// V1 JSON formatını V2 RoleProfile modeline dönüştürür.
/// </summary>
public sealed class RoleProfileLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    /// <summary>
    /// Verilen dizindeki tüm .json dosyalarını okuyup RoleProfile listesi döner.
    /// </summary>
    /// <param name="rolesDirectory">templates/roles/ dizini yolu.</param>
    public IReadOnlyList<RoleProfile> Load(string rolesDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rolesDirectory);

        if (!Directory.Exists(rolesDirectory))
            return [];

        var results = new List<RoleProfile>();

        foreach (var file in Directory.GetFiles(rolesDirectory, "*.json"))
        {
            var profile = LoadFile(file);
            if (profile is not null)
                results.Add(profile);
        }

        return results.AsReadOnly();
    }

    private static RoleProfile? LoadFile(string filePath)
    {
        try
        {
            var json = File.ReadAllText(filePath);
            var v1 = JsonSerializer.Deserialize<V1RoleJson>(json, JsonOptions);
            if (v1 is null || string.IsNullOrWhiteSpace(v1.RoleId))
                return null;

            return new RoleProfile
            {
                RoleId = v1.RoleId,
                DisplayName = v1.DisplayName ?? v1.RoleId,
                Avatar = v1.Avatar,
                Skills = v1.Skills ?? [],
                WorkStyle = v1.WorkStyle,
                DefaultModelTier = MapModelTier(v1.DefaultModelPolicy),
                DefinitionOfDone = v1.DefinitionOfDone ?? []
            };
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// V1 model policy'yi V2 ModelTier'a dönüştürür.
    /// V1'deki en yüksek seviye (complex) referans alınır.
    /// </summary>
    private static ModelTier MapModelTier(V1ModelPolicy? policy)
    {
        if (policy is null)
            return ModelTier.Complex;

        // V1'de complex tier → advanced model → Critical
        // Ama varsayılan roller genellikle Complex seviyesinde çalışır
        // PM ve Architect gibi roller ise Critical'da
        return ModelTier.Complex;
    }

    // ─── V1 JSON deserialization modelleri ────────────────────

    private sealed class V1RoleJson
    {
        public string? RoleId { get; set; }
        public string? DisplayName { get; set; }
        public string? Avatar { get; set; }
        public List<string>? Skills { get; set; }
        public string? WorkStyle { get; set; }
        public V1ModelPolicy? DefaultModelPolicy { get; set; }
        public List<string>? DefinitionOfDone { get; set; }
    }

    private sealed class V1ModelPolicy
    {
        public string? Simple { get; set; }
        public string? Medium { get; set; }
        public string? Complex { get; set; }
    }
}
