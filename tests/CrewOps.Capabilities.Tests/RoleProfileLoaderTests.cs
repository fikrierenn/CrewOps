using CrewOps.Capabilities.Loading;
using FluentAssertions;

namespace CrewOps.Capabilities.Tests;

public sealed class RoleProfileLoaderTests
{
    private readonly RoleProfileLoader _sut = new();

    [Fact]
    public void Load_RealRolesDirectory_Loads7Profiles()
    {
        var rolesDir = FindRolesDirectory();
        if (rolesDir is null) return;

        var roles = _sut.Load(rolesDir);

        roles.Should().HaveCount(7, "templates/roles/ altında 7 JSON dosyası var");
    }

    [Fact]
    public void Load_RealRolesDirectory_ParsesBackendCorrectly()
    {
        var rolesDir = FindRolesDirectory();
        if (rolesDir is null) return;

        var roles = _sut.Load(rolesDir);
        var backend = roles.FirstOrDefault(r => r.RoleId == "backend");

        backend.Should().NotBeNull();
        backend!.DisplayName.Should().Be("Backend Engineer");
        backend.Avatar.Should().Be("🧮");
        backend.Skills.Should().NotBeEmpty();
        backend.DefinitionOfDone.Should().NotBeEmpty();
    }

    [Fact]
    public void Load_RealRolesDirectory_ParsesPmCorrectly()
    {
        var rolesDir = FindRolesDirectory();
        if (rolesDir is null) return;

        var roles = _sut.Load(rolesDir);
        var pm = roles.FirstOrDefault(r => r.RoleId == "pm");

        pm.Should().NotBeNull();
        pm!.DisplayName.Should().Be("Product Manager");
        pm.WorkStyle.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void Load_NonExistentDirectory_ReturnsEmpty()
    {
        var roles = _sut.Load("/non/existent/path");
        roles.Should().BeEmpty();
    }

    private static string? FindRolesDirectory()
    {
        var dir = Directory.GetCurrentDirectory();
        while (dir is not null)
        {
            var candidate = Path.Combine(dir, "templates", "roles");
            if (Directory.Exists(candidate))
                return candidate;
            dir = Directory.GetParent(dir)?.FullName;
        }
        return null;
    }
}
