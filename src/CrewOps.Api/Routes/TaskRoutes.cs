using CrewOps.Contracts.Queries;
using MediatR;

namespace CrewOps.Api.Routes;

public static class TaskRoutes
{
    public static void MapTaskRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api").WithTags("Tasks");

        group.MapGet("/projects/{projectId:guid}/tasks",
            async (Guid projectId, IMediator mediator) =>
                Results.Ok(await mediator.Send(new GetTasksByProjectQuery(projectId))));
    }
}
