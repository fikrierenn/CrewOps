using CrewOps.Domain.Entities;
using CrewOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Api.Services;

public sealed class DemoSiteGenerator
{
    private readonly LlmClient _llm;
    private readonly IDbContextFactory<CrewOpsDbContext> _dbFactory;
    private readonly SectorSkillLoader _sectorLoader;
    private readonly ILogger<DemoSiteGenerator> _logger;
    // Template cache aşağıda GetTemplatesAsync'de

    private static readonly string[][] ColorThemes =
    [
        ["#8b5cf6", "#a78bfa", "#c4b5fd"],  // Purple
        ["#059669", "#34d399", "#6ee7b7"],  // Emerald
        ["#e11d48", "#fb7185", "#fda4af"],  // Rose
        ["#0891b2", "#22d3ee", "#67e8f9"],  // Cyan
        ["#c2410c", "#fb923c", "#fdba74"],  // Orange
        ["#7c3aed", "#a855f7", "#c084fc"],  // Violet
        ["#b45309", "#d97706", "#f59e0b"],  // Gold/Amber
        ["#1e3a5f", "#2563eb", "#60a5fa"],  // Navy
        ["#065f46", "#047857", "#10b981"],  // Forest
        ["#9f1239", "#e11d48", "#f43f5e"],  // Crimson
        ["#44403c", "#78716c", "#a8a29e"],  // Slate
        ["#92400e", "#b45309", "#d97706"],  // Terracotta
    ];

    private static readonly string[] HeroImages =
    [
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1633681122797-d14e9aeb8be7?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1470259078422-826894b933aa?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1540555700478-4be289fbec6e?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=1400&h=900&fit=crop",
        "https://images.unsplash.com/photo-1629397685944-7073e0547986?w=1400&h=900&fit=crop",
    ];

    public DemoSiteGenerator(LlmClient llm, IDbContextFactory<CrewOpsDbContext> dbFactory, SectorSkillLoader sectorLoader, ILogger<DemoSiteGenerator> logger)
    {
        _llm = llm;
        _dbFactory = dbFactory;
        _sectorLoader = sectorLoader;
        _logger = logger;
    }

    public async Task<int> GenerateDemoSitesAsync(Guid projectId, CancellationToken ct = default)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var leads = await db.Leads
            .Where(l => l.ProjectId == projectId && l.DemoSiteUrl == null)
            .ToListAsync(ct);

        var templates = await GetTemplatesAsync();
        var outputDir = Path.Combine("wwwroot", "demos", projectId.ToString());
        Directory.CreateDirectory(outputDir);
        var generated = 0;

        for (var i = 0; i < leads.Count; i++)
        {
            var lead = leads[i];
            try
            {
                _logger.LogInformation("Demo site: {Name}", lead.Name);

                // Gemini ile içerik üret
                var content = await GenerateContentAsync(lead, ct);
                var colors = ColorThemes[i % ColorThemes.Length];
                var heroImg = HeroImages[i % HeroImages.Length];
                var stars = lead.GoogleRating >= 4.5m ? "★★★★★" : "★★★★☆";
                var mapQ = System.Net.WebUtility.UrlEncode($"{lead.Name} {lead.Address}");
                var nameShort = lead.Name.Length > 25 ? lead.Name[..25] + "..." : lead.Name;

                var rgb1 = HexRgb(colors[0]);
                var rgb2 = HexRgb(colors[1]);

                // Akıllı template seçimi (aynı template üst üste gelmesin diye i offset ekle)
                var baseIdx = SelectTemplateIndex(lead, templates.Length);
                var templateIdx = (baseIdx + (i / templates.Length)) % templates.Length;
                var html = templates[templateIdx]
                    .Replace("{{NAME}}", Enc(lead.Name))
                    .Replace("{{NAME_SHORT}}", Enc(nameShort))
                    .Replace("{{SLOGAN}}", Enc(content.Slogan))
                    .Replace("{{ADDR}}", Enc(lead.Address ?? "İstanbul"))
                    .Replace("{{PHONE}}", Enc(lead.Phone ?? ""))
                    .Replace("{{RATING}}", lead.GoogleRating?.ToString("F1") ?? "4.5")
                    .Replace("{{REVIEWS}}", lead.GoogleReviewCount?.ToString() ?? "100")
                    .Replace("{{STARS_EMOJI}}", stars)
                    .Replace("{{C1}}", colors[0])
                    .Replace("{{C2}}", colors[1])
                    .Replace("{{C3}}", colors[2])
                    .Replace("{{RGB1}}", rgb1)
                    .Replace("{{RGB2}}", rgb2)
                    .Replace("{{HERO_IMG}}", heroImg)
                    .Replace("{{MAP_QUERY}}", mapQ)
                    .Replace("{{ABOUT_TITLE}}", Enc(content.AboutTitle))
                    .Replace("{{ABOUT_TEXT}}", Enc(content.AboutText))
                    .Replace("{{SRV1}}", Enc(content.Services.ElementAtOrDefault(0) ?? "Cilt Bakımı"))
                    .Replace("{{SRV2}}", Enc(content.Services.ElementAtOrDefault(1) ?? "Saç Bakımı"))
                    .Replace("{{SRV3}}", Enc(content.Services.ElementAtOrDefault(2) ?? "Manikür & Pedikür"))
                    .Replace("{{SRV4}}", Enc(content.Services.ElementAtOrDefault(3) ?? "Epilasyon"))
                    .Replace("{{SRV5}}", Enc(content.Services.ElementAtOrDefault(4) ?? "Kaş & Kirpik"))
                    .Replace("{{SRV6}}", Enc(content.Services.ElementAtOrDefault(5) ?? "Masaj & SPA"))
                    .Replace("{{REV1}}", Enc(content.Reviews.ElementAtOrDefault(0) ?? "Harika bir deneyimdi!"))
                    .Replace("{{REV2}}", Enc(content.Reviews.ElementAtOrDefault(1) ?? "Çok profesyonel kadro."))
                    .Replace("{{REV3}}", Enc(content.Reviews.ElementAtOrDefault(2) ?? "Kesinlikle tavsiye ederim."));

                var slug = Slugify(lead.Name);
                await File.WriteAllTextAsync(Path.Combine(outputDir, $"{slug}.html"), html, ct);
                lead.SetDemoSite($"/demos/{projectId}/{slug}.html");
                generated++;

                await Task.Delay(2000, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Demo site hatası: {Name}", lead.Name);
            }
        }
        await db.SaveChangesAsync(ct);
        return generated;
    }

    private async Task<SalonContent> GenerateContentAsync(Lead lead, CancellationToken ct)
    {
        // Sektör config'inden içerik rehberi al
        var sector = _sectorLoader.Classify(lead.Name);
        var servicesHint = sector.TypicalServices.Length > 0
            ? $"Önerilen hizmetler: {string.Join(", ", sector.TypicalServices)}"
            : "";
        var toneHint = !string.IsNullOrEmpty(sector.AboutTone)
            ? $"Ton: {sector.AboutTone}"
            : "";
        var sloganHint = sector.SloganExamples.Length > 0
            ? $"Slogan ilham: {string.Join(", ", sector.SloganExamples)}"
            : "";

        var result = await _llm.SendMessageAsync(
            $"{sector.SectorLabel} web sitesi içerik yazarısın. Kısa, profesyonel, Türkçe yaz. {toneHint}. Formatı AYNEN kullan.",
            [new ChatMessage("user", $"""
İşletme: {lead.Name}
Sektör: {sector.SectorLabel}
Adres: {lead.Address}
Puan: {lead.GoogleRating}/5 ({lead.GoogleReviewCount} yorum)
{servicesHint}
{sloganHint}

Şu formatı AYNEN yaz (her satır başında etiket olsun):
SLOGAN: (max 8 kelime etkileyici slogan)
ABOUT_TITLE: (3-4 kelime başlık)
ABOUT_TEXT: (3 cümle hakkımızda metni)
SRV1: (hizmet adı, max 3 kelime)
SRV2: (hizmet adı)
SRV3: (hizmet adı)
SRV4: (hizmet adı)
SRV5: (hizmet adı)
SRV6: (hizmet adı)
REV1: (1 cümle müşteri yorumu)
REV2: (1 cümle müşteri yorumu)
REV3: (1 cümle müşteri yorumu)
""")],
            maxTokens: 500, useWebSearch: true, ct: ct);

        return ParseContent(result);
    }

    private static SalonContent ParseContent(string text)
    {
        var c = new SalonContent();
        foreach (var line in text.Split('\n'))
        {
            var t = line.Trim();
            if (t.StartsWith("SLOGAN:", StringComparison.OrdinalIgnoreCase)) c.Slogan = t[7..].Trim().Trim('*');
            else if (t.StartsWith("ABOUT_TITLE:", StringComparison.OrdinalIgnoreCase)) c.AboutTitle = t[12..].Trim().Trim('*');
            else if (t.StartsWith("ABOUT_TEXT:", StringComparison.OrdinalIgnoreCase)) c.AboutText = t[11..].Trim().Trim('*');
            else if (t.StartsWith("SRV", StringComparison.OrdinalIgnoreCase) && t.Contains(':'))
                c.Services.Add(t[(t.IndexOf(':') + 1)..].Trim().Trim('*'));
            else if (t.StartsWith("REV", StringComparison.OrdinalIgnoreCase) && t.Contains(':'))
                c.Reviews.Add(t[(t.IndexOf(':') + 1)..].Trim().Trim('*').Trim('"'));
        }
        return c;
    }

    /// <summary>Template adları — sıralama önemli, akıllı seçim buna göre yapılır.</summary>
    private static readonly string[] TemplateNames =
        ["luxury", "minimal", "organic", "gradient", "editorial", "cards"];

    private static string[]? _templatesCache;

    private static async Task<string[]> GetTemplatesAsync()
    {
        if (_templatesCache is not null) return _templatesCache;

        var templates = new List<string>();
        foreach (var name in TemplateNames)
        {
            var path = Path.Combine("wwwroot", $"demo-template-{name}.html");
            if (File.Exists(path))
                templates.Add(await File.ReadAllTextAsync(path));
        }

        // Fallback: eski template'ler varsa onları da ekle
        if (templates.Count == 0)
        {
            var legacy1 = Path.Combine("wwwroot", "demo-template-1.html");
            var legacy2 = Path.Combine("wwwroot", "demo-template-2.html");
            if (File.Exists(legacy1)) templates.Add(await File.ReadAllTextAsync(legacy1));
            if (File.Exists(legacy2)) templates.Add(await File.ReadAllTextAsync(legacy2));
        }

        _templatesCache = templates.ToArray();
        return _templatesCache;
    }

    /// <summary>Salon özelliklerine göre en uygun template index'ini seç.</summary>
    private static int SelectTemplateIndex(Lead lead, int templateCount)
    {
        if (templateCount <= 1) return 0;

        var rating = lead.GoogleRating ?? 0;
        var reviews = lead.GoogleReviewCount ?? 0;
        var name = lead.Name?.ToLowerInvariant() ?? "";

        // Yüksek puan + çok yorum → Luxury Dark (0) veya Editorial (4)
        if (rating >= 4.7m && reviews >= 200)
            return name.Contains("beauty") || name.Contains("center") ? 0 : 4;

        // Spa/wellness keywords → Organic (2)
        if (name.Contains("spa") || name.Contains("wellness") || name.Contains("doğal"))
            return 2 % templateCount;

        // Modern/trendy keywords → Gradient (3) veya Cards (5)
        if (name.Contains("studio") || name.Contains("atelier") || name.Contains("secret"))
            return 3 % templateCount;

        // Orta segment → Minimal (1)
        if (rating >= 4.0m)
            return 1 % templateCount;

        // Default: Cards (5) — en interaktif
        return 5 % templateCount;
    }

    private static string Enc(string s) => System.Net.WebUtility.HtmlEncode(s);
    private static string HexRgb(string hex)
    {
        hex = hex.TrimStart('#');
        return $"{Convert.ToInt32(hex[..2], 16)},{Convert.ToInt32(hex[2..4], 16)},{Convert.ToInt32(hex[4..6], 16)}";
    }
    private static string Slugify(string t) =>
        System.Text.RegularExpressions.Regex.Replace(
            t.ToLowerInvariant().Replace('ı','i').Replace('ö','o').Replace('ü','u')
             .Replace('ş','s').Replace('ç','c').Replace('ğ','g'),
            @"[^a-z0-9]+", "-").Trim('-');

    private sealed class SalonContent
    {
        public string Slogan { get; set; } = "Güzelliğinize Değer Katıyoruz";
        public string AboutTitle { get; set; } = "Profesyonel Güzellik";
        public string AboutText { get; set; } = "Uzman kadromuz ile en kaliteli güzellik hizmetlerini sunuyoruz.";
        public List<string> Services { get; } = [];
        public List<string> Reviews { get; } = [];
    }
}
