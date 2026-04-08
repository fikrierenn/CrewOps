using CrewOps.Domain.Aggregates;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.Text.Json;

namespace CrewOps.Infrastructure.Persistence.Configurations;

/// <summary>
/// CrewOpsTask aggregate'i için EF Core entity yapılandırması.
/// DependencyIds JSON column olarak saklanır (MVP scale için yeterli).
/// </summary>
public sealed class CrewOpsTaskConfiguration : IEntityTypeConfiguration<CrewOpsTask>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public void Configure(EntityTypeBuilder<CrewOpsTask> builder)
    {
        builder.ToTable("Tasks");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.ProjectId).IsRequired();

        builder.Property(t => t.Title)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(t => t.Description)
            .IsRequired();

        builder.Property(t => t.RoleId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(t => t.ComplexityHint)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(t => t.DomainHint)
            .HasMaxLength(100);

        builder.Property(t => t.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(t => t.RetryCount);

        // DependencyIds — JSON column
        builder.Property(t => t.DependencyIds)
            .HasConversion(
                ids => JsonSerializer.Serialize(ids, JsonOptions),
                json => JsonSerializer.Deserialize<List<Guid>>(json, JsonOptions) ?? new List<Guid>())
            .HasColumnType("nvarchar(max)")
            .Metadata.SetValueComparer(
                new ValueComparer<IReadOnlyList<Guid>>(
                    (a, b) => a != null && b != null && a.SequenceEqual(b),
                    c => c.Aggregate(0, (hash, id) => HashCode.Combine(hash, id)),
                    c => c.ToList()));

        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt).IsRequired();

        // Transient domain events
        builder.Ignore(t => t.DomainEvents);

        // Index: proje + status bazlı sorgular
        builder.HasIndex(t => new { t.ProjectId, t.Status })
            .HasDatabaseName("IX_Tasks_ProjectId_Status");
    }
}
