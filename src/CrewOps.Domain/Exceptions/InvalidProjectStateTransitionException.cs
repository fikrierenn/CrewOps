using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Exceptions;

/// <summary>
/// Bir projenin geçerli durumundan izin verilmeyen bir hedefe geçiş denendiğinde fırlatılır.
/// Bu exception fırlatıldığında hiçbir state değişikliği gerçekleşmez.
/// </summary>
public sealed class InvalidProjectStateTransitionException : Exception
{
    public ProjectState FromState { get; }
    public ProjectState ToState { get; }
    public Guid ProjectId { get; }

    public InvalidProjectStateTransitionException(
        Guid projectId,
        ProjectState fromState,
        ProjectState toState)
        : base($"Proje {projectId}: '{fromState}' durumundan '{toState}' durumuna geçiş geçersiz.")
    {
        ProjectId = projectId;
        FromState = fromState;
        ToState = toState;
    }

    public InvalidProjectStateTransitionException(
        Guid projectId,
        ProjectState fromState,
        ProjectState toState,
        string reason)
        : base($"Proje {projectId}: '{fromState}' durumundan '{toState}' durumuna geçiş geçersiz. Sebep: {reason}")
    {
        ProjectId = projectId;
        FromState = fromState;
        ToState = toState;
    }
}
