using CrewOps.Domain.Aggregates;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.StateMachine;

/// <summary>
/// Proje state geçişlerinin tek otoritesi.
/// Tüm state değişiklikleri bu arayüz üzerinden yapılmalıdır.
/// </summary>
public interface IProjectStateMachine
{
    /// <summary>
    /// Projeyi hedef state'e geçirir. Geçiş geçersizse exception fırlatılır.
    /// </summary>
    /// <param name="project">State geçişi yapılacak proje.</param>
    /// <param name="target">Hedef state.</param>
    /// <param name="triggeredBy">Geçişi tetikleyen aktör (kullanıcı ID veya "system:ServiceName").</param>
    void Transition(Project project, ProjectState target, string? triggeredBy = null);

    /// <summary>
    /// Verilen state'den governance kuralları dahilinde geçilebilecek tüm state'leri döner.
    /// UI'da izin verilen geçişleri göstermek için kullanılır.
    /// </summary>
    IReadOnlySet<ProjectState> GetAllowedTransitions(ProjectState current, GovernancePreset? governance = null);
}
