using CrewOps.Capabilities.Models;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;

namespace CrewOps.Capabilities.Tests;

public sealed class InMemoryCapabilityRegistryTests
{
    [Fact]
    public void RegisterRoles_GetAllRoles_ReturnsRegisteredRoles()
    {
        var sut = new InMemoryCapabilityRegistry();
        var roles = new[]
        {
            new RoleProfile { RoleId = "backend", DisplayName = "Backend" },
            new RoleProfile { RoleId = "frontend", DisplayName = "Frontend" }
        };

        sut.RegisterRoles(roles);

        sut.GetAllRoles().Should().HaveCount(2);
    }

    [Fact]
    public void GetRole_ExistingId_ReturnsRole()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.RegisterRoles([new RoleProfile { RoleId = "pm", DisplayName = "PM" }]);

        var role = sut.GetRole("pm");

        role.Should().NotBeNull();
        role!.DisplayName.Should().Be("PM");
    }

    [Fact]
    public void GetRole_CaseInsensitive_ReturnsRole()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.RegisterRoles([new RoleProfile { RoleId = "Backend", DisplayName = "Backend" }]);

        sut.GetRole("backend").Should().NotBeNull();
        sut.GetRole("BACKEND").Should().NotBeNull();
    }

    [Fact]
    public void GetRole_NonExisting_ReturnsNull()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.GetRole("nonexistent").Should().BeNull();
    }

    [Fact]
    public void RegisterSkills_GetSkillsByDomain_FiltersCorrectly()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.RegisterSkills([
            new SkillManifest { Id = "be/api", Name = "api", Description = "d", PluginDomain = "backend-development", SourcePath = "/p" },
            new SkillManifest { Id = "fe/react", Name = "react", Description = "d", PluginDomain = "frontend-development", SourcePath = "/p" },
            new SkillManifest { Id = "be/cqrs", Name = "cqrs", Description = "d", PluginDomain = "backend-development", SourcePath = "/p" }
        ]);

        var backendSkills = sut.GetSkillsByDomain("backend-development");
        backendSkills.Should().HaveCount(2);
    }

    [Fact]
    public void RegisterTeamTemplates_GetByName_CaseInsensitive()
    {
        var sut = new InMemoryCapabilityRegistry();
        var template = new TeamTemplate(
            Guid.NewGuid(), "Full-Stack Software", "software", "desc",
            GovernancePreset.FullSoftware, OutputType.CodePatch, []);

        sut.RegisterTeamTemplates([template]);

        sut.GetTeamTemplateByName("full-stack software").Should().NotBeNull();
        sut.GetTeamTemplate(template.Id).Should().NotBeNull();
    }

    [Fact]
    public void RegisterDomains_GetDomain_ReturnsCorrectly()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.RegisterDomains([
            new DomainInfo { Id = "software", DisplayName = "Yazılım" },
            new DomainInfo { Id = "marketing", DisplayName = "Pazarlama" }
        ]);

        sut.GetAllDomains().Should().HaveCount(2);
        sut.GetDomain("software")!.DisplayName.Should().Be("Yazılım");
    }

    [Fact]
    public void RegisterPacks_GetPacksByDomain_FiltersCorrectly()
    {
        var sut = new InMemoryCapabilityRegistry();
        sut.RegisterPacks([
            new CapabilityPack { Id = "be-excellence", Domain = "backend", DisplayName = "BE" },
            new CapabilityPack { Id = "fe-excellence", Domain = "frontend", DisplayName = "FE" }
        ]);

        sut.GetPacksByDomain("backend").Should().ContainSingle();
        sut.GetPack("be-excellence").Should().NotBeNull();
    }
}
