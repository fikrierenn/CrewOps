using System.Text.Json;
using CrewOps.Domain.DomainEvents;
using CrewOps.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CrewOps.Infrastructure.Observability;

/// <summary>
/// Domain event'leri SignalR üzerinden ilgili proje grubuna push eder.
/// Her bağlı Blazor dashboard anında güncelleme alır.
/// </summary>
public sealed class SignalREventForwarder : INotificationHandler<DomainEventNotification>
{
    private readonly IHubContext<DummyProjectHub> _hubContext;
    private readonly ILogger<SignalREventForwarder> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SignalREventForwarder(IHubContext<DummyProjectHub> hubContext, ILogger<SignalREventForwarder> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task Handle(DomainEventNotification notification, CancellationToken cancellationToken)
    {
        try
        {
            var (projectId, method, payload) = MapToSignalRMessage(notification.DomainEvent);
            if (projectId == Guid.Empty || method is null)
                return;

            await _hubContext.Clients
                .Group(projectId.ToString())
                .SendAsync(method, payload, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SignalR event forwarding başarısız: {EventType}",
                notification.DomainEvent.GetType().Name);
        }
    }

    private static (Guid ProjectId, string? Method, object? Payload) MapToSignalRMessage(IDomainEvent domainEvent)
    {
        return domainEvent switch
        {
            ProjectStateChanged e => (e.ProjectId, "ProjectStateUpdated", new
            {
                e.ProjectId,
                FromState = e.FromState.ToString(),
                ToState = e.ToState.ToString(),
                e.TriggeredBy,
                e.OccurredAt
            }),

            TaskCompleted e => (e.ProjectId, "TaskStatusUpdated", new
            {
                e.ProjectId,
                e.TaskId,
                Status = "Completed",
                e.OccurredAt
            }),

            ExecutionRunStarted e => (e.ProjectId, "ExecutionRunUpdated", new
            {
                e.ProjectId,
                e.RunId,
                Status = "Running",
                e.RoleId,
                e.OccurredAt
            }),

            ExecutionRunCompleted e => (e.ProjectId, "ExecutionRunUpdated", new
            {
                e.ProjectId,
                e.RunId,
                Status = e.Success ? "Completed" : "Failed",
                e.CostUsd,
                e.OccurredAt
            }),

            TeamTemplateAssigned e => (e.ProjectId, "AuditEventCreated", new
            {
                e.ProjectId,
                EventType = "TeamTemplateAssigned",
                e.TemplateName,
                e.OccurredAt
            }),

            _ => (Guid.Empty, null, null)
        };
    }
}

/// <summary>
/// Infrastructure katmanının compile olması için geçici hub marker.
/// Runtime'da gerçek ProjectHub (Api katmanında) ile değiştirilir.
/// DI registration: services.AddSignalR() + IHubContext&lt;ProjectHub&gt;
/// </summary>
public sealed class DummyProjectHub : Hub { }
