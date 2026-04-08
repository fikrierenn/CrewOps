namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// AuditEvent kayıtlarının tipini tanımlar.
/// Her state değişikliği, görev güncellemesi ve yürütme olayı bu enum ile sınıflandırılır.
/// </summary>
public enum AuditEventType
{
    // ─── Proje yaşam döngüsü ────────────────────────────────
    ProjectCreated,
    StateChanged,

    // ─── Mutabakat ───────────────────────────────────────────
    AgreementDrafted,
    AgreementApproved,

    // ─── Planlama ────────────────────────────────────────────
    PlanCreated,
    TasksCreated,
    CapabilitiesAssigned,

    // ─── Yürütme ─────────────────────────────────────────────
    ExecutionStarted,
    ExecutionCompleted,
    ExecutionFailed,

    // ─── Onay kapıları ───────────────────────────────────────
    GateTriggered,
    GateApproved,
    GateRejected,

    // ─── Görev durumu ────────────────────────────────────────
    TaskStatusChanged,

    // ─── Hata ve uyarılar ────────────────────────────────────
    InvalidTransitionAttempted,
    RiskItemFlagged,

    // ─── Takım şablonu ──────────────────────────────────────
    TeamTemplateAssigned
}
