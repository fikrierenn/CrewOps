using CrewOps.Domain.Aggregates;
using CrewOps.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CrewOps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Project aggregate'i için EF Core entity yapılandırması.
/// GovernancePreset owned entity olarak düzleştirilir.
/// </summary>
public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("Projects");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.RepoPath)
            .HasMaxLength(500);

        builder.Property(p => p.Stack)
            .HasMaxLength(200);

        builder.Property(p => p.Domain)
            .HasMaxLength(100);

        builder.Property(p => p.InitialRequest)
            .IsRequired();

        builder.Property(p => p.State)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(p => p.AgreementSummary);

        builder.Property(p => p.AgreementApprovedAt);

        builder.Property(p => p.TeamTemplateId);

        // GovernancePreset owned entity — Projects tablosuna düzleştirilir
        builder.OwnsOne(p => p.Governance, gov =>
        {
            gov.Property(g => g.RequireAgreement).HasColumnName("Gov_RequireAgreement");
            gov.Property(g => g.RequirePlanApproval).HasColumnName("Gov_RequirePlanApproval");
            gov.Property(g => g.RequireHumanReview).HasColumnName("Gov_RequireHumanReview");
            gov.Property(g => g.HasQaPhase).HasColumnName("Gov_HasQaPhase");
            gov.Property(g => g.HasStagingGate).HasColumnName("Gov_HasStagingGate");
            gov.Property(g => g.HasProductionGate).HasColumnName("Gov_HasProductionGate");
        });

        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.UpdatedAt).IsRequired();

        // Transient domain events — DB'ye yazılmaz
        builder.Ignore(p => p.DomainEvents);

        // Index: state bazlı sorgular
        builder.HasIndex(p => p.State).HasDatabaseName("IX_Projects_State");
    }
}
