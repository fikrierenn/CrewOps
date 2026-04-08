using System.Text.Json;
using System.Text.RegularExpressions;

namespace CrewOps.Api.Services;

/// <summary>
/// Basit SEO analiz servisi — HTTP response'tan temel SEO metriklerini çıkarır.
/// Lighthouse/PageSpeed API gerektirmez, sadece HTML parse eder.
/// </summary>
public sealed class SeoAnalyzer
{
    private readonly HttpClient _http;
    private readonly ILogger<SeoAnalyzer> _logger;

    public SeoAnalyzer(HttpClient http, ILogger<SeoAnalyzer> logger)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(15);
        _logger = logger;
    }

    /// <summary>
    /// URL'nin SEO durumunu analiz eder.
    /// Dönüş: SeoReport (skor + detaylar).
    /// </summary>
    public async Task<SeoReport> AnalyzeAsync(string url, CancellationToken ct = default)
    {
        var report = new SeoReport { Url = url };

        try
        {
            if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                url = "https://" + url;

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.UserAgent.ParseAdd("Mozilla/5.0 (compatible; CrewOpsBot/1.0)");

            var sw = System.Diagnostics.Stopwatch.StartNew();
            var resp = await _http.SendAsync(req, ct);
            sw.Stop();

            report.ResponseTimeMs = (int)sw.ElapsedMilliseconds;
            report.StatusCode = (int)resp.StatusCode;
            report.HasSsl = url.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

            if (!resp.IsSuccessStatusCode)
            {
                report.Issues.Add($"HTTP {report.StatusCode} — site erişilebilir değil");
                report.Score = 0;
                return report;
            }

            var html = await resp.Content.ReadAsStringAsync(ct);

            // Meta tag kontrolleri
            AnalyzeMetaTags(html, report);

            // HTML kalite kontrolleri
            AnalyzeHtmlQuality(html, report);

            // Performans kontrolleri
            AnalyzePerformance(html, report);

            // Skor hesapla
            report.Score = CalculateScore(report);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SEO analiz hatası: {Url}", url);
            report.Issues.Add($"Analiz hatası: {ex.Message}");
            report.Score = 0;
        }

        return report;
    }

    private static void AnalyzeMetaTags(string html, SeoReport report)
    {
        // Title tag
        var titleMatch = Regex.Match(html, @"<title[^>]*>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        report.HasTitle = titleMatch.Success && !string.IsNullOrWhiteSpace(titleMatch.Groups[1].Value);
        if (!report.HasTitle) report.Issues.Add("❌ Title tag eksik veya boş");
        else
        {
            var titleLen = titleMatch.Groups[1].Value.Trim().Length;
            if (titleLen < 30) report.Issues.Add($"⚠️ Title çok kısa ({titleLen} karakter, ideal: 50-60)");
            else if (titleLen > 70) report.Issues.Add($"⚠️ Title çok uzun ({titleLen} karakter, ideal: 50-60)");
        }

        // Meta description
        var descMatch = Regex.Match(html, @"<meta[^>]*name=[""']description[""'][^>]*content=[""'](.*?)[""']", RegexOptions.IgnoreCase);
        if (!descMatch.Success) descMatch = Regex.Match(html, @"<meta[^>]*content=[""'](.*?)[""'][^>]*name=[""']description[""']", RegexOptions.IgnoreCase);
        report.HasMetaDescription = descMatch.Success && !string.IsNullOrWhiteSpace(descMatch.Groups[1].Value);
        if (!report.HasMetaDescription) report.Issues.Add("❌ Meta description eksik");
        else
        {
            var descLen = descMatch.Groups[1].Value.Trim().Length;
            if (descLen < 70) report.Issues.Add($"⚠️ Meta description kısa ({descLen} karakter, ideal: 120-160)");
            else if (descLen > 170) report.Issues.Add($"⚠️ Meta description uzun ({descLen} karakter, ideal: 120-160)");
        }

        // Viewport (mobile uyumluluk)
        report.HasViewport = Regex.IsMatch(html, @"<meta[^>]*name=[""']viewport[""']", RegexOptions.IgnoreCase);
        if (!report.HasViewport) report.Issues.Add("❌ Viewport meta tag eksik — mobil uyumlu değil");

        // Open Graph
        report.HasOgTags = Regex.IsMatch(html, @"<meta[^>]*property=[""']og:", RegexOptions.IgnoreCase);
        if (!report.HasOgTags) report.Issues.Add("⚠️ Open Graph tag'ları eksik — sosyal medya paylaşımlarında kötü görünür");

        // Canonical
        report.HasCanonical = Regex.IsMatch(html, @"<link[^>]*rel=[""']canonical[""']", RegexOptions.IgnoreCase);
        if (!report.HasCanonical) report.Issues.Add("⚠️ Canonical URL tanımlı değil");

        // Favicon
        report.HasFavicon = Regex.IsMatch(html, @"<link[^>]*rel=[""'](?:icon|shortcut icon)[""']", RegexOptions.IgnoreCase);
        if (!report.HasFavicon) report.Issues.Add("⚠️ Favicon eksik");
    }

    private static void AnalyzeHtmlQuality(string html, SeoReport report)
    {
        // H1 tag sayısı
        var h1Count = Regex.Matches(html, @"<h1[^>]*>", RegexOptions.IgnoreCase).Count;
        report.H1Count = h1Count;
        if (h1Count == 0) report.Issues.Add("❌ H1 tag yok — sayfa başlığı eksik");
        else if (h1Count > 1) report.Issues.Add($"⚠️ Birden fazla H1 tag ({h1Count}) — sadece 1 olmalı");

        // Img alt tag kontrolü
        var imgCount = Regex.Matches(html, @"<img[^>]*>", RegexOptions.IgnoreCase).Count;
        var imgWithoutAlt = Regex.Matches(html, @"<img(?![^>]*alt=)[^>]*>", RegexOptions.IgnoreCase).Count;
        report.ImgCount = imgCount;
        report.ImgWithoutAlt = imgWithoutAlt;
        if (imgWithoutAlt > 0) report.Issues.Add($"⚠️ {imgWithoutAlt}/{imgCount} resimde alt tag eksik");

        // Internal links
        var linkCount = Regex.Matches(html, @"<a[^>]*href=", RegexOptions.IgnoreCase).Count;
        report.LinkCount = linkCount;
    }

    private static void AnalyzePerformance(string html, SeoReport report)
    {
        // HTML boyutu
        report.HtmlSizeKb = html.Length / 1024;
        if (report.HtmlSizeKb > 500) report.Issues.Add($"⚠️ HTML çok büyük ({report.HtmlSizeKb}KB) — sayfa yavaş yüklenebilir");

        // Inline CSS/JS miktarı
        var inlineCss = Regex.Matches(html, @"<style[^>]*>", RegexOptions.IgnoreCase).Count;
        var inlineJs = Regex.Matches(html, @"<script[^>]*>(?!.*src=)", RegexOptions.IgnoreCase).Count;
        if (inlineCss > 5) report.Issues.Add($"⚠️ Çok fazla inline CSS ({inlineCss} blok)");
        if (inlineJs > 10) report.Issues.Add($"⚠️ Çok fazla inline JS ({inlineJs} blok)");

        // SSL kontrolü
        if (!report.HasSsl) report.Issues.Add("❌ SSL yok — güvenli bağlantı (HTTPS) eksik");

        // Yanıt süresi
        if (report.ResponseTimeMs > 3000) report.Issues.Add($"❌ Çok yavaş ({report.ResponseTimeMs}ms — ideal: <2000ms)");
        else if (report.ResponseTimeMs > 2000) report.Issues.Add($"⚠️ Biraz yavaş ({report.ResponseTimeMs}ms — ideal: <2000ms)");
    }

    private static int CalculateScore(SeoReport report)
    {
        var score = 100;

        // Kritik eksikler (-15 puan)
        if (!report.HasTitle) score -= 15;
        if (!report.HasMetaDescription) score -= 15;
        if (!report.HasViewport) score -= 15;
        if (!report.HasSsl) score -= 15;
        if (report.H1Count == 0) score -= 10;

        // Önemli eksikler (-5 puan)
        if (!report.HasOgTags) score -= 5;
        if (!report.HasCanonical) score -= 5;
        if (!report.HasFavicon) score -= 3;
        if (report.ImgWithoutAlt > 0) score -= Math.Min(report.ImgWithoutAlt * 2, 10);
        if (report.H1Count > 1) score -= 5;

        // Performans (-10 puan)
        if (report.ResponseTimeMs > 3000) score -= 10;
        else if (report.ResponseTimeMs > 2000) score -= 5;
        if (report.HtmlSizeKb > 500) score -= 5;

        return Math.Clamp(score, 0, 100);
    }
}

/// <summary>SEO analiz raporu.</summary>
public sealed class SeoReport
{
    public string Url { get; set; } = "";
    public int Score { get; set; }
    public int StatusCode { get; set; }
    public int ResponseTimeMs { get; set; }
    public int HtmlSizeKb { get; set; }

    // Meta tag'lar
    public bool HasTitle { get; set; }
    public bool HasMetaDescription { get; set; }
    public bool HasViewport { get; set; }
    public bool HasOgTags { get; set; }
    public bool HasCanonical { get; set; }
    public bool HasFavicon { get; set; }
    public bool HasSsl { get; set; }

    // HTML kalite
    public int H1Count { get; set; }
    public int ImgCount { get; set; }
    public int ImgWithoutAlt { get; set; }
    public int LinkCount { get; set; }

    // Sorunlar
    public List<string> Issues { get; set; } = [];

    /// <summary>JSON string olarak raporu döner (Lead.SeoReport alanı için).</summary>
    public string ToJson() => JsonSerializer.Serialize(this, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    });

    /// <summary>Kısa özet — pazarlama mesajında kullanılır.</summary>
    public string ToSummary()
    {
        var critical = Issues.Count(i => i.StartsWith("❌"));
        var warnings = Issues.Count(i => i.StartsWith("⚠️"));
        return $"SEO Skoru: {Score}/100 — {critical} kritik, {warnings} uyarı";
    }
}
