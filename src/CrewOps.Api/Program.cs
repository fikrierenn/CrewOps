using CrewOps.Api.Hubs;
using CrewOps.Api.Routes;
using CrewOps.Api.Services;
using CrewOps.Capabilities;
using CrewOps.Capabilities.Loading;
using CrewOps.Capabilities.Scanning;
using CrewOps.Domain.Ports;
using CrewOps.Domain.StateMachine;
using CrewOps.Infrastructure.Persistence;
using CrewOps.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Serilog;

// ─── Serilog bootstrap ──────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/crewops-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();

    // ─── EF Core (Factory — Blazor + API ortak kullanım) ────────
    var connStr = builder.Configuration.GetConnectionString("CrewOps")
        ?? "Server=localhost;Database=CrewOps;Trusted_Connection=True;TrustServerCertificate=True;";

    builder.Services.AddDbContextFactory<CrewOpsDbContext>(options =>
        options.UseSqlServer(connStr), ServiceLifetime.Singleton);

    // Scoped DbContext — factory'den oluşturulur (repository'ler + API için)
    builder.Services.AddScoped(sp =>
        sp.GetRequiredService<IDbContextFactory<CrewOpsDbContext>>().CreateDbContext());

    // ─── MediatR (Application + Infrastructure handlers) ─────
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssembly(typeof(CrewOps.Application.Handlers.CreateProjectCommandHandler).Assembly);
        cfg.RegisterServicesFromAssembly(typeof(CrewOpsDbContext).Assembly);
    });

    // ─── Domain services ─────────────────────────────────────
    builder.Services.AddSingleton<IProjectStateMachine, ProjectStateMachine>();

    // ─── Repositories ────────────────────────────────────────
    builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
    builder.Services.AddScoped<ITaskRepository, TaskRepository>();
    builder.Services.AddScoped<IExecutionRunRepository, ExecutionRunRepository>();
    builder.Services.AddScoped<IAuditEventRepository, AuditEventRepository>();

    // ─── Capabilities (startup'ta yüklenir) ──────────────────
    builder.Services.AddSingleton<ICapabilityRegistry>(sp =>
    {
        var registry = new InMemoryCapabilityRegistry();
        var basePath = builder.Environment.ContentRootPath;

        // agents-main/ skill scan
        var agentsMainPath = Path.Combine(basePath, "..", "..", "agents-main");
        if (Directory.Exists(agentsMainPath))
        {
            var scanner = new SkillSourceScanner();
            registry.RegisterSkills(scanner.Scan(agentsMainPath));
        }

        // templates/roles/ yükle
        var rolesPath = Path.Combine(basePath, "..", "..", "templates", "roles");
        if (Directory.Exists(rolesPath))
        {
            var roleLoader = new RoleProfileLoader();
            registry.RegisterRoles(roleLoader.Load(rolesPath));
        }

        // templates/team-templates/ yükle
        var templatesPath = Path.Combine(basePath, "..", "..", "templates", "team-templates");
        if (Directory.Exists(templatesPath))
        {
            var templateLoader = new TeamTemplateLoader();
            registry.RegisterTeamTemplates(templateLoader.Load(templatesPath));
        }

        return registry;
    });

    // ─── LLM Client + PM Agent + Orchestration ────────────────
    builder.Services.AddHttpClient<LlmClient>();
    builder.Services.AddHttpClient<WebsiteProber>();
    builder.Services.AddHttpClient<SeoAnalyzer>();
    builder.Services.AddHttpClient(); // Blazor → API calls
    builder.Services.AddSingleton<PmAgentService>();
    builder.Services.AddScoped<OrchestrationEngine>();
    builder.Services.AddScoped<CrewOps.Api.Services.LeadVerifier>();
    builder.Services.AddScoped<CrewOps.Api.Services.DemoSiteGenerator>();

    // ─── SignalR ─────────────────────────────────────────────
    builder.Services.AddSignalR();

    // ─── Blazor Server ───────────────────────────────────────
    builder.Services.AddRazorComponents()
        .AddInteractiveServerComponents();

    var app = builder.Build();

    // ─── Middleware pipeline ─────────────────────────────────
    app.UseSerilogRequestLogging();
    app.UseStaticFiles();
    app.UseAntiforgery();

    // ─── API Routes ──────────────────────────────────────────
    app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

    app.MapProjectRoutes();
    app.MapTaskRoutes();
    app.MapExecutionRoutes();
    app.MapAuditRoutes();
    app.MapCapabilityRoutes();
    app.MapOrchestrationRoutes();

    // ─── SignalR hub ─────────────────────────────────────────
    app.MapHub<ProjectHub>("/hubs/project");

    // ─── Blazor Server ───────────────────────────────────────
    app.MapRazorComponents<CrewOps.Api.Components.App>()
        .AddInteractiveServerRenderMode();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Uygulama başlatılamadı");
}
finally
{
    Log.CloseAndFlush();
}
