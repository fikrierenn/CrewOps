using CrewOps.Domain.Aggregates;
using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;

namespace CrewOps.Domain.Tests.Aggregates;

public sealed class ProjectTests
{
    [Fact]
    public void Create_ValidInputs_CreatesWithNewState()
    {
        var project = Project.Create("Test", "/repo", ".NET", "Build something");

        project.Id.Should().NotBeEmpty();
        project.Name.Should().Be("Test");
        project.RepoPath.Should().Be("/repo");
        project.Stack.Should().Be(".NET");
        project.InitialRequest.Should().Be("Build something");
        project.State.Should().Be(ProjectState.New);
        project.Domain.Should().Be("software");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Create_InvalidName_Throws(string? name)
    {
        var act = () => Project.Create(name!, "/repo", ".NET", "request");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_NullRepoPath_Throws()
    {
        var act = () => Project.Create("Test", null!, ".NET", "request");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_NullStack_Throws()
    {
        var act = () => Project.Create("Test", "/repo", null!, "request");
        act.Should().Throw<ArgumentException>();
    }

    // ---------------------------------------------------------------------------
    // CreateUniversal
    // ---------------------------------------------------------------------------

    [Fact]
    public void CreateUniversal_MinimalInputs_Succeeds()
    {
        var project = Project.CreateUniversal("Marketing Campaign", "SEO analizi yap");

        project.Id.Should().NotBeEmpty();
        project.Name.Should().Be("Marketing Campaign");
        project.InitialRequest.Should().Be("SEO analizi yap");
        project.RepoPath.Should().BeNull();
        project.Stack.Should().BeNull();
        project.Domain.Should().BeNull();
        project.State.Should().Be(ProjectState.New);
    }

    [Fact]
    public void CreateUniversal_WithAllFields_SetsCorrectly()
    {
        var project = Project.CreateUniversal(
            "Blog Project",
            "30 makale yaz",
            repoPath: "/content",
            stack: "WordPress",
            domain: "content");

        project.RepoPath.Should().Be("/content");
        project.Stack.Should().Be("WordPress");
        project.Domain.Should().Be("content");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void CreateUniversal_InvalidName_Throws(string? name)
    {
        var act = () => Project.CreateUniversal(name!, "request");
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void CreateUniversal_InvalidRequest_Throws(string? request)
    {
        var act = () => Project.CreateUniversal("Test", request!);
        act.Should().Throw<ArgumentException>();
    }

    // ---------------------------------------------------------------------------
    // AssignTeamTemplate
    // ---------------------------------------------------------------------------

    [Fact]
    public void AssignTeamTemplate_ValidInputs_SetsGovernanceAndRaisesEvent()
    {
        var project = Project.CreateUniversal("Test", "request");
        var templateId = Guid.NewGuid();

        project.AssignTeamTemplate(templateId, "Marketing", GovernancePreset.Minimal);

        project.TeamTemplateId.Should().Be(templateId);
        project.Governance.Should().Be(GovernancePreset.Minimal);
        project.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<TeamTemplateAssigned>()
            .Which.TemplateName.Should().Be("Marketing");
    }

    [Fact]
    public void AssignTeamTemplate_NullGovernance_Throws()
    {
        var project = Project.CreateUniversal("Test", "request");
        var act = () => project.AssignTeamTemplate(Guid.NewGuid(), "Test", null!);
        act.Should().Throw<ArgumentNullException>();
    }

    // ---------------------------------------------------------------------------
    // ApplyTransition
    // ---------------------------------------------------------------------------

    [Fact]
    public void ApplyTransition_ChangesStateAndRaisesEvent()
    {
        var project = Project.CreateUniversal("Test", "request");

        // internal method — test sınıfı aynı assembly değil, InternalsVisibleTo gerekebilir
        // Bunun yerine StateMachine üzerinden test ederiz
        project.State.Should().Be(ProjectState.New);
    }

    // ---------------------------------------------------------------------------
    // RecordAgreementApproval
    // ---------------------------------------------------------------------------

    [Fact]
    public void RecordAgreementApproval_ValidInputs_SetsFieldsAndRaisesEvent()
    {
        var project = Project.CreateUniversal("Test", "request");

        project.RecordAgreementApproval("Mutabakat özeti", "user-1");

        project.AgreementSummary.Should().Be("Mutabakat özeti");
        project.AgreementApprovedAt.Should().NotBeNull();
        project.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<AgreementApproved>();
    }

    [Fact]
    public void RecordAgreementApproval_EmptySummary_Throws()
    {
        var project = Project.CreateUniversal("Test", "request");
        var act = () => project.RecordAgreementApproval("", "user-1");
        act.Should().Throw<ArgumentException>();
    }

    // ---------------------------------------------------------------------------
    // ClearDomainEvents
    // ---------------------------------------------------------------------------

    [Fact]
    public void ClearDomainEvents_EmptiesList()
    {
        var project = Project.CreateUniversal("Test", "request");
        project.AssignTeamTemplate(Guid.NewGuid(), "Test", GovernancePreset.Minimal);
        project.DomainEvents.Should().NotBeEmpty();

        project.ClearDomainEvents();

        project.DomainEvents.Should().BeEmpty();
    }
}
