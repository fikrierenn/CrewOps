using CrewOps.Contracts.Dtos;
using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Entities;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Application.Mapping;

/// <summary>
/// Domain aggregate'lerini DTO'lara dönüştüren statik mapper.
/// AutoMapper gibi bir kütüphane yerine açık mapping tercih edilir (domain saflığı).
/// </summary>
public static class DtoMapper
{
    public static ProjectDto ToDto(Project p) => new(
        p.Id, p.Name, p.RepoPath, p.Stack, p.Domain,
        p.State.ToString(), p.TeamTemplateId, p.AgreementSummary,
        p.CreatedAt, p.UpdatedAt);

    public static TaskDto ToDto(CrewOpsTask t) => new(
        t.Id, t.ProjectId, t.Title, t.Description, t.RoleId,
        t.ComplexityHint.ToString(), t.DomainHint, t.Status.ToString(),
        t.RetryCount, t.DependencyIds, t.CreatedAt, t.UpdatedAt);

    public static ExecutionRunDto ToDto(ExecutionRun r) => new(
        r.Id, r.TaskId, r.ProjectId, r.RoleId,
        r.ModelTier.ToString(), r.Status.ToString(), r.AttemptNumber,
        r.InputTokens, r.OutputTokens, r.CostUsd, r.DurationMs,
        r.RawOutput, r.ErrorMessage, r.CreatedAt, r.StartedAt, r.CompletedAt);

    public static AuditEventDto ToDto(AuditEvent e) => new(
        e.EventId, e.ProjectId, e.EventType.ToString(),
        e.ActorId, e.Payload, e.OccurredAt);

    public static TeamTemplateDto ToDto(TeamTemplate t) => new(
        t.Id, t.Name, t.Domain, t.Description,
        t.DefaultOutputType.ToString(),
        t.RoleSlots.Select(r => new RoleSlotDto(
            r.RoleId, r.DisplayName, r.ModelTier.ToString(), r.IsRequired)).ToList());
}
