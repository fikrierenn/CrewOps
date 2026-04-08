using System.Text.Json;

namespace CrewOps.Api.Services;

/// <summary>
/// Sektör skill'lerini yükler — agents-main/plugins/crewops-core/skills/domain-classifier/sectors/{sector}.json
/// OrchestrationEngine bu servisi kullanarak sektöre özel prompt ve içerik üretir.
/// Hardcode if/else yerine JSON dosyalarından okur.
/// </summary>
public sealed class SectorSkillLoader
{
    private readonly ILogger<SectorSkillLoader> _logger;
    private readonly Dictionary<string, SectorConfig> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly string _sectorsPath;

    public SectorSkillLoader(ILogger<SectorSkillLoader> logger)
    {
        _logger = logger;
        _sectorsPath = Path.Combine(
            AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..",
            "agents-main", "plugins", "crewops-core", "skills", "domain-classifier", "sectors");

        // Alternatif yol (development)
        if (!Directory.Exists(_sectorsPath))
        {
            _sectorsPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..",
                "agents-main", "plugins", "crewops-core", "skills", "domain-classifier", "sectors");
        }

        LoadAll();
    }

    /// <summary>Kullanıcı mesajından sektör config'ini döner.</summary>
    public SectorConfig Classify(string userMessage, string? projectName = null)
    {
        var combined = $"{userMessage} {projectName}".ToLowerInvariant();

        // Tüm sektörlerin keyword'lerini kontrol et
        SectorConfig? bestMatch = null;
        var bestScore = 0;

        foreach (var (_, config) in _cache)
        {
            var score = 0;
            foreach (var keyword in config.SearchKeywords)
            {
                var normalized = keyword.ToLowerInvariant()
                    .Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u')
                    .Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g');
                var combinedNorm = combined
                    .Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u')
                    .Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g');

                if (combinedNorm.Contains(normalized))
                    score += keyword.Length; // Uzun eşleşme daha spesifik
            }

            if (score > bestScore)
            {
                bestScore = score;
                bestMatch = config;
            }
        }

        if (bestMatch is not null)
        {
            _logger.LogInformation("Sektör tespit edildi: {Sector} (skor: {Score})", bestMatch.Sector, bestScore);
            return bestMatch;
        }

        _logger.LogWarning("Sektör tespit edilemedi, default kullanılıyor");
        return SectorConfig.Default;
    }

    /// <summary>Sektör adıyla config döner.</summary>
    public SectorConfig? GetByName(string sectorName)
    {
        return _cache.GetValueOrDefault(sectorName);
    }

    /// <summary>Tüm yüklü sektörleri döner.</summary>
    public IReadOnlyList<SectorConfig> GetAll() => _cache.Values.ToList();

    /// <summary>Sektör var mı kontrol et.</summary>
    public bool Exists(string sectorName) => _cache.ContainsKey(sectorName);

    /// <summary>Yeni sektör config'i ekler (skill-creator tarafından).</summary>
    public void Register(SectorConfig config)
    {
        _cache[config.Sector] = config;
        _logger.LogInformation("Yeni sektör kaydedildi: {Sector}", config.Sector);

        // JSON dosyasına da kaydet
        try
        {
            var path = Path.Combine(_sectorsPath, $"{config.Sector}.json");
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            });
            File.WriteAllText(path, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Sektör dosyası kaydedilemedi: {Sector}", config.Sector);
        }
    }

    private void LoadAll()
    {
        if (!Directory.Exists(_sectorsPath))
        {
            _logger.LogWarning("Sektör dizini bulunamadı: {Path}", _sectorsPath);
            return;
        }

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        foreach (var file in Directory.GetFiles(_sectorsPath, "*.json"))
        {
            try
            {
                var json = File.ReadAllText(file);
                var config = JsonSerializer.Deserialize<SectorConfig>(json, options);
                if (config is not null)
                {
                    _cache[config.Sector] = config;
                    _logger.LogInformation("Sektör yüklendi: {Sector} ({Keywords} keyword)",
                        config.Sector, config.SearchKeywords.Length);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Sektör dosyası okunamadı: {File}", file);
            }
        }

        _logger.LogInformation("Toplam {Count} sektör yüklendi", _cache.Count);
    }
}

/// <summary>Sektör yapılandırması — JSON dosyasından okunur.</summary>
public sealed class SectorConfig
{
    public string Sector { get; set; } = "unknown";
    public string SectorLabel { get; set; } = "İşletmeler";
    public string Category { get; set; } = "genel";
    public string[] SearchKeywords { get; set; } = [];
    public string[] ExcludeKeywords { get; set; } = [];
    public string[] TypicalServices { get; set; } = [];
    public string[] ServiceEmojis { get; set; } = [];
    public string SloganStyle { get; set; } = "";
    public string[] SloganExamples { get; set; } = [];
    public string ReviewStyle { get; set; } = "";
    public string[] ReviewExamples { get; set; } = [];
    public string AboutTone { get; set; } = "";
    public string MapSearchQuery { get; set; } = "{district} {city} işletme";

    public bool NeedsSkillCreation => Sector == "unknown";

    public static SectorConfig Default => new()
    {
        Sector = "unknown",
        SectorLabel = "İşletmeler",
        SearchKeywords = ["işletme", "dükkan", "mağaza"],
        TypicalServices = ["Hizmet 1", "Hizmet 2", "Hizmet 3", "Hizmet 4", "Hizmet 5", "Hizmet 6"],
        ServiceEmojis = ["⭐", "💼", "🏢", "📋", "🎯", "✅"]
    };
}
