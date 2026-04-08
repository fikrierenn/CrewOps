using CrewOps.Application.Mapping;
using CrewOps.Capabilities;

namespace CrewOps.Api.Routes;

public static class CapabilityRoutes
{
    public static void MapCapabilityRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api").WithTags("Capabilities");

        group.MapGet("/team-templates", (ICapabilityRegistry registry) =>
            Results.Ok(registry.GetAllTeamTemplates().Select(DtoMapper.ToDto)));

        group.MapGet("/team-templates/{id:guid}", (Guid id, ICapabilityRegistry registry) =>
        {
            var template = registry.GetTeamTemplate(id);
            return template is null ? Results.NotFound() : Results.Ok(DtoMapper.ToDto(template));
        });

        group.MapGet("/roles", (ICapabilityRegistry registry) =>
            Results.Ok(registry.GetAllRoles()));

        group.MapGet("/domains", (ICapabilityRegistry registry) =>
            Results.Ok(registry.GetAllDomains()));

        group.MapGet("/skills", (ICapabilityRegistry registry) =>
            Results.Ok(registry.GetAllSkills().Select(s => new { s.Id, s.Name, s.PluginDomain, s.Description })));
    }
}
