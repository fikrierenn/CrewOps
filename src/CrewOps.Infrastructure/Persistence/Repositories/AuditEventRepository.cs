using CrewOps.Domain.Entities;
using CrewOps.Domain.Ports;
using CrewOps.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Infrastructure.Persistence.Repositories;

/// <summary>
/// AuditEvent için append-only EF Core repository.
/// Update ve delete operasyonu sunmaz.
/// </summary>
public sealed class AuditEventRepository : IAuditEventRepository
{
    private readonly CrewOpsDbContext _db;

    public AuditEventRepository(CrewOpsDbContext db)
    {
        _db = db;
    }

    public async Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default)
    {
        await _db.Set<AuditEvent>().AddAsync(auditEvent, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddRangeAsync(IEnumerable<AuditEvent> auditEvents, CancellationToken ct = default)
    {
        await _db.Set<AuditEvent>().AddRangeAsync(auditEvents, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AuditEvent>> GetByProjectIdAsync(
        Guid projectId,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default)
    {
        var query = _db.Set<AuditEvent>()
            .Where(e => e.ProjectId == projectId);

        if (from.HasValue)
            query = query.Where(e => e.OccurredAt >= from.Value);

        if (to.HasValue)
            query = query.Where(e => e.OccurredAt <= to.Value);

        return await query
            .OrderBy(e => e.OccurredAt)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<AuditEvent>> GetByEventTypeAsync(
        AuditEventType eventType,
        CancellationToken ct = default) =>
        await _db.Set<AuditEvent>()
            .Where(e => e.EventType == eventType)
            .OrderByDescending(e => e.OccurredAt)
            .ToListAsync(ct);
}
