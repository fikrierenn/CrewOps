using CrewOps.Domain.Aggregates;
using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Infrastructure.Persistence;

/// <summary>
/// CrewOps V2 merkezi veritabanı bağlamı.
/// SaveChangesAsync override'ı ile domain event'leri toplar, persist eder,
/// sonra MediatR üzerinden publish eder.
/// </summary>
public sealed class CrewOpsDbContext : DbContext
{
    private readonly IMediator? _mediator;

    public CrewOpsDbContext(DbContextOptions<CrewOpsDbContext> options, IMediator? mediator = null)
        : base(options)
    {
        _mediator = mediator;
    }

    // ---------------------------------------------------------------------------
    // DbSets
    // ---------------------------------------------------------------------------

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<CrewOpsTask> Tasks => Set<CrewOpsTask>();
    public DbSet<ExecutionRun> ExecutionRuns => Set<ExecutionRun>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Lead> Leads => Set<Lead>();

    // ---------------------------------------------------------------------------
    // Model yapılandırması
    // ---------------------------------------------------------------------------

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CrewOpsDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    // ---------------------------------------------------------------------------
    // Domain event dispatch — persist sonrası publish
    // ---------------------------------------------------------------------------

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // 1. Domain event'leri topla (persist öncesi snapshot)
        var domainEvents = CollectDomainEvents();

        // 2. Persist et
        var result = await base.SaveChangesAsync(cancellationToken);

        // 3. Başarılı persist sonrası event'leri publish et
        if (_mediator is not null)
        {
            foreach (var domainEvent in domainEvents)
            {
                await _mediator.Publish(
                    new DomainEventNotification(domainEvent),
                    cancellationToken);
            }
        }

        return result;
    }

    private List<IDomainEvent> CollectDomainEvents()
    {
        var events = new List<IDomainEvent>();

        // Project aggregate event'leri
        var projectEntries = ChangeTracker.Entries<Project>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .ToList();

        foreach (var entry in projectEntries)
        {
            events.AddRange(entry.Entity.DomainEvents);
            entry.Entity.ClearDomainEvents();
        }

        // CrewOpsTask aggregate event'leri
        var taskEntries = ChangeTracker.Entries<CrewOpsTask>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .ToList();

        foreach (var entry in taskEntries)
        {
            events.AddRange(entry.Entity.DomainEvents);
            entry.Entity.ClearDomainEvents();
        }

        // ExecutionRun aggregate event'leri
        var runEntries = ChangeTracker.Entries<ExecutionRun>()
            .Where(e => e.Entity.DomainEvents.Count > 0)
            .ToList();

        foreach (var entry in runEntries)
        {
            events.AddRange(entry.Entity.DomainEvents);
            entry.Entity.ClearDomainEvents();
        }

        return events;
    }
}

/// <summary>
/// Domain event'leri MediatR notification'a saran wrapper.
/// Generic constraint olmadan her IDomainEvent'i taşır.
/// </summary>
public sealed record DomainEventNotification(IDomainEvent DomainEvent) : INotification;
