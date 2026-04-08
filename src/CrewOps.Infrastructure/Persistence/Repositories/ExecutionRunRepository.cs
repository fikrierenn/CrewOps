using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Infrastructure.Persistence.Repositories;

/// <summary>
/// ExecutionRun aggregate'i için EF Core repository implementasyonu.
/// </summary>
public sealed class ExecutionRunRepository : IExecutionRunRepository
{
    private readonly CrewOpsDbContext _db;

    public ExecutionRunRepository(CrewOpsDbContext db)
    {
        _db = db;
    }

    public async Task<ExecutionRun?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.ExecutionRuns.FindAsync([id], ct);

    public async Task<IReadOnlyList<ExecutionRun>> GetByTaskIdAsync(Guid taskId, CancellationToken ct = default) =>
        await _db.ExecutionRuns
            .Where(r => r.TaskId == taskId)
            .OrderBy(r => r.AttemptNumber)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ExecutionRun>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default) =>
        await _db.ExecutionRuns
            .Where(r => r.ProjectId == projectId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

    public async Task<ExecutionRun?> GetLatestByTaskIdAsync(Guid taskId, CancellationToken ct = default) =>
        await _db.ExecutionRuns
            .Where(r => r.TaskId == taskId)
            .OrderByDescending(r => r.AttemptNumber)
            .FirstOrDefaultAsync(ct);

    public async Task AddAsync(ExecutionRun run, CancellationToken ct = default)
    {
        await _db.ExecutionRuns.AddAsync(run, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ExecutionRun run, CancellationToken ct = default)
    {
        _db.ExecutionRuns.Update(run);
        await _db.SaveChangesAsync(ct);
    }
}
