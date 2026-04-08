using CrewOps.Domain.Entities;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Ports;

/// <summary>
/// AuditEvent için append-only kalıcı depolama soyutlaması.
/// Update ve delete operasyonu yoktur.
/// </summary>
public interface IAuditEventRepository
{
    Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<AuditEvent> auditEvents, CancellationToken ct = default);

    Task<IReadOnlyList<AuditEvent>> GetByProjectIdAsync(
        Guid projectId,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<AuditEvent>> GetByEventTypeAsync(
        AuditEventType eventType,
        CancellationToken ct = default);
}
