using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using TaskStatus = CrewOps.Domain.ValueObjects.TaskStatus;

namespace CrewOps.Infrastructure.Persistence.Repositories;

/// <summary>
/// CrewOpsTask aggregate'i için EF Core repository implementasyonu.
/// GetReadyToRunAsync: DependencyIds JSON column olduğu için memory'de filtre yapar (MVP scale için yeterli).
/// </summary>
public sealed class TaskRepository : ITaskRepository
{
    private readonly CrewOpsDbContext _db;

    public TaskRepository(CrewOpsDbContext db)
    {
        _db = db;
    }

    public async Task<CrewOpsTask?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Tasks.FindAsync([id], ct);

    public async Task<IReadOnlyList<CrewOpsTask>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default) =>
        await _db.Tasks
            .Where(t => t.ProjectId == projectId)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CrewOpsTask>> GetByStatusAsync(
        Guid projectId, TaskStatus status, CancellationToken ct = default) =>
        await _db.Tasks
            .Where(t => t.ProjectId == projectId && t.Status == status)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct);

    /// <summary>
    /// Bağımlılıkları tamamlanmış ve Pending durumundaki görevleri döner.
    /// MVP scale'de (max ~20 task/project) memory filtre kabul edilebilir.
    /// </summary>
    public async Task<IReadOnlyList<CrewOpsTask>> GetReadyToRunAsync(Guid projectId, CancellationToken ct = default)
    {
        // Proje görevlerini çek
        var allTasks = await _db.Tasks
            .Where(t => t.ProjectId == projectId)
            .ToListAsync(ct);

        var completedTaskIds = allTasks
            .Where(t => t.Status == TaskStatus.Completed)
            .Select(t => t.Id)
            .ToHashSet();

        return allTasks
            .Where(t => t.Status == TaskStatus.Pending
                        && t.DependencyIds.All(depId => completedTaskIds.Contains(depId)))
            .ToList()
            .AsReadOnly();
    }

    public async Task AddAsync(CrewOpsTask task, CancellationToken ct = default)
    {
        await _db.Tasks.AddAsync(task, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddRangeAsync(IEnumerable<CrewOpsTask> tasks, CancellationToken ct = default)
    {
        await _db.Tasks.AddRangeAsync(tasks, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(CrewOpsTask task, CancellationToken ct = default)
    {
        _db.Tasks.Update(task);
        await _db.SaveChangesAsync(ct);
    }
}
