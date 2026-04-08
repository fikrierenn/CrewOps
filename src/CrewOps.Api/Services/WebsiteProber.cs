using System.Net;

namespace CrewOps.Api.Services;

/// <summary>
/// Gerçek HTTP istekleriyle web sitesi varlığını doğrular.
/// Gemini'nin "yok" dediği siteleri tekrar kontrol eder.
/// HEAD request → GET fallback → SSL kontrolü → redirect takibi.
/// </summary>
public sealed class WebsiteProber
{
    private readonly HttpClient _http;
    private readonly ILogger<WebsiteProber> _logger;

    /// <summary>Sosyal medya / platform domainleri — bunlar "gerçek web sitesi" sayılmaz.</summary>
    private static readonly string[] PlatformDomains =
    [
        "facebook.com", "instagram.com", "twitter.com", "x.com",
        "linkedin.com", "youtube.com", "tiktok.com",
        "sahibinden.com", "yandex.com", "google.com",
        "booking.com", "tripadvisor.com", "yelp.com",
        "foursquare.com", "zomato.com"
    ];

    public WebsiteProber(HttpClient http, ILogger<WebsiteProber> logger)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(10);
        _logger = logger;
    }

    /// <summary>
    /// URL'yi gerçekten kontrol eder.
    /// Dönüş: (erişilebilir mi, SSL var mı, nihai URL, status kodu, hata mesajı)
    /// </summary>
    public async Task<ProbeResult> ProbeAsync(string url, CancellationToken ct = default)
    {
        // URL normalize et
        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = "https://" + url;

        // Platform URL mi?
        if (IsPlatformUrl(url))
            return new ProbeResult(false, false, url, 0, "Platform/sosyal medya URL'si — gerçek web sitesi değil");

        try
        {
            // Önce HEAD dene (hafif)
            using var headReq = new HttpRequestMessage(HttpMethod.Head, url);
            headReq.Headers.UserAgent.ParseAdd("Mozilla/5.0 (compatible; CrewOpsBot/1.0)");
            var headResp = await _http.SendAsync(headReq, HttpCompletionOption.ResponseHeadersRead, ct);

            var statusCode = (int)headResp.StatusCode;
            var finalUrl = headResp.RequestMessage?.RequestUri?.ToString() ?? url;
            var hasSsl = finalUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

            // 405 Method Not Allowed → GET ile tekrar dene
            if (headResp.StatusCode == HttpStatusCode.MethodNotAllowed)
            {
                using var getReq = new HttpRequestMessage(HttpMethod.Get, url);
                getReq.Headers.UserAgent.ParseAdd("Mozilla/5.0 (compatible; CrewOpsBot/1.0)");
                var getResp = await _http.SendAsync(getReq, HttpCompletionOption.ResponseHeadersRead, ct);
                statusCode = (int)getResp.StatusCode;
                finalUrl = getResp.RequestMessage?.RequestUri?.ToString() ?? url;
                hasSsl = finalUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
            }

            // Redirect sonrası platform'a mı gitti?
            if (IsPlatformUrl(finalUrl))
                return new ProbeResult(false, hasSsl, finalUrl, statusCode, "Redirect platform URL'sine gidiyor");

            var isAccessible = statusCode is >= 200 and < 400;

            return new ProbeResult(isAccessible, hasSsl, finalUrl, statusCode, isAccessible ? null : $"HTTP {statusCode}");
        }
        catch (TaskCanceledException)
        {
            return new ProbeResult(false, false, url, 0, "Timeout — site yanıt vermiyor");
        }
        catch (HttpRequestException ex)
        {
            return new ProbeResult(false, false, url, 0, $"Bağlantı hatası: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "WebsiteProber hatası: {Url}", url);
            return new ProbeResult(false, false, url, 0, $"Hata: {ex.Message}");
        }
    }

    /// <summary>İşletme adından olası web sitesi URL'lerini tahmin eder ve kontrol eder.</summary>
    public async Task<ProbeResult?> ProbeByNameAsync(string businessName, CancellationToken ct = default)
    {
        // İşletme adından domain tahmin et
        var slug = Slugify(businessName);
        var candidates = new[]
        {
            $"https://{slug}.com",
            $"https://{slug}.com.tr",
            $"https://www.{slug}.com",
            $"https://www.{slug}.com.tr",
        };

        foreach (var candidate in candidates)
        {
            var result = await ProbeAsync(candidate, ct);
            if (result.IsAccessible)
            {
                _logger.LogInformation("İşletme URL bulundu: {Name} → {Url}", businessName, result.FinalUrl);
                return result;
            }
            await Task.Delay(500, ct); // Rate limit
        }

        return null; // Bulunamadı
    }

    private static bool IsPlatformUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var host = uri.Host.ToLowerInvariant();
            return PlatformDomains.Any(p => host.Contains(p));
        }
        catch { return false; }
    }

    private static string Slugify(string name)
    {
        return System.Text.RegularExpressions.Regex.Replace(
            name.ToLowerInvariant()
                .Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u')
                .Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g')
                .Replace(" ", "").Replace(".", "").Replace("&", ""),
            @"[^a-z0-9]", "");
    }
}

/// <summary>Web sitesi probe sonucu.</summary>
public sealed record ProbeResult(
    bool IsAccessible,
    bool HasSsl,
    string FinalUrl,
    int StatusCode,
    string? Error);
