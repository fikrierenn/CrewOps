using CrewOps.Contracts.Queries;
using MediatR;

namespace CrewOps.Api.Routes;

public static class ExecutionRoutes
{
    public static void MapExecutionRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api").WithTags("Executions");

        group.MapGet("/projects/{projectId:guid}/runs",
            async (Guid projectId, IMediator mediator) =>
                Results.Ok(await mediator.Send(new GetRunsByProjectQuery(projectId))));
    }
}
