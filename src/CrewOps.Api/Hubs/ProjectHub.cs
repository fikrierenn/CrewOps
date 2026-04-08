using Microsoft.AspNetCore.SignalR;

namespace CrewOps.Api.Hubs;

/// <summary>
/// Proje bazlı real-time iletişim hub'ı.
/// Her bağlı client, izlediği projenin grubuna katılır
/// ve anlık state/task/execution güncellemeleri alır.
/// </summary>
public sealed class ProjectHub : Hub
{
    /// <summary>
    /// Client'ı belirtilen projenin SignalR grubuna ekler.
    /// Dashboard sayfaları açıldığında çağrılır.
    /// </summary>
    public async Task JoinProjectGroup(Guid projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, projectId.ToString());
    }

    /// <summary>
    /// Client'ı projenin SignalR grubundan çıkarır.
    /// Dashboard sayfaları kapatıldığında çağrılır.
    /// </summary>
    public async Task LeaveProjectGroup(Guid projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, projectId.ToString());
    }
}
