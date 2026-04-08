using CrewOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CrewOps.Infrastructure.Persistence.Configurations;

/// <summary>
/// AuditEvent entity'si için EF Core yapılandırması.
/// Append-only: application katmanında update/delete enforcement.
/// </summary>
public sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("AuditEvents");

        builder.HasKey(e => e.EventId);

        builder.Property(e => e.ProjectId).IsRequired();

        builder.Property(e => e.EventType)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(e => e.ActorId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Payload)
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.OccurredAt).IsRequired();

        // Indexes
        builder.HasIndex(e => new { e.ProjectId, e.OccurredAt })
            .HasDatabaseName("IX_AuditEvents_ProjectId_OccurredAt");

        builder.HasIndex(e => e.EventType)
            .HasDatabaseName("IX_AuditEvents_EventType");
    }
}
