namespace CrewOps.Domain.Entities;

/// <summary>
/// Araştırma sonucu bulunan potansiyel müşteri (lead).
/// Güzellik salonu, restoran, klinik vb. — proje türüne göre değişir.
/// </summary>
public sealed class Lead
{
    public Guid Id { get; private set; }
    public Guid ProjectId { get; private set; }

    /// <summary>İşletme adı.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Tam adres.</summary>
    public string? Address { get; private set; }

    /// <summary>İlçe/bölge.</summary>
    public string? District { get; private set; }

    /// <summary>Telefon numarası.</summary>
    public string? Phone { get; private set; }

    /// <summary>E-posta adresi.</summary>
    public string? Email { get; private set; }

    /// <summary>Google Maps puanı.</summary>
    public decimal? GoogleRating { get; private set; }

    /// <summary>Google Maps yorum sayısı.</summary>
    public int? GoogleReviewCount { get; private set; }

    /// <summary>Web sitesi URL'si (varsa).</summary>
    public string? WebsiteUrl { get; private set; }

    /// <summary>Web sitesi durumu: "yok", "kötü", "iyi".</summary>
    public string? WebsiteStatus { get; private set; }

    /// <summary>Google Maps Place ID (varsa).</summary>
    public string? GooglePlaceId { get; private set; }

    /// <summary>Lead durumu: New, Contacted, Interested, NotInterested, Converted.</summary>
    public string Status { get; private set; } = "New";

    /// <summary>Demo site URL'si (oluşturulduysa).</summary>
    public string? DemoSiteUrl { get; private set; }

    /// <summary>Notlar.</summary>
    public string? Notes { get; private set; }

    /// <summary>SEO skoru (0-100). Null ise henüz analiz edilmemiş.</summary>
    public int? SeoScore { get; private set; }

    /// <summary>SEO raporu (JSON string). Detaylı analiz sonuçları.</summary>
    public string? SeoReport { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Lead() { }

    public static Lead Create(
        Guid projectId,
        string name,
        string? address = null,
        string? district = null,
        string? phone = null,
        decimal? googleRating = null,
        int? googleReviewCount = null,
        string? websiteUrl = null,
        string? websiteStatus = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        var now = DateTime.UtcNow;
        return new Lead
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Name = name,
            Address = address,
            District = district,
            Phone = phone,
            GoogleRating = googleRating,
            GoogleReviewCount = googleReviewCount,
            WebsiteUrl = websiteUrl,
            WebsiteStatus = websiteStatus ?? "yok",
            Status = "New",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void SetDemoSite(string url)
    {
        DemoSiteUrl = url;
        Status = "DemoCreated";
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkContacted(string? notes = null)
    {
        Status = "Contacted";
        Notes = notes;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInterested(string? notes = null)
    {
        Status = "Interested";
        Notes = notes;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>SEO analiz sonucunu kaydeder.</summary>
    public void SetSeoResult(int score, string reportJson)
    {
        SeoScore = Math.Clamp(score, 0, 100);
        SeoReport = reportJson;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Web sitesi URL ve durumunu günceller (WebsiteProber sonucu).</summary>
    public void SetWebsiteInfo(string? url, string status)
    {
        WebsiteUrl = url;
        WebsiteStatus = status;
        UpdatedAt = DateTime.UtcNow;
    }
}
