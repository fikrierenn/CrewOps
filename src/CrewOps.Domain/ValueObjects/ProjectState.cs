namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir projenin teslimat yaşam döngüsündeki konumunu temsil eder.
/// ProjectStateMachine bu enum üzerinde geçiş kurallarını zorlar.
/// </summary>
public enum ProjectState
{
    // ─── Başlangıç ───────────────────────────────────────────
    /// <summary>Proje oluşturuldu, henüz hiçbir iş başlamadı.</summary>
    New,

    /// <summary>PM ile gereksinim keşfi başladı.</summary>
    Discovery,

    /// <summary>PM ek bilgiye ihtiyaç duyuyor; kullanıcıdan yanıt bekleniyor.</summary>
    NeedsClarification,

    // ─── Mutabakat ───────────────────────────────────────────
    /// <summary>PM mutabakat belgesi taslağını oluşturdu; insan onayı bekleniyor.</summary>
    AgreementDrafted,

    /// <summary>İnsan mutabakatı onayladı; planlama başlayabilir.</summary>
    AgreementApproved,

    // ─── Planlama ────────────────────────────────────────────
    /// <summary>PM görev planını hazırladı.</summary>
    Planned,

    /// <summary>Görevler DB'ye oluşturuldu ve DAG kuruldu.</summary>
    TasksCreated,

    /// <summary>Her göreve uygun kabiliyet (rol) atandı.</summary>
    CapabilitiesAssigned,

    // ─── Yürütme ─────────────────────────────────────────────
    /// <summary>Orchestration loop çalışıyor; görevler yürütülüyor.</summary>
    InExecution,

    /// <summary>Görevler tamamlandı; kalite/kabul testleri çalışıyor.</summary>
    InQa,

    /// <summary>QA sonuçları inceleniyor; PM veya insan review yapıyor.</summary>
    InReview,

    // ─── Özet & İnsan İncelemesi ─────────────────────────────
    /// <summary>PM konsolide özet hazırlıyor.</summary>
    ReadyForPmSummary,

    /// <summary>PM özeti hazır; insan incelemesi ve kararı bekleniyor.</summary>
    ReadyForHumanReview,

    /// <summary>İnsan değişiklik istedi; ilgili state'e geri dönülüyor.</summary>
    ChangesRequested,

    // ─── Staging ─────────────────────────────────────────────
    /// <summary>İnsan staging deploy'unu onayladı.</summary>
    ApprovedForStaging,

    /// <summary>Staging ortamına deploy yapıldı.</summary>
    StagingDeployed,

    /// <summary>Kullanıcı kabul testleri (UAT) geçildi.</summary>
    UatPassed,

    // ─── Üretim ──────────────────────────────────────────────
    /// <summary>İnsan üretim deploy'unu açıkça onayladı.</summary>
    ApprovedForProduction,

    /// <summary>Üretim ortamına deploy yapıldı.</summary>
    ProductionDeployed,

    /// <summary>Deploy sonrası gözlem periyodu aktif.</summary>
    Observing,

    // ─── Terminal ────────────────────────────────────────────
    /// <summary>Tüm süreç başarıyla tamamlandı.</summary>
    Completed,

    /// <summary>Rollback gereği tespit edildi; initiasyon bekleniyor.</summary>
    RollbackRequired,

    /// <summary>Rollback başarıyla tamamlandı.</summary>
    RolledBack,

    /// <summary>Kurtarılamaz hata nedeniyle proje başarısız sayıldı.</summary>
    Failed
}
