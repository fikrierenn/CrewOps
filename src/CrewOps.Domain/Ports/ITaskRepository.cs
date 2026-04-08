using CrewOps.Domain.Aggregates;
using CrewOps.Domain.ValueObjects;
using TaskStatus = CrewOps.Domain.ValueObjects.TaskStatus;

namespace CrewOps.Domain.Ports;

/// <summary>
/// CrewOpsTask aggregate'i için kalıcı depolama soyutlaması.
/// </summary>
public interface ITaskRepository
{
    Task<CrewOpsTask?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<CrewOpsTask>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default);

    Task<IReadOnlyList<CrewOpsTask>> GetByStatusAsync(Guid projectId, TaskStatus status, CancellationToken ct = default);

    Task<IReadOnlyList<CrewOpsTask>> GetReadyToRunAsync(Guid projectId, CancellationToken ct = default);

    Task AddAsync(CrewOpsTask task, CancellationToken ct = default);

    Task AddRangeAsync(IEnumerable<CrewOpsTask> tasks, CancellationToken ct = default);

    Task UpdateAsync(CrewOpsTask task, CancellationToken ct = default);
}
