using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Exceptions;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.StateMachine;

/// <summary>
/// Proje state geçişlerini yöneten state machine implementasyonu.
/// Base transition matrix WORKFLOW_STATE_MACHINE.md belgesinden türetilmiştir.
/// Governance preset'leri yeni geçiş yolları EKLER, mevcut yolları asla KALDIRMAZ.
/// </summary>
public sealed class ProjectStateMachine : IProjectStateMachine
{
    // ---------------------------------------------------------------------------
    // Base transition matrix — tam yazılım geliştirme akışı
    // ---------------------------------------------------------------------------

    private static readonly Dictionary<ProjectState, HashSet<ProjectState>> BaseTransitions = new()
    {
        // Başlangıç
        [ProjectState.New] = [ProjectState.Discovery],
        [ProjectState.Discovery] = [ProjectState.NeedsClarification, ProjectState.AgreementDrafted],
        [ProjectState.NeedsClarification] = [ProjectState.Discovery, ProjectState.AgreementDrafted],

        // Mutabakat
        [ProjectState.AgreementDrafted] = [ProjectState.AgreementApproved, ProjectState.NeedsClarification],
        [ProjectState.AgreementApproved] = [ProjectState.Planned],

        // Planlama
        [ProjectState.Planned] = [ProjectState.TasksCreated],
        [ProjectState.TasksCreated] = [ProjectState.CapabilitiesAssigned],
        [ProjectState.CapabilitiesAssigned] = [ProjectState.InExecution],

        // Yürütme
        [ProjectState.InExecution] = [ProjectState.InQa, ProjectState.Failed, ProjectState.RollbackRequired],
        [ProjectState.InQa] = [ProjectState.InReview, ProjectState.InExecution],
        [ProjectState.InReview] = [ProjectState.ReadyForPmSummary, ProjectState.NeedsClarification, ProjectState.InExecution],

        // Özet & İnsan İncelemesi
        [ProjectState.ReadyForPmSummary] = [ProjectState.ReadyForHumanReview],
        [ProjectState.ReadyForHumanReview] = [ProjectState.ApprovedForStaging, ProjectState.ChangesRequested],
        [ProjectState.ChangesRequested] = [ProjectState.InExecution, ProjectState.Planned, ProjectState.NeedsClarification],

        // Staging
        [ProjectState.ApprovedForStaging] = [ProjectState.StagingDeployed],
        [ProjectState.StagingDeployed] = [ProjectState.UatPassed, ProjectState.RollbackRequired],
        [ProjectState.UatPassed] = [ProjectState.ApprovedForProduction],

        // Üretim
        [ProjectState.ApprovedForProduction] = [ProjectState.ProductionDeployed],
        [ProjectState.ProductionDeployed] = [ProjectState.Observing, ProjectState.RollbackRequired],
        [ProjectState.Observing] = [ProjectState.Completed, ProjectState.RollbackRequired],

        // Rollback
        [ProjectState.RollbackRequired] = [ProjectState.RolledBack],
        [ProjectState.RolledBack] = [ProjectState.InExecution, ProjectState.Failed],

        // Terminal (geçiş yok)
        [ProjectState.Completed] = [],
        [ProjectState.Failed] = [],
    };

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /// <inheritdoc/>
    public void Transition(Project project, ProjectState target, string? triggeredBy = null)
    {
        ArgumentNullException.ThrowIfNull(project);

        var allowed = GetAllowedTransitions(project.State, project.Governance);

        if (!allowed.Contains(target))
        {
            throw new InvalidProjectStateTransitionException(
                project.Id,
                project.State,
                target);
        }

        project.ApplyTransition(target, triggeredBy);
    }

    /// <inheritdoc/>
    public IReadOnlySet<ProjectState> GetAllowedTransitions(
        ProjectState current,
        GovernancePreset? governance = null)
    {
        if (!BaseTransitions.TryGetValue(current, out var baseTargets))
            return new HashSet<ProjectState>();

        if (governance is null)
            return baseTargets;

        // Governance shortcut'ları: yeni yollar ekler, mevcut yolları asla kaldırmaz
        var effective = new HashSet<ProjectState>(baseTargets);
        ApplyGovernanceShortcuts(current, governance, effective);

        return effective;
    }

    // ---------------------------------------------------------------------------
    // Governance shortcut logic
    // ---------------------------------------------------------------------------

    private static void ApplyGovernanceShortcuts(
        ProjectState current,
        GovernancePreset governance,
        HashSet<ProjectState> targets)
    {
        // QA aşaması yoksa: InExecution → InReview geçişi eklenir (QA atlanır)
        if (!governance.HasQaPhase && current == ProjectState.InExecution)
        {
            targets.Add(ProjectState.InReview);
        }

        // Ne staging ne production gate varsa: ReadyForHumanReview → Completed (deploy pipeline atlanır)
        if (!governance.HasStagingGate && !governance.HasProductionGate && current == ProjectState.ReadyForHumanReview)
        {
            targets.Add(ProjectState.Completed);
        }

        // Staging var ama production yok: UatPassed → Completed (production atlanır)
        if (governance.HasStagingGate && !governance.HasProductionGate && current == ProjectState.UatPassed)
        {
            targets.Add(ProjectState.Completed);
        }
    }
}
