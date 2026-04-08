using CrewOps.Domain.Aggregates;
using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;
using FluentAssertions;
using TaskStatus = CrewOps.Domain.ValueObjects.TaskStatus;

namespace CrewOps.Domain.Tests.Aggregates;

public sealed class CrewOpsTaskTests
{
    private static CrewOpsTask CreateDefaultTask() =>
        CrewOpsTask.Create(Guid.NewGuid(), "API yaz", "REST endpoint oluştur", "backend-developer", ModelTier.Complex);

    // ---------------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------------

    [Fact]
    public void Create_ValidInputs_SetsPendingStatus()
    {
        var projectId = Guid.NewGuid();
        var deps = new[] { Guid.NewGuid(), Guid.NewGuid() };

        var task = CrewOpsTask.Create(projectId, "Test", "Desc", "qa", ModelTier.Operational, deps);

        task.Id.Should().NotBeEmpty();
        task.ProjectId.Should().Be(projectId);
        task.Title.Should().Be("Test");
        task.Status.Should().Be(TaskStatus.Pending);
        task.RetryCount.Should().Be(0);
        task.DependencyIds.Should().HaveCount(2);
    }

    [Fact]
    public void Create_NullTitle_Throws()
    {
        var act = () => CrewOpsTask.Create(Guid.NewGuid(), null!, "desc", "dev", ModelTier.Complex);
        act.Should().Throw<ArgumentException>();
    }

    // ---------------------------------------------------------------------------
    // Tam yaşam döngüsü: Pending → Queued → InProgress → AwaitingReview → Approved → Completed
    // ---------------------------------------------------------------------------

    [Fact]
    public void FullLifecycle_PendingToCompleted_Succeeds()
    {
        var task = CreateDefaultTask();

        task.MarkQueued();
        task.Status.Should().Be(TaskStatus.Queued);

        task.MarkInProgress();
        task.Status.Should().Be(TaskStatus.InProgress);

        task.MarkAwaitingReview();
        task.Status.Should().Be(TaskStatus.AwaitingReview);

        task.MarkApproved();
        task.Status.Should().Be(TaskStatus.Approved);

        task.MarkCompleted();
        task.Status.Should().Be(TaskStatus.Completed);
        task.DomainEvents.Should().ContainSingle(e => e is TaskCompleted);
    }

    // ---------------------------------------------------------------------------
    // Retry akışı: AwaitingReview → Revised → Pending (via ResetToPending)
    // ---------------------------------------------------------------------------

    [Fact]
    public void RetryFlow_RevisedToPending_IncrementsRetryCount()
    {
        var task = CreateDefaultTask();
        task.MarkQueued();
        task.MarkInProgress();
        task.MarkAwaitingReview();

        task.MarkRevised();
        task.Status.Should().Be(TaskStatus.Revised);
        task.RetryCount.Should().Be(1);

        task.ResetToPending();
        task.Status.Should().Be(TaskStatus.Pending);
    }

    // ---------------------------------------------------------------------------
    // Invalid transitions
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkQueued_FromInProgress_Throws()
    {
        var task = CreateDefaultTask();
        task.MarkQueued();
        task.MarkInProgress();

        var act = () => task.MarkQueued();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkApproved_FromPending_Throws()
    {
        var task = CreateDefaultTask();
        var act = () => task.MarkApproved();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkCompleted_FromPending_Throws()
    {
        var task = CreateDefaultTask();
        var act = () => task.MarkCompleted();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void ResetToPending_FromQueued_Throws()
    {
        var task = CreateDefaultTask();
        task.MarkQueued();

        var act = () => task.ResetToPending();
        act.Should().Throw<InvalidOperationException>();
    }

    // ---------------------------------------------------------------------------
    // Escalation
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkEscalated_FromAwaitingReview_Succeeds()
    {
        var task = CreateDefaultTask();
        task.MarkQueued();
        task.MarkInProgress();
        task.MarkAwaitingReview();

        task.MarkEscalated();

        task.Status.Should().Be(TaskStatus.Escalated);
    }

    // ---------------------------------------------------------------------------
    // Failed & Skipped (herhangi durumdan)
    // ---------------------------------------------------------------------------

    [Fact]
    public void MarkFailed_FromAnyState_Succeeds()
    {
        var task = CreateDefaultTask();
        task.MarkQueued();
        task.MarkInProgress();

        task.MarkFailed();

        task.Status.Should().Be(TaskStatus.Failed);
    }

    [Fact]
    public void MarkSkipped_FromPending_Succeeds()
    {
        var task = CreateDefaultTask();

        task.MarkSkipped();

        task.Status.Should().Be(TaskStatus.Skipped);
    }
}
