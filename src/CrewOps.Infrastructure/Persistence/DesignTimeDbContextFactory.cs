using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace CrewOps.Infrastructure.Persistence;

/// <summary>EF Core migration CLI aracı için design-time factory.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<CrewOpsDbContext>
{
    public CrewOpsDbContext CreateDbContext(string[] args)
    {
        var connStr = "Server=localhost\\SQLEXPRESS;Database=CrewOps;Trusted_Connection=True;TrustServerCertificate=True;";
        var options = new DbContextOptionsBuilder<CrewOpsDbContext>()
            .UseSqlServer(connStr)
            .Options;
        return new CrewOpsDbContext(options);
    }
}
