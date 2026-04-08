using System.Text.Json;
using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.Entities;
using CrewOps.Domain.Ports;
using CrewOps.Domain.ValueObjects;
using CrewOps.Infrastructure.Persistence;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CrewOps.Infrastructure.Observability;

/// <summary>
/// Domain event'leri dinleyerek her birini AuditEvent kaydına dönüştürür ve DB'ye yazar.
/// Hata durumunda business flow bloklanmaz — sadece Critical log yazılır.
/// </summary>
public sealed class AuditEventPublisher : INotificationHandler<DomainEventNotification>
{
    private readonly IAuditEventRepository _repository;
    private readonly ILogger<AuditEventPublisher> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public AuditEventPublisher(IAuditEventRepository repository, ILogger<AuditEventPublisher> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task Handle(DomainEventNotification notification, CancellationToken cancellationToken)
    {
        try
        {
            var auditEvent = MapToAuditEvent(notification.DomainEvent);
            if (auditEvent is not null)
            {
                await _repository.AddAsync(auditEvent, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            // Business flow asla bloklanmaz — audit yazımı başarısız olursa logla ve devam et
            _logger.LogCritical(ex,
                "AuditEvent yazımı başarısız: {EventType}",
                notification.DomainEvent.GetType().Name);
        }
    }

    private static AuditEvent? MapToAuditEvent(IDomainEvent domainEvent)
    {
        return domainEvent switch
        {
            ProjectStateChanged e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.StateChanged,
                e.TriggeredBy ?? "system",
                JsonSerializer.Serialize(new { e.FromState, e.ToState }, JsonOptions)),

            TaskCompleted e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.TaskStatusChanged,
                "system:orchestration",
                JsonSerializer.Serialize(new { e.TaskId, e.RoleId, Status = "Completed" }, JsonOptions)),

            ExecutionRunStarted e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.ExecutionStarted,
                $"system:worker:{e.RoleId}",
                JsonSerializer.Serialize(new { e.TaskId, e.RunId, e.RoleId }, JsonOptions)),

            ExecutionRunCompleted e => AuditEvent.Create(
                e.ProjectId,
                e.Success ? AuditEventType.ExecutionCompleted : AuditEventType.ExecutionFailed,
                "system:orchestration",
                JsonSerializer.Serialize(new { e.TaskId, e.RunId, e.Success, e.CostUsd }, JsonOptions)),

            AgreementApproved e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.AgreementApproved,
                e.ApprovedBy,
                JsonSerializer.Serialize(new { e.AgreementId }, JsonOptions)),

            ApprovalGateTriggered e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.GateTriggered,
                "system:governance",
                JsonSerializer.Serialize(new { e.GateName, e.RequiredApprover }, JsonOptions)),

            TeamTemplateAssigned e => AuditEvent.Create(
                e.ProjectId,
                AuditEventType.TeamTemplateAssigned,
                "system:capabilities",
                JsonSerializer.Serialize(new { e.TeamTemplateId, e.TemplateName }, JsonOptions)),

            _ => null
        };
    }
}
