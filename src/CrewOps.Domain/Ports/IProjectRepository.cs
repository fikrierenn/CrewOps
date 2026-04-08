using CrewOps.Domain.Aggregates;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Ports;

/// <summary>
/// Proje aggregate'i için kalıcı depolama soyutlaması.
/// Infrastructure katmanı bu arayüzü implemente eder; Domain katmanı hiçbir
/// storage detayı bilmez.
/// </summary>
public interface IProjectRepository
{
    Task<Project?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken ct = default);

    Task<IReadOnlyList<Project>> GetByStateAsync(ProjectState state, CancellationToken ct = default);

    Task AddAsync(Project project, CancellationToken ct = default);

    Task UpdateAsync(Project project, CancellationToken ct = default);
}
