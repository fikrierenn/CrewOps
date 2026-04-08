using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using CrewOps.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Infrastructure.Persistence.Repositories;

/// <summary>
/// Project aggregate'i için EF Core repository implementasyonu.
/// </summary>
public sealed class ProjectRepository : IProjectRepository
{
    private readonly CrewOpsDbContext _db;

    public ProjectRepository(CrewOpsDbContext db)
    {
        _db = db;
    }

    public async Task<Project?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        await _db.Projects.FindAsync([id], ct);

    public async Task<IReadOnlyList<Project>> GetAllAsync(CancellationToken ct = default) =>
        await _db.Projects
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Project>> GetByStateAsync(ProjectState state, CancellationToken ct = default) =>
        await _db.Projects
            .Where(p => p.State == state)
            .OrderByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);

    public async Task AddAsync(Project project, CancellationToken ct = default)
    {
        await _db.Projects.AddAsync(project, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Project project, CancellationToken ct = default)
    {
        _db.Projects.Update(project);
        await _db.SaveChangesAsync(ct);
    }
}
