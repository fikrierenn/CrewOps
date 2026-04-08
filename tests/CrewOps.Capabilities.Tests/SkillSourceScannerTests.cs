using CrewOps.Capabilities.Scanning;
using FluentAssertions;

namespace CrewOps.Capabilities.Tests;

public sealed class SkillSourceScannerTests
{
    private readonly SkillSourceScanner _sut = new();

    /// <summary>
    /// Gerçek agents-main/ dizinini tarar — en az 100 skill bulunmalı.
    /// </summary>
    [Fact]
    public void Scan_RealAgentsMain_FindsSkills()
    {
        var agentsMainPath = FindAgentsMainPath();
        if (agentsMainPath is null)
        {
            // CI ortamında agents-main yoksa testi atla
            return;
        }

        var skills = _sut.Scan(agentsMainPath);

        skills.Should().NotBeEmpty();
        skills.Count.Should().BeGreaterThan(100, "agents-main/ altında 147+ skill olmalı");
    }

    [Fact]
    public void Scan_RealAgentsMain_ParsesFrontmatterCorrectly()
    {
        var agentsMainPath = FindAgentsMainPath();
        if (agentsMainPath is null) return;

        var skills = _sut.Scan(agentsMainPath);
        var apiDesign = skills.FirstOrDefault(s => s.Id.Contains("api-design-principles"));

        apiDesign.Should().NotBeNull();
        apiDesign!.Name.Should().Be("api-design-principles");
        apiDesign.Description.Should().NotBeNullOrWhiteSpace();
        apiDesign.PluginDomain.Should().Be("backend-development");
        apiDesign.MarkdownBody.Should().NotBeNullOrWhiteSpace();
        apiDesign.SourcePath.Should().EndWith("SKILL.md");
    }

    [Fact]
    public void Scan_RealAgentsMain_SetsIdAsPluginSlashSkill()
    {
        var agentsMainPath = FindAgentsMainPath();
        if (agentsMainPath is null) return;

        var skills = _sut.Scan(agentsMainPath);
        var any = skills.First();

        any.Id.Should().Contain("/", "ID formatı plugin-adı/skill-adı olmalı");
    }

    [Fact]
    public void Scan_NonExistentPath_ReturnsEmpty()
    {
        var skills = _sut.Scan("/non/existent/path");
        skills.Should().BeEmpty();
    }

    [Fact]
    public void Scan_EmptyPath_Throws()
    {
        var act = () => _sut.Scan("");
        act.Should().Throw<ArgumentException>();
    }

    /// <summary>Proje kök dizininden agents-main/ yolunu bulur.</summary>
    private static string? FindAgentsMainPath()
    {
        var dir = Directory.GetCurrentDirectory();
        while (dir is not null)
        {
            var candidate = Path.Combine(dir, "agents-main");
            if (Directory.Exists(candidate))
                return candidate;
            dir = Directory.GetParent(dir)?.FullName;
        }
        return null;
    }
}
