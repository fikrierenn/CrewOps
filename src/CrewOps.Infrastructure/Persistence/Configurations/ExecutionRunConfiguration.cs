using CrewOps.Domain.Aggregates;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CrewOps.Infrastructure.Persistence.Configurations;

/// <summary>
/// ExecutionRun aggregate'i için EF Core entity yapılandırması.
/// Token ve maliyet metrikleri dahil.
/// </summary>
public sealed class ExecutionRunConfiguration : IEntityTypeConfiguration<ExecutionRun>
{
    public void Configure(EntityTypeBuilder<ExecutionRun> builder)
    {
        builder.ToTable("ExecutionRuns");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.TaskId).IsRequired();
        builder.Property(r => r.ProjectId).IsRequired();

        builder.Property(r => r.RoleId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(r => r.ModelTier)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(r => r.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(r => r.WorkspacePath)
            .HasMaxLength(500);

        builder.Property(r => r.RawOutput);

        builder.Property(r => r.ErrorMessage);

        builder.Property(r => r.InputTokens);
        builder.Property(r => r.OutputTokens);

        builder.Property(r => r.CostUsd)
            .HasPrecision(18, 6);

        builder.Property(r => r.DurationMs);
        builder.Property(r => r.AttemptNumber);

        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.StartedAt);
        builder.Property(r => r.CompletedAt);

        // Transient domain events
        builder.Ignore(r => r.DomainEvents);

        // Indexes
        builder.HasIndex(r => r.TaskId)
            .HasDatabaseName("IX_ExecutionRuns_TaskId");

        builder.HasIndex(r => new { r.ProjectId, r.CreatedAt })
            .HasDatabaseName("IX_ExecutionRuns_ProjectId_CreatedAt");
    }
}
