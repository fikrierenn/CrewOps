using CrewOps.Domain.Entities;
using CrewOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Api.Services;

/// <summary>
/// Lead doğrulama pipeline'ı:
/// 1. WebsiteProber → gerçek HTTP kontrolü (URL erişilebilir mi?)
/// 2. Gemini Search → web sitesi araması (Maps'te olmayan siteleri bul)
/// 3. SeoAnalyzer → site varsa SEO analizi yap
/// Sonuç: yok (hedef), kötü (hedef + SEO hizmeti sat), iyi (listeden çıkar)
/// </summary>
public sealed class LeadVerifier
{
    private readonly LlmClient _llm;
    private readonly WebsiteProber _prober;
    private readonly SeoAnalyzer _seoAnalyzer;
    private readonly IDbContextFactory<CrewOpsDbContext> _dbFactory;
    private readonly ILogger<LeadVerifier> _logger;

    public LeadVerifier(
        LlmClient llm,
        WebsiteProber prober,
        SeoAnalyzer seoAnalyzer,
        IDbContextFactory<CrewOpsDbContext> dbFactory,
        ILogger<LeadVerifier> logger)
    {
        _llm = llm;
        _prober = prober;
        _seoAnalyzer = seoAnalyzer;
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
                // Adım 1: Mevcut URL varsa WebsiteProber ile kontrol et
                if (!string.IsNullOrWhiteSpace(lead.WebsiteUrl))
                {
                    var probeResult = await _prober.ProbeAsync(lead.WebsiteUrl, ct);
                    if (!probeResult.IsAccessible)
                    {
                        lead.SetWebsiteInfo(null, "yok");
                        noSite++;
                        _logger.LogInformation("✓ {Name} — URL erişilemez, site YOK (hedef)", lead.Name);
                        await Task.Delay(500, ct);
                        continue;
                    }
                }

                // Adım 2: İşletme adıyla web sitesi arama (WebsiteProber tahmin)
                var nameProbe = await _prober.ProbeByNameAsync(lead.Name, ct);

                // Adım 3: Gemini Search ile web sitesi araması
                var assessment = await AssessWebsiteAsync(lead.Name, lead.Address, ct);

                // Sonucu birleştir — gerçek URL erişilebilirliği öncelikli
                var finalStatus = assessment.Status;
                var finalUrl = assessment.Url;

                // WebsiteProber site buldu ama Gemini bulamadıysa → Prober'ı kullan
                if (nameProbe?.IsAccessible == true && finalStatus == "yok")
                {
                    finalUrl = nameProbe.FinalUrl;
                    finalStatus = "kötü"; // Site var ama Maps'te değil → muhtemelen kötü
                    _logger.LogInformation("  Prober site buldu: {Url}", finalUrl);
                }

                lead.SetWebsiteInfo(finalUrl, finalStatus);

                switch (finalStatus)
                {
                    case "yok":
                        noSite++;
                        _logger.LogInformation("✓ {Name} — site YOK (hedef)", lead.Name);
                        break;

                    case "kötü":
                        badSite++;
                        _logger.LogInformation("✓ {Name} — site KÖTÜ: {Url} (hedef)", lead.Name, finalUrl);

                        // Adım 4: SEO analizi — kötü site varsa detaylı rapor
                        if (finalUrl is not null)
                        {
                            try
                            {
                                var seoReport = await _seoAnalyzer.AnalyzeAsync(finalUrl, ct);
                                lead.SetSeoResult(seoReport.Score, seoReport.ToJson());
                                _logger.LogInformation("  SEO: {Score}/100 — {Summary}", seoReport.Score, seoReport.ToSummary());
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "  SEO analiz hatası: {Url}", finalUrl);
                            }
                        }
                        break;

                    case "iyi":
                        // İyi siteli de tutuyoruz ama SEO analizi yapıp "iyileştirme" satacağız
                        _logger.LogInformation("△ {Name} — site İYİ: {Url} (SEO hizmeti satılabilir)", lead.Name, finalUrl);

                        if (finalUrl is not null)
                        {
                            try
                            {
                                var seoReport = await _seoAnalyzer.AnalyzeAsync(finalUrl, ct);
                                lead.SetSeoResult(seoReport.Score, seoReport.ToJson());
                                _logger.LogInformation("  SEO: {Score}/100 — {Summary}", seoReport.Score, seoReport.ToSummary());

                                // SEO skoru düşükse kötü olarak işaretle
                                if (seoReport.Score < 60)
                                {
                                    lead.SetWebsiteInfo(finalUrl, "kötü");
                                    badSite++;
                                    _logger.LogInformation("  → SEO düşük, 'kötü' olarak yeniden sınıflandırıldı");
                                }
                                else
                                {
                                    goodSite++;
                                    // İyi siteyi silmiyoruz artık — SEO hizmeti satacağız
                                }
                            }
                            catch
                            {
                                goodSite++;
                            }
                        }
                        else
                        {
                            goodSite++;
                        }
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
        var location = address?.Split(',').LastOrDefault()?.Trim() ?? "Türkiye";

        var result = await _llm.SendMessageAsync(
            """
            Sen bir web sitesi kalite değerlendirme uzmanısın.
            Verilen işletmenin web sitesini araştır ve değerlendir.
            Instagram, Facebook, Google Maps, Yandex, sahibinden gibi platformlar web sitesi SAYILMAZ.
            Sadece işletmenin kendine ait domain'i (örn: www.klinikadi.com) web sitesi sayılır.

            Yanıtını SADECE şu 3 formattan biriyle ver:
            YOK — işletmenin kendine ait web sitesi bulunamadı
            KÖTÜ|URL — web sitesi var ama kalitesiz (mobil uyumsuz, eski tasarım, yavaş, içerik eksik, SSL yok)
            İYİ|URL — web sitesi var ve profesyonel/modern görünümlü

            Başka hiçbir şey yazma.
            """,
            [new ChatMessage("user", $"{name} {location} web sitesini değerlendir")],
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

        return new WebsiteAssessment("yok", null);
    }
}

public sealed record VerificationResult(int Total, int NoSite, int BadSite, int GoodSiteRemoved);
public sealed record WebsiteAssessment(string Status, string? Url);
