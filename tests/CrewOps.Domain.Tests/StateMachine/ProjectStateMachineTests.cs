using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Exceptions;
using CrewOps.Domain.StateMachine;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;

namespace CrewOps.Domain.Tests.StateMachine;

public sealed class ProjectStateMachineTests
{
    private readonly ProjectStateMachine _sut = new();

    private static Project CreateProjectAtState(ProjectState state)
    {
        var project = Project.CreateUniversal("Test", "request");
        // Reflection ile state'i set ediyoruz (test helper)
        var prop = typeof(Project).GetProperty(nameof(Project.State))!;
        prop.SetValue(project, state);
        return project;
    }

    // ---------------------------------------------------------------------------
    // Temel geçişler — happy path
    // ---------------------------------------------------------------------------

    [Theory]
    [InlineData(ProjectState.New, ProjectState.Discovery)]
    [InlineData(ProjectState.Discovery, ProjectState.NeedsClarification)]
    [InlineData(ProjectState.Discovery, ProjectState.AgreementDrafted)]
    [InlineData(ProjectState.NeedsClarification, ProjectState.Discovery)]
    [InlineData(ProjectState.NeedsClarification, ProjectState.AgreementDrafted)]
    [InlineData(ProjectState.AgreementDrafted, ProjectState.AgreementApproved)]
    [InlineData(ProjectState.AgreementDrafted, ProjectState.NeedsClarification)]
    [InlineData(ProjectState.AgreementApproved, ProjectState.Planned)]
    [InlineData(ProjectState.Planned, ProjectState.TasksCreated)]
    [InlineData(ProjectState.TasksCreated, ProjectState.CapabilitiesAssigned)]
    [InlineData(ProjectState.CapabilitiesAssigned, ProjectState.InExecution)]
    [InlineData(ProjectState.InExecution, ProjectState.InQa)]
    [InlineData(ProjectState.InExecution, ProjectState.Failed)]
    [InlineData(ProjectState.InExecution, ProjectState.RollbackRequired)]
    [InlineData(ProjectState.InQa, ProjectState.InReview)]
    [InlineData(ProjectState.InQa, ProjectState.InExecution)]
    [InlineData(ProjectState.InReview, ProjectState.ReadyForPmSummary)]
    [InlineData(ProjectState.InReview, ProjectState.NeedsClarification)]
    [InlineData(ProjectState.InReview, ProjectState.InExecution)]
    [InlineData(ProjectState.ReadyForPmSummary, ProjectState.ReadyForHumanReview)]
    [InlineData(ProjectState.ReadyForHumanReview, ProjectState.ApprovedForStaging)]
    [InlineData(ProjectState.ReadyForHumanReview, ProjectState.ChangesRequested)]
    [InlineData(ProjectState.ChangesRequested, ProjectState.InExecution)]
    [InlineData(ProjectState.ChangesRequested, ProjectState.Planned)]
    [InlineData(ProjectState.ChangesRequested, ProjectState.NeedsClarification)]
    [InlineData(ProjectState.ApprovedForStaging, ProjectState.StagingDeployed)]
    [InlineData(ProjectState.StagingDeployed, ProjectState.UatPassed)]
    [InlineData(ProjectState.StagingDeployed, ProjectState.RollbackRequired)]
    [InlineData(ProjectState.UatPassed, ProjectState.ApprovedForProduction)]
    [InlineData(ProjectState.ApprovedForProduction, ProjectState.ProductionDeployed)]
    [InlineData(ProjectState.ProductionDeployed, ProjectState.Observing)]
    [InlineData(ProjectState.ProductionDeployed, ProjectState.RollbackRequired)]
    [InlineData(ProjectState.Observing, ProjectState.Completed)]
    [InlineData(ProjectState.Observing, ProjectState.RollbackRequired)]
    [InlineData(ProjectState.RollbackRequired, ProjectState.RolledBack)]
    [InlineData(ProjectState.RolledBack, ProjectState.InExecution)]
    [InlineData(ProjectState.RolledBack, ProjectState.Failed)]
    public void Transition_ValidBaseTransition_Succeeds(ProjectState from, ProjectState to)
    {
        var project = CreateProjectAtState(from);

        _sut.Transition(project, to, "test-user");

        project.State.Should().Be(to);
    }

    // ---------------------------------------------------------------------------
    // Geçersiz geçişler
    // ---------------------------------------------------------------------------

    [Fact]
    public void Transition_NewToInExecution_ThrowsInvalidTransition()
    {
        var project = CreateProjectAtState(ProjectState.New);

        var act = () => _sut.Transition(project, ProjectState.InExecution);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    [Fact]
    public void Transition_CompletedToAny_ThrowsInvalidTransition()
    {
        var project = CreateProjectAtState(ProjectState.Completed);

        var act = () => _sut.Transition(project, ProjectState.Discovery);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    [Fact]
    public void Transition_FailedToAny_ThrowsInvalidTransition()
    {
        var project = CreateProjectAtState(ProjectState.Failed);

        var act = () => _sut.Transition(project, ProjectState.New);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    [Fact]
    public void Transition_SameState_ThrowsInvalidTransition()
    {
        var project = CreateProjectAtState(ProjectState.Discovery);

        var act = () => _sut.Transition(project, ProjectState.Discovery);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    // ---------------------------------------------------------------------------
    // Governance: Minimal — QA atlanır
    // ---------------------------------------------------------------------------

    [Fact]
    public void Transition_MinimalGovernance_InExecutionToInReview_QaAtlanir()
    {
        var project = CreateProjectAtState(ProjectState.InExecution);
        project.AssignTeamTemplate(Guid.NewGuid(), "Marketing", GovernancePreset.Minimal);
        project.ClearDomainEvents();

        _sut.Transition(project, ProjectState.InReview, "system");

        project.State.Should().Be(ProjectState.InReview);
    }

    [Fact]
    public void Transition_FullGovernance_InExecutionToInReview_QaZorunlu()
    {
        var project = CreateProjectAtState(ProjectState.InExecution);
        project.AssignTeamTemplate(Guid.NewGuid(), "FullStack", GovernancePreset.FullSoftware);
        project.ClearDomainEvents();

        // FullSoftware governance'ta InExecution → InReview doğrudan geçilemez
        var act = () => _sut.Transition(project, ProjectState.InReview);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    // ---------------------------------------------------------------------------
    // Governance: Minimal — Deploy pipeline atlanır
    // ---------------------------------------------------------------------------

    [Fact]
    public void Transition_MinimalGovernance_ReadyForHumanReviewToCompleted_DeployAtlanir()
    {
        var project = CreateProjectAtState(ProjectState.ReadyForHumanReview);
        project.AssignTeamTemplate(Guid.NewGuid(), "SEO", GovernancePreset.Minimal);
        project.ClearDomainEvents();

        _sut.Transition(project, ProjectState.Completed, "user-1");

        project.State.Should().Be(ProjectState.Completed);
    }

    [Fact]
    public void Transition_FullGovernance_ReadyForHumanReviewToCompleted_Engellenir()
    {
        var project = CreateProjectAtState(ProjectState.ReadyForHumanReview);
        project.AssignTeamTemplate(Guid.NewGuid(), "FullStack", GovernancePreset.FullSoftware);
        project.ClearDomainEvents();

        var act = () => _sut.Transition(project, ProjectState.Completed);

        act.Should().Throw<InvalidProjectStateTransitionException>();
    }

    // ---------------------------------------------------------------------------
    // Governance: Staging var, production yok — UatPassed → Completed
    // ---------------------------------------------------------------------------

    [Fact]
    public void Transition_StagingOnlyGovernance_UatPassedToCompleted_Succeeds()
    {
        var governance = new GovernancePreset
        {
            HasQaPhase = true,
            HasStagingGate = true,
            HasProductionGate = false
        };
        var project = CreateProjectAtState(ProjectState.UatPassed);
        project.AssignTeamTemplate(Guid.NewGuid(), "Frontend", governance);
        project.ClearDomainEvents();

        _sut.Transition(project, ProjectState.Completed, "user-1");

        project.State.Should().Be(ProjectState.Completed);
    }

    // ---------------------------------------------------------------------------
    // GetAllowedTransitions
    // ---------------------------------------------------------------------------

    [Fact]
    public void GetAllowedTransitions_New_ReturnsOnlyDiscovery()
    {
        var allowed = _sut.GetAllowedTransitions(ProjectState.New);

        allowed.Should().ContainSingle()
            .Which.Should().Be(ProjectState.Discovery);
    }

    [Fact]
    public void GetAllowedTransitions_InExecution_WithMinimalGovernance_IncludesInReview()
    {
        var allowed = _sut.GetAllowedTransitions(ProjectState.InExecution, GovernancePreset.Minimal);

        allowed.Should().Contain(ProjectState.InReview);
        // Base transitions da hala mevcut
        allowed.Should().Contain(ProjectState.InQa);
        allowed.Should().Contain(ProjectState.Failed);
    }

    [Fact]
    public void GetAllowedTransitions_CompletedTerminal_ReturnsEmpty()
    {
        var allowed = _sut.GetAllowedTransitions(ProjectState.Completed);
        allowed.Should().BeEmpty();
    }

    [Fact]
    public void GetAllowedTransitions_FailedTerminal_ReturnsEmpty()
    {
        var allowed = _sut.GetAllowedTransitions(ProjectState.Failed);
        allowed.Should().BeEmpty();
    }

    // ---------------------------------------------------------------------------
    // Null project guard
    // ---------------------------------------------------------------------------

    [Fact]
    public void Transition_NullProject_Throws()
    {
        var act = () => _sut.Transition(null!, ProjectState.Discovery);
        act.Should().Throw<ArgumentNullException>();
    }
}
