using CrewOps.Domain.Entities;
using CrewOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Api.Services;

/// <summary>
/// Lead'lerin web sitesi durumunu Gemini Google Search ile doğrular.
/// 3 durum: YOK (hedef), KÖTÜ (hedef), İYİ (hedef dışı — sil)
/// </summary>
public sealed class LeadVerifier
{
    private readonly LlmClient _llm;
    private readonly IDbContextFactory<CrewOpsDbContext> _dbFactory;
    private readonly ILogger<LeadVerifier> _logger;

    public LeadVerifier(LlmClient llm, IDbContextFactory<CrewOpsDbContext> dbFactory, ILogger<LeadVerifier> logger)
    {
        _llm = llm;
        _dbFactory = dbFactory;
        _logger = logger;
    }

    public async Task<VerificationResult> VerifyLeadsAsync(Guid projectId, CancellationToken ct = default)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var leads = await db.Leads.Where(l => l.ProjectId == projectId).ToListAsync(ct);

        var noSite = 0;
        var badSite = 0;
        var goodSite = 0;

        foreach (var lead in leads)
        {
            try
            {
                var assessment = await AssessWebsiteAsync(lead.Name, lead.Address, ct);

                // Reflection ile WebsiteStatus ve WebsiteUrl güncelle
                var statusProp = typeof(Lead).GetProperty("WebsiteStatus")!;
                var urlProp = typeof(Lead).GetProperty("WebsiteUrl")!;
                var updatedProp = typeof(Lead).GetProperty("UpdatedAt")!;

                statusProp.SetValue(lead, assessment.Status);
                if (assessment.Url is not null) urlProp.SetValue(lead, assessment.Url);
                updatedProp.SetValue(lead, DateTime.UtcNow);

                switch (assessment.Status)
                {
                    case "yok":
                        noSite++;
                        _logger.LogInformation("✓ {Name} — site YOK (hedef)", lead.Name);
                        break;
                    case "kötü":
                        badSite++;
                        _logger.LogInformation("✓ {Name} — site KÖTÜ: {Url} (hedef)", lead.Name, assessment.Url);
                        break;
                    case "iyi":
                        db.Leads.Remove(lead);
                        goodSite++;
                        _logger.LogInformation("✗ {Name} — site İYİ: {Url} (listeden çıkarıldı)", lead.Name, assessment.Url);
                        break;
                }

                await Task.Delay(1500, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Doğrulama hatası: {Name}", lead.Name);
            }
        }

        await db.SaveChangesAsync(ct);
        return new VerificationResult(leads.Count, noSite, badSite, goodSite);
    }

    private async Task<WebsiteAssessment> AssessWebsiteAsync(string name, string? address, CancellationToken ct)
    {
        var location = address?.Split(',').LastOrDefault()?.Trim() ?? "İstanbul";

        var result = await _llm.SendMessageAsync(
            """
            Sen bir web sitesi kalite değerlendirme uzmanısın.
            Verilen işletmenin web sitesini araştır ve değerlendir.
            Instagram, Facebook, Google Maps, Yandex, sahibinden gibi platformlar web sitesi SAYILMAZ.
            Sadece işletmenin kendine ait domain'i (örn: www.salonadi.com) web sitesi sayılır.

            Yanıtını SADECE şu 3 formattan biriyle ver:
            YOK — işletmenin kendine ait web sitesi bulunamadı
            KÖTÜ|URL — web sitesi var ama kalitesiz (mobil uyumsuz, eski tasarım, yavaş, içerik eksik, SSL yok)
            İYİ|URL — web sitesi var ve profesyonel/modern görünümlü

            Başka hiçbir şey yazma.
            """,
            [new ChatMessage("user", $"{name} {location} güzellik salonu web sitesini değerlendir")],
            maxTokens: 100,
            useWebSearch: true,
            ct: ct);

        var answer = result.Trim();

        if (answer.StartsWith("YOK", StringComparison.OrdinalIgnoreCase))
            return new WebsiteAssessment("yok", null);

        if (answer.StartsWith("KÖTÜ", StringComparison.OrdinalIgnoreCase))
        {
            var url = answer.Contains('|') ? answer.Split('|')[1].Trim() : null;
            return new WebsiteAssessment("kötü", url);
        }

        if (answer.StartsWith("İYİ", StringComparison.OrdinalIgnoreCase) || answer.StartsWith("IYI", StringComparison.OrdinalIgnoreCase))
        {
            var url = answer.Contains('|') ? answer.Split('|')[1].Trim() : null;
            return new WebsiteAssessment("iyi", url);
        }

        // Parse edilemezse yok say
        return new WebsiteAssessment("yok", null);
    }
}

public sealed record VerificationResult(int Total, int NoSite, int BadSite, int GoodSiteRemoved);
public sealed record WebsiteAssessment(string Status, string? Url);
