using CrewOps.Domain.Aggregates;
using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;

namespace CrewOps.Domain.Tests.Aggregates;

public sealed class ExecutionRunTests
{
    private static ExecutionRun CreateDefaultRun() =>
        ExecutionRun.Create(Guid.NewGuid(), Guid.NewGuid(), "backend-developer", ModelTier.Complex, 1);

    [Fact]
    public void Create_ValidInputs_SetsInitialValues()
    {
        var taskId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        var run = ExecutionRun.Create(taskId, projectId, "qa-engineer", ModelTier.Operational, 2);

        run.Id.Should().NotBeEmpty();
        run.TaskId.Should().Be(taskId);
        run.ProjectId.Should().Be(projectId);
        run.RoleId.Should().Be("qa-engineer");
        run.ModelTier.Should().Be(ModelTier.Operational);
        run.Status.Should().Be(ExecutionStatus.Created);
        run.AttemptNumber.Should().Be(2);
        run.StartedAt.Should().BeNull();
        run.CompletedAt.Should().BeNull();
    }

    [Fact]
    public void Create_InvalidRoleId_Throws()
    {
        var act = () => ExecutionRun.Create(Guid.NewGuid(), Guid.NewGuid(), "", ModelTier.Complex, 1);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_ZeroAttemptNumber_Throws()
    {
        var act = () => ExecutionRun.Create(Guid.NewGuid(), Guid.NewGuid(), "dev", ModelTier.Complex, 0);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    // ---------------------------------------------------------------------------
    // Tam yaşam döngüsü: Created → ... → Completed
    // ---------------------------------------------------------------------------

    [Fact]
    public void FullLifecycle_CreatedToCompleted_Succeeds()
    {
        var run = CreateDefaultRun();

        run.MarkQueued();
        run.Status.Should().Be(ExecutionStatus.Queued);

        run.MarkWorkspacePrepared("/tmp/workspace");
        run.Status.Should().Be(ExecutionStatus.WorkspacePrepared);
        run.WorkspacePath.Should().Be("/tmp/workspace");

        run.MarkRunning();
        run.Status.Should().Be(ExecutionStatus.Running);
        run.StartedAt.Should().NotBeNull();
        run.DomainEvents.Should().ContainSingle(e => e is ExecutionRunStarted);

        run.MarkCollectingArtifacts();
        run.Status.Should().Be(ExecutionStatus.CollectingArtifacts);

        run.MarkNormalizing();
        run.Status.Should().Be(ExecutionStatus.Normalizing);

        run.MarkReviewing();
        run.Status.Should().Be(ExecutionStatus.Reviewing);

        run.MarkCompleted("output data", 1000, 500, 0.05m, 30000);
        run.Status.Should().Be(ExecutionStatus.Completed);
        run.RawOutput.Should().Be("output data");
        run.InputTokens.Should().Be(1000);
        run.OutputTokens.Should().Be(500);
        run.CostUsd.Should().Be(0.05m);
        run.DurationMs.Should().Be(30000);
        run.CompletedAt.Should().NotBeNull();

        // 2 event: RunStarted + RunCompleted
        run.DomainEvents.Should().HaveCount(2);
        run.DomainEvents.Last().Should().BeOfType<ExecutionRunCompleted>()
            .Which.Success.Should().BeTrue();
    }

    // ---------------------------------------------------------------------------
    // Invalid transitions
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkRunning_FromCreated_Throws()
    {
        var run = CreateDefaultRun();
        var act = () => run.MarkRunning();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkCompleted_FromRunning_Throws()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();
        run.MarkWorkspacePrepared("/ws");
        run.MarkRunning();

        var act = () => run.MarkCompleted("output", 100, 50, 0.01m, 1000);
        act.Should().Throw<InvalidOperationException>();
    }

    // ---------------------------------------------------------------------------
    // MarkFailed
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkFailed_FromRunning_SetsErrorAndRaisesEvent()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();
        run.MarkWorkspacePrepared("/ws");
        run.MarkRunning();

        run.MarkFailed("LLM API timeout");

        run.Status.Should().Be(ExecutionStatus.Failed);
        run.ErrorMessage.Should().Be("LLM API timeout");
        run.CompletedAt.Should().NotBeNull();
        run.DomainEvents.Should().Contain(e => e is ExecutionRunCompleted)
            .Which.Should().BeOfType<ExecutionRunCompleted>()
            .Which.Success.Should().BeFalse();
    }

    [Fact]
    public void MarkFailed_FromTerminal_Throws()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();
        run.MarkWorkspacePrepared("/ws");
        run.MarkRunning();
        run.MarkFailed("first failure");

        var act = () => run.MarkFailed("second failure");
        act.Should().Throw<InvalidOperationException>();
    }

    // ---------------------------------------------------------------------------
    // MarkTimedOut
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkTimedOut_FromRunning_SetsStatusAndRaisesEvent()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();
        run.MarkWorkspacePrepared("/ws");
        run.MarkRunning();

        run.MarkTimedOut();

        run.Status.Should().Be(ExecutionStatus.TimedOut);
        run.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkTimedOut_FromQueued_Throws()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();

        var act = () => run.MarkTimedOut();
        act.Should().Throw<InvalidOperationException>();
    }

    // ---------------------------------------------------------------------------
    // ClearDomainEvents
    // ---------------------------------------------------------------------------

    [Fact]
    public void ClearDomainEvents_EmptiesList()
    {
        var run = CreateDefaultRun();
        run.MarkQueued();
        run.MarkWorkspacePrepared("/ws");
        run.MarkRunning();
        run.DomainEvents.Should().NotBeEmpty();

        run.ClearDomainEvents();

        run.DomainEvents.Should().BeEmpty();
    }
}
