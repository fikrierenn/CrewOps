using CrewOps.Contracts.Queries;
using MediatR;

namespace CrewOps.Api.Routes;

public static class AuditRoutes
{
    public static void MapAuditRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api").WithTags("Audit");

        group.MapGet("/projects/{projectId:guid}/timeline",
            async (Guid projectId, DateTime? from, DateTime? to, IMediator mediator) =>
                Results.Ok(await mediator.Send(new GetProjectTimelineQuery(projectId, from, to))));
    }
}
