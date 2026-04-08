using CrewOps.Api.Services;
using CrewOps.Contracts.Commands;
using Microsoft.EntityFrameworkCore;
using CrewOps.Contracts.Queries;
using MediatR;

namespace CrewOps.Api.Routes;

public static class ProjectRoutes
{
    public static void MapProjectRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api/projects").WithTags("Projects");

        // Tüm test verilerini temizle (DEV ONLY)
        group.MapDelete("/cleanup", async (Infrastructure.Persistence.CrewOpsDbContext db) =>
        {
            db.Set<Domain.Entities.Lead>().RemoveRange(db.Set<Domain.Entities.Lead>());
            db.Set<Domain.Aggregates.ExecutionRun>().RemoveRange(db.Set<Domain.Aggregates.ExecutionRun>());
            db.Set<Domain.Aggregates.CrewOpsTask>().RemoveRange(db.Set<Domain.Aggregates.CrewOpsTask>());
            db.AuditEvents.RemoveRange(db.AuditEvents);
            db.Projects.RemoveRange(db.Projects);
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Tüm veriler temizlendi" });
        }).WithTags("Dev");

        // ─── Leads API ────────────────────────────────────────
        group.MapGet("/{id:guid}/leads", async (Guid id, IDbContextFactory<Infrastructure.Persistence.CrewOpsDbContext> dbf) =>
        {
            await using var db = await dbf.CreateDbContextAsync();
            var leads = await db.Leads.Where(l => l.ProjectId == id)
                .OrderByDescending(l => l.GoogleRating)
                .ToListAsync();
            return Results.Ok(leads.Select(l => new
            {
                l.Id, l.Name, l.Address, l.District, l.Phone,
                l.GoogleRating, l.GoogleReviewCount,
                l.WebsiteStatus, l.WebsiteUrl,
                l.DemoSiteUrl, l.SeoScore, l.SeoReport,
                l.Status, l.Notes, l.CreatedAt
            }));
        }).WithTags("Leads");

        // Sektör API — yüklü sektörleri listele
        app.MapGet("/api/sectors", (SectorSkillLoader loader) =>
        {
            return Results.Ok(loader.GetAll().Select(s => new
            {
                s.Sector, s.SectorLabel, s.Category,
                Keywords = s.SearchKeywords.Length,
                Services = s.TypicalServices
            }));
        }).WithTags("Sectors");

        // Sektör tespit API
        app.MapPost("/api/sectors/classify", (ClassifyRequest req, SectorSkillLoader loader) =>
        {
            var config = loader.Classify(req.Text);
            return Results.Ok(config);
        }).WithTags("Sectors");

        // PM Chat API — mesaj gönder, yanıt al
        group.MapPost("/{id:guid}/chat", async (Guid id, ChatRequest req, PmAgentService pm) =>
        {
            var response = await pm.ChatAsync(id, req.Message);
            return Results.Ok(new { reply = response });
        }).WithTags("PM Chat");

        // PM Chat history
        group.MapGet("/{id:guid}/chat", (Guid id, PmAgentService pm) =>
        {
            var history = pm.GetHistory(id);
            return Results.Ok(history.Select(m => new { m.Role, m.Content }));
        }).WithTags("PM Chat");

        group.MapGet("/", async (IMediator mediator) =>
            Results.Ok(await mediator.Send(new GetProjectsQuery())));

        group.MapGet("/{id:guid}", async (Guid id, IMediator mediator) =>
        {
            var result = await mediator.Send(new GetProjectByIdQuery(id));
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/", async (CreateProjectCommand cmd, IMediator mediator) =>
        {
            var result = await mediator.Send(cmd);
            return Results.Created($"/api/projects/{result.Id}", result);
        });

        group.MapPost("/universal", async (CreateUniversalProjectCommand cmd, IMediator mediator) =>
        {
            var result = await mediator.Send(cmd);
            return Results.Created($"/api/projects/{result.Id}", result);
        });

        group.MapPut("/{id:guid}/team-template", async (Guid id, AssignTeamTemplateCommand cmd, IMediator mediator) =>
        {
            var command = cmd with { ProjectId = id };
            var result = await mediator.Send(command);
            return Results.Ok(result);
        });

        group.MapPost("/{id:guid}/transition", async (Guid id, TransitionProjectCommand cmd, IMediator mediator) =>
        {
            var command = cmd with { ProjectId = id };
            var result = await mediator.Send(command);
            return Results.Ok(result);
        });
    }
}

/// <summary>PM Chat mesaj isteği.</summary>
public sealed record ChatRequest(string Message);

/// <summary>Sektör sınıflandırma isteği.</summary>
public sealed record ClassifyRequest(string Text);
