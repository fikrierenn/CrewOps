using CrewOps.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CrewOps.Infrastructure.Persistence.Configurations;

public sealed class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.ToTable("Leads");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.ProjectId).IsRequired();
        builder.Property(l => l.Name).IsRequired().HasMaxLength(300);
        builder.Property(l => l.Address).HasMaxLength(500);
        builder.Property(l => l.District).HasMaxLength(100);
        builder.Property(l => l.Phone).HasMaxLength(50);
        builder.Property(l => l.Email).HasMaxLength(200);
        builder.Property(l => l.GoogleRating).HasPrecision(3, 1);
        builder.Property(l => l.WebsiteUrl).HasMaxLength(500);
        builder.Property(l => l.WebsiteStatus).HasMaxLength(20);
        builder.Property(l => l.GooglePlaceId).HasMaxLength(200);
        builder.Property(l => l.Status).IsRequired().HasMaxLength(30);
        builder.Property(l => l.DemoSiteUrl).HasMaxLength(500);

        builder.HasIndex(l => l.ProjectId).HasDatabaseName("IX_Leads_ProjectId");
        builder.HasIndex(l => l.Status).HasDatabaseName("IX_Leads_Status");
    }
}
