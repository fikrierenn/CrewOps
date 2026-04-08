using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Entities;

/// <summary>
/// Append-only audit kaydı. Proje yaşam döngüsündeki her önemli olay
/// bir AuditEvent olarak kaydedilir.
/// Update ve delete operasyonu yoktur — immutable log.
/// </summary>
public sealed class AuditEvent
{
    public Guid EventId { get; private set; }
    public Guid ProjectId { get; private set; }

    /// <summary>Olayın tipi.</summary>
    public AuditEventType EventType { get; private set; }

    /// <summary>
    /// Olayı tetikleyen aktör.
    /// Kullanıcı ID'si veya "system:ServiceName" formatında.
    /// </summary>
    public string ActorId { get; private set; } = string.Empty;

    /// <summary>Olayla ilgili ek bilgi (JSON formatında).</summary>
    public string? Payload { get; private set; }

    /// <summary>Olayın gerçekleştiği UTC zaman damgası.</summary>
    public DateTime OccurredAt { get; private set; }

    // ---------------------------------------------------------------------------
    // EF Core için parametresiz constructor
    // ---------------------------------------------------------------------------

    private AuditEvent() { }

    // ---------------------------------------------------------------------------
    // Factory method (tek oluşturma yolu)
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Yeni bir audit kaydı oluşturur. Oluşturulduktan sonra değiştirilemez.
    /// </summary>
    public static AuditEvent Create(
        Guid projectId,
        AuditEventType eventType,
        string actorId,
        string? payload = null)
    {
        return new AuditEvent
        {
            EventId = Guid.NewGuid(),
            ProjectId = projectId,
            EventType = eventType,
            ActorId = actorId,
            Payload = payload,
            OccurredAt = DateTime.UtcNow
        };
    }
}
