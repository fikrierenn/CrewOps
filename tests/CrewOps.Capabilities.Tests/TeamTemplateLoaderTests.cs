using CrewOps.Capabilities.Loading;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;

namespace CrewOps.Capabilities.Tests;

public sealed class TeamTemplateLoaderTests
{
    private readonly TeamTemplateLoader _sut = new();

    [Fact]
    public void Load_RealTemplatesDirectory_Loads6Templates()
    {
        var templatesDir = FindTeamTemplatesDirectory();
        if (templatesDir is null) return;

        var templates = _sut.Load(templatesDir);

        templates.Should().HaveCount(6, "templates/team-templates/ altında 6 JSON dosyası var");
    }

    [Fact]
    public void Load_FullStackSoftware_ParsesGovernanceCorrectly()
    {
        var templatesDir = FindTeamTemplatesDirectory();
        if (templatesDir is null) return;

        var templates = _sut.Load(templatesDir);
        var fullStack = templates.FirstOrDefault(t => t.Name == "Full-Stack Software");

        fullStack.Should().NotBeNull();
        fullStack!.Domain.Should().Be("software");
        fullStack.DefaultOutputType.Should().Be(OutputType.CodePatch);
        fullStack.Governance.HasQaPhase.Should().BeTrue();
        fullStack.Governance.HasStagingGate.Should().BeTrue();
        fullStack.Governance.HasProductionGate.Should().BeTrue();
        fullStack.RoleSlots.Should().HaveCount(7);
    }

    [Fact]
    public void Load_MarketingContent_HasMinimalGovernance()
    {
        var templatesDir = FindTeamTemplatesDirectory();
        if (templatesDir is null) return;

        var templates = _sut.Load(templatesDir);
        var marketing = templates.FirstOrDefault(t => t.Name == "Marketing Content");

        marketing.Should().NotBeNull();
        marketing!.Domain.Should().Be("marketing");
        marketing.DefaultOutputType.Should().Be(OutputType.Document);
        marketing.Governance.HasQaPhase.Should().BeFalse();
        marketing.Governance.HasStagingGate.Should().BeFalse();
        marketing.Governance.HasProductionGate.Should().BeFalse();
    }

    [Fact]
    public void Load_RoleSlots_ParseModelTierCorrectly()
    {
        var templatesDir = FindTeamTemplatesDirectory();
        if (templatesDir is null) return;

        var templates = _sut.Load(templatesDir);
        var fullStack = templates.First(t => t.Name == "Full-Stack Software");

        var pm = fullStack.RoleSlots.First(r => r.RoleId == "pm");
        pm.ModelTier.Should().Be(ModelTier.Critical);
        pm.IsRequired.Should().BeTrue();

        var backend = fullStack.RoleSlots.First(r => r.RoleId == "backend");
        backend.ModelTier.Should().Be(ModelTier.Complex);
    }

    [Fact]
    public void Load_NonExistentDirectory_ReturnsEmpty()
    {
        var templates = _sut.Load("/non/existent/path");
        templates.Should().BeEmpty();
    }

    private static string? FindTeamTemplatesDirectory()
    {
        var dir = Directory.GetCurrentDirectory();
        while (dir is not null)
        {
            var candidate = Path.Combine(dir, "templates", "team-templates");
            if (Directory.Exists(candidate))
                return candidate;
            dir = Directory.GetParent(dir)?.FullName;
        }
        return null;
    }
}
