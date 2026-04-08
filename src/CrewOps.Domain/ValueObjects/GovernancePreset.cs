namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir takım şablonunun yönetişim kurallarını tanımlar.
/// State machine bu preset'e bakarak hangi state geçişlerinin mümkün olduğuna karar verir.
/// Örnek: Pazarlama takımı staging/production gate'lerini atlar.
/// </summary>
public record GovernancePreset
{
    /// <summary>Mutabakat belgesi zorunlu mu?</summary>
    public bool RequireAgreement { get; init; } = true;

    /// <summary>Plan onayı zorunlu mu?</summary>
    public bool RequirePlanApproval { get; init; } = true;

    /// <summary>İnsan incelemesi zorunlu mu?</summary>
    public bool RequireHumanReview { get; init; } = true;

    /// <summary>QA aşaması var mı? (yazılım dışı takımlarda genellikle false)</summary>
    public bool HasQaPhase { get; init; }

    /// <summary>Staging gate var mı? (deploy gerektirmeyen takımlarda false)</summary>
    public bool HasStagingGate { get; init; }

    /// <summary>Production gate var mı? (deploy gerektirmeyen takımlarda false)</summary>
    public bool HasProductionGate { get; init; }

    // ─── Hazır preset'ler ────────────────────────────────────

    /// <summary>Yazılım geliştirme takımları için tam yönetişim (QA + Staging + Production).</summary>
    public static readonly GovernancePreset FullSoftware = new()
    {
        RequireAgreement = true,
        RequirePlanApproval = true,
        RequireHumanReview = true,
        HasQaPhase = true,
        HasStagingGate = true,
        HasProductionGate = true
    };

    /// <summary>Deploy gerektirmeyen takımlar için minimal yönetişim (pazarlama, blog, SEO vb.).</summary>
    public static readonly GovernancePreset Minimal = new()
    {
        RequireAgreement = true,
        RequirePlanApproval = true,
        RequireHumanReview = true,
        HasQaPhase = false,
        HasStagingGate = false,
        HasProductionGate = false
    };
}
