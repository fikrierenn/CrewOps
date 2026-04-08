using CrewOps.Api.Services;
using CrewOps.Domain.Ports;

namespace CrewOps.Api.Routes;

public static class OrchestrationRoutes
{
    public static void MapOrchestrationRoutes(this WebApplication app)
    {
        var group = app.MapGroup("/api/orchestration").WithTags("Orchestration");

        // Plan parse test
        group.MapGet("/{projectId:guid}/parse-plan", (Guid projectId, PmAgentService pmAgent) =>
        {
            var history = pmAgent.GetHistory(projectId);
            var hasPlan = history.Any(m => PlanParser.ContainsPlan(m.Content));
            var tasks = PlanParser.ParsePlan(history);

            return Results.Ok(new
            {
                projectId,
                historyCount = history.Count,
                hasPlan,
                parsedTaskCount = tasks.Count,
                tasks = tasks.Select(t => new { t.Title, t.RoleId, Complexity = t.Complexity.ToString() })
            });
        });

        // Orkestrasyon başlat — yeni scope ile background çalıştır
        group.MapPost("/{projectId:guid}/start", (
            Guid projectId,
            PmAgentService pmAgent,
            IServiceProvider serviceProvider) =>
        {
            var history = pmAgent.GetHistory(projectId);
            var parsedTasks = PlanParser.ParsePlan(history);

            if (parsedTasks.Count == 0)
                return Results.BadRequest(new { error = "Plan parse edilemedi", historyCount = history.Count });

            // Background'da yeni scope ile çalıştır — scoped servisler düzgün çalışsın
            _ = Task.Run(async () =>
            {
                using var scope = serviceProvider.CreateScope();
                var orchestrator = scope.ServiceProvider.GetRequiredService<OrchestrationEngine>();
                try
                {
                    await orchestrator.ExecutePlanAsync(projectId, parsedTasks, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<OrchestrationEngine>>();
                    logger.LogError(ex, "Orchestration error for project {ProjectId}", projectId);
                }
            });

            return Results.Accepted(value: new
            {
                projectId,
                taskCount = parsedTasks.Count,
                tasks = parsedTasks.Select(t => new { t.Title, t.RoleId }),
                message = "Orkestrasyon başlatıldı. Dashboard'dan takip edebilirsiniz."
            });
        });

        // Senkron çalıştır (debug için — cevabı bekler)
        group.MapPost("/{projectId:guid}/start-sync", async (
            Guid projectId,
            PmAgentService pmAgent,
            OrchestrationEngine orchestrator) =>
        {
            var history = pmAgent.GetHistory(projectId);
            var parsedTasks = PlanParser.ParsePlan(history);

            if (parsedTasks.Count == 0)
                return Results.BadRequest(new { error = "Plan parse edilemedi", historyCount = history.Count });

            try
            {
                await orchestrator.ExecutePlanAsync(projectId, parsedTasks);
                return Results.Ok(new { message = "Tamamlandı", taskCount = parsedTasks.Count });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.ToString(), statusCode: 500);
            }
        });
        // Lead'leri doğrula (web sitesi var/yok/kötü kontrol)
        group.MapPost("/{projectId:guid}/verify-leads", async (
            Guid projectId,
            LeadVerifier verifier) =>
        {
            var result = await verifier.VerifyLeadsAsync(projectId);
            return Results.Ok(new
            {
                result.Total,
                result.NoSite,
                result.BadSite,
                result.GoodSiteRemoved,
                message = $"{result.NoSite} sitesiz + {result.BadSite} kötü siteli = {result.NoSite + result.BadSite} hedef. {result.GoodSiteRemoved} iyi siteli çıkarıldı."
            });
        });

        // Template önizleme — sample data ile template test
        app.MapGet("/api/demo-templates/preview", async (string? template, int? color) =>
        {
            var templateName = template ?? "luxury";
            var path = Path.Combine("wwwroot", $"demo-template-{templateName}.html");
            if (!File.Exists(path))
            {
                var available = Directory.GetFiles("wwwroot", "demo-template-*.html")
                    .Select(f => Path.GetFileNameWithoutExtension(f).Replace("demo-template-", ""));
                return Results.NotFound(new { error = $"Template '{templateName}' bulunamadı", available });
            }

            var colorIdx = color ?? 0;
            string[][] themes =
            [
                ["#8b5cf6", "#a78bfa", "#c4b5fd"],
                ["#059669", "#34d399", "#6ee7b7"],
                ["#e11d48", "#fb7185", "#fda4af"],
                ["#0891b2", "#22d3ee", "#67e8f9"],
                ["#b45309", "#d97706", "#f59e0b"],
                ["#1e3a5f", "#2563eb", "#60a5fa"],
            ];
            var c = themes[colorIdx % themes.Length];
            var hex1 = c[0].TrimStart('#'); var hex2 = c[1].TrimStart('#');
            var rgb1 = $"{Convert.ToInt32(hex1[..2],16)},{Convert.ToInt32(hex1[2..4],16)},{Convert.ToInt32(hex1[4..],16)}";
            var rgb2 = $"{Convert.ToInt32(hex2[..2],16)},{Convert.ToInt32(hex2[2..4],16)},{Convert.ToInt32(hex2[4..],16)}";

            var html = (await File.ReadAllTextAsync(path))
                .Replace("{{NAME}}", "Euphoria Beauty Center")
                .Replace("{{NAME_SHORT}}", "Euphoria Beauty")
                .Replace("{{SLOGAN}}", "Güzelliğinize Değer Katıyoruz")
                .Replace("{{ADDR}}", "Taksim, Beyoğlu / İstanbul")
                .Replace("{{PHONE}}", "+90 546 161 2147")
                .Replace("{{RATING}}", "4.8")
                .Replace("{{REVIEWS}}", "618")
                .Replace("{{STARS_EMOJI}}", "★★★★★")
                .Replace("{{C1}}", c[0]).Replace("{{C2}}", c[1]).Replace("{{C3}}", c[2])
                .Replace("{{RGB1}}", rgb1).Replace("{{RGB2}}", rgb2)
                .Replace("{{HERO_IMG}}", "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&h=900&fit=crop")
                .Replace("{{MAP_QUERY}}", "Euphoria+Beauty+Center+Taksim+Istanbul")
                .Replace("{{ABOUT_TITLE}}", "Profesyonel Güzellik Merkezi")
                .Replace("{{ABOUT_TEXT}}", "İstanbul'un kalbinde, uzman kadromuzla sizlere en kaliteli güzellik hizmetlerini sunuyoruz. Modern ekipmanlarımız ve deneyimli ekibimizle her zaman en iyisini hedefliyoruz.")
                .Replace("{{SRV1}}", "Cilt Bakımı").Replace("{{SRV2}}", "Saç Bakımı")
                .Replace("{{SRV3}}", "Manikür & Pedikür").Replace("{{SRV4}}", "Lazer Epilasyon")
                .Replace("{{SRV5}}", "Kaş & Kirpik").Replace("{{SRV6}}", "Masaj & SPA")
                .Replace("{{REV1}}", "Harika bir deneyimdi, kesinlikle tavsiye ederim!")
                .Replace("{{REV2}}", "Çok profesyonel ve ilgili bir ekip, memnun kaldım.")
                .Replace("{{REV3}}", "Her zaman kaliteli hizmet alıyorum, teşekkürler!");

            return Results.Content(html, "text/html");
        }).WithTags("Demo Templates");

        // Demo siteler oluştur
        group.MapPost("/{projectId:guid}/generate-demos", async (
            Guid projectId,
            DemoSiteGenerator generator) =>
        {
            var count = await generator.GenerateDemoSitesAsync(projectId);
            return Results.Ok(new { generated = count, message = $"{count} demo site oluşturuldu." });
        });
    }
}
