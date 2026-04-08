using CrewOps.Domain.Aggregates;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Ports;

/// <summary>
/// ExecutionRun aggregate'i için kalıcı depolama soyutlaması.
/// </summary>
public interface IExecutionRunRepository
{
    Task<ExecutionRun?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<ExecutionRun>> GetByTaskIdAsync(Guid taskId, CancellationToken ct = default);

    Task<IReadOnlyList<ExecutionRun>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default);

    Task<ExecutionRun?> GetLatestByTaskIdAsync(Guid taskId, CancellationToken ct = default);

    Task AddAsync(ExecutionRun run, CancellationToken ct = default);

    Task UpdateAsync(ExecutionRun run, CancellationToken ct = default);
}
