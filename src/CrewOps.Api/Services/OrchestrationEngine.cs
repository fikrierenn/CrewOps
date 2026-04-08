using CrewOps.Domain.Aggregates;
using CrewOps.Domain.Ports;
using CrewOps.Domain.StateMachine;
using CrewOps.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Api.Services;

/// <summary>
/// Orkestrasyon motoru — plan parse → görev oluştur → agent'ları sırayla çalıştır → sonuçları kaydet.
/// Her adımda state machine geçişi yapar ve AuditEvent üretilir.
/// </summary>
public sealed class OrchestrationEngine
{
    private readonly IProjectRepository _projectRepo;
    private readonly ITaskRepository _taskRepo;
    private readonly IExecutionRunRepository _runRepo;
    private readonly IProjectStateMachine _stateMachine;
    private readonly LlmClient _llm;
    private readonly Infrastructure.Persistence.CrewOpsDbContext _db;
    private readonly LeadVerifier _verifier;
    private readonly DemoSiteGenerator _demoGenerator;
    private readonly ILogger<OrchestrationEngine> _logger;

    public OrchestrationEngine(
        IProjectRepository projectRepo,
        ITaskRepository taskRepo,
        IExecutionRunRepository runRepo,
        IProjectStateMachine stateMachine,
        LlmClient llm,
        Infrastructure.Persistence.CrewOpsDbContext db,
        LeadVerifier verifier,
        DemoSiteGenerator demoGenerator,
        ILogger<OrchestrationEngine> logger)
    {
        _projectRepo = projectRepo;
        _taskRepo = taskRepo;
        _runRepo = runRepo;
        _stateMachine = stateMachine;
        _llm = llm;
        _db = db;
        _verifier = verifier;
        _demoGenerator = demoGenerator;
        _logger = logger;
    }

    /// <summary>
    /// Event callback — her adımda UI'ı güncellemek için.
    /// </summary>
    public event Func<string, Task>? OnProgress;

    /// <summary>
    /// PM planını alır, görevleri oluşturur, agent'ları sırayla çalıştırır.
    /// </summary>
    public async Task ExecutePlanAsync(
        Guid projectId,
        List<ParsedTask> parsedTasks,
        CancellationToken ct = default)
    {
        var project = await _projectRepo.FindByIdAsync(projectId, ct)
            ?? throw new InvalidOperationException($"Proje bulunamadı: {projectId}");

        // ─── State: Discovery → AgreementDrafted → AgreementApproved → Planned ───
        await TransitionSafe(project, ProjectState.AgreementDrafted, "system:pm", ct);
        await TransitionSafe(project, ProjectState.AgreementApproved, "system:pm", ct);
        project.RecordAgreementApproval("PM planı onaylandı", "user");
        await _projectRepo.UpdateAsync(project, ct);

        await TransitionSafe(project, ProjectState.Planned, "system:pm", ct);
        await Notify("Plan onaylandı, görevler oluşturuluyor...");

        // ─── Görevleri oluştur ───────────────────────────────
        var tasks = new List<CrewOpsTask>();
        for (var i = 0; i < parsedTasks.Count; i++)
        {
            var pt = parsedTasks[i];
            var deps = i > 0 ? new[] { tasks[i - 1].Id } : null; // Sıralı bağımlılık
            var task = CrewOpsTask.Create(projectId, pt.Title, pt.Title, pt.RoleId, pt.Complexity, deps);
            tasks.Add(task);
        }
        await _taskRepo.AddRangeAsync(tasks, ct);

        await TransitionSafe(project, ProjectState.TasksCreated, "system:orchestration", ct);
        await TransitionSafe(project, ProjectState.CapabilitiesAssigned, "system:orchestration", ct);
        await Notify($"{tasks.Count} görev oluşturuldu. Yürütme başlıyor...");

        // ─── State: InExecution ──────────────────────────────
        await TransitionSafe(project, ProjectState.InExecution, "system:orchestration", ct);

        // ─── Her görevi sırayla çalıştır (zincir: önceki çıktı → sonraki context) ──
        var previousOutputs = new List<string>();

        for (var i = 0; i < tasks.Count; i++)
        {
            var task = tasks[i];

            // research-agent ise ilçe ilçe arama yap
            if (task.RoleId == "research-agent")
            {
                await ExecuteDistrictSearchAsync(task, project, previousOutputs, projectId, ct);
                continue;
            }

            await ExecuteSingleTaskAsync(task, project, previousOutputs, projectId, ct);
        }

        // ─── Lead'leri tüm run çıktılarından parse et ve kaydet ─
        var allRuns = await _runRepo.GetByProjectIdAsync(projectId, ct);
        var totalLeads = 0;
        var seenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var completedRun in allRuns.Where(r => r.Status == ExecutionStatus.Completed && r.RawOutput is not null))
        {
            var leads = LeadParser.ParseLeads(projectId, completedRun.RawOutput!);
            // Duplicate kontrolü — aynı isimli salon birden fazla run'da geçebilir
            var newLeads = leads.Where(l => seenNames.Add(l.Name)).ToList();
            if (newLeads.Count > 0)
            {
                await _db.Leads.AddRangeAsync(newLeads, ct);
                totalLeads += newLeads.Count;
            }
        }
        if (totalLeads > 0)
        {
            await _db.SaveChangesAsync(ct);
            await Notify($"  {totalLeads} lead DB'ye kaydedildi!");
        }

        // ─── Faz 2: Lead Doğrulama ──────────────────────────
        await Notify("Lead'ler doğrulanıyor (web sitesi kontrolü)...");
        try
        {
            var verifyResult = await _verifier.VerifyLeadsAsync(projectId, ct);
            await Notify($"  Doğrulama: {verifyResult.NoSite} sitesiz, {verifyResult.BadSite} kötü siteli, {verifyResult.GoodSiteRemoved} iyi siteli çıkarıldı");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lead doğrulama hatası");
            await Notify($"  Doğrulama kısmen başarısız: {ex.Message}");
        }

        // ─── Faz 3: Demo Site Oluşturma ─────────────────────
        await Notify("Demo siteler oluşturuluyor...");
        try
        {
            var demoCount = await _demoGenerator.GenerateDemoSitesAsync(projectId, ct);
            await Notify($"  {demoCount} demo site oluşturuldu!");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Demo site oluşturma hatası");
            await Notify($"  Demo site kısmen başarısız: {ex.Message}");
        }

        // ─── Faz 4: Pazarlama Mesajları ─────────────────────
        await Notify("Pazarlama mesajları hazırlanıyor...");
        try
        {
            await GenerateMarketingMessagesAsync(projectId, ct);
            await Notify("  Pazarlama mesajları hazır!");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Pazarlama mesajı hatası");
        }

        // ─── Tamamla ────────────────────────────────────────
        await TransitionSafe(project, ProjectState.InReview, "system:orchestration", ct);
        await TransitionSafe(project, ProjectState.ReadyForPmSummary, "system:pm", ct);
        await TransitionSafe(project, ProjectState.ReadyForHumanReview, "system:pm", ct);

        var skipDeploy = project.Governance is { HasStagingGate: false, HasProductionGate: false };
        if (skipDeploy)
        {
            await TransitionSafe(project, ProjectState.Completed, "system:orchestration", ct);
        }

        await Notify("Pipeline tamamlandı! Lead listesi, demo siteler ve pazarlama mesajları hazır.");
    }

    /// <summary>İlçe ilçe arama — research-agent görevi için her ilçeyi ayrı sorgu olarak çalıştırır.</summary>
    private async Task ExecuteDistrictSearchAsync(
        CrewOpsTask task, Project project, List<string> previousOutputs, Guid projectId, CancellationToken ct)
    {
        // Proje adından veya açıklamasından ilçe/şehir bilgisini çıkar
        var districts = ExtractDistricts(project.InitialRequest ?? project.Name);
        if (districts.Count == 0)
            districts = ["merkez"]; // Fallback

        var city = ExtractCity(project.InitialRequest ?? project.Name);

        await Notify($"[İlçe Arama] {city} — {districts.Count} ilçe: {string.Join(", ", districts)}");

        task.MarkQueued();
        await _taskRepo.UpdateAsync(task, ct);
        task.MarkInProgress();
        await _taskRepo.UpdateAsync(task, ct);

        var allResults = new List<string>();

        for (var d = 0; d < districts.Count; d++)
        {
            var district = districts[d];
            await Notify($"  [{d + 1}/{districts.Count}] {district} ilçesi aranıyor...");

            var run = ExecutionRun.Create(task.Id, projectId, task.RoleId, task.ComplexityHint, d + 1);
            await _runRepo.AddAsync(run, ct);
            run.MarkQueued(); await _runRepo.UpdateAsync(run, ct);
            run.MarkWorkspacePrepared("/workspace"); await _runRepo.UpdateAsync(run, ct);
            run.MarkRunning(); await _runRepo.UpdateAsync(run, ct);

            var startTime = DateTime.UtcNow;

            try
            {
                var searchPrompt = BuildDistrictSearchPrompt(task, project, district, city);

                var result = await _llm.SendMessageAsync(
                    searchPrompt,
                    [new ChatMessage("user", $"{city} {district} ilçesindeki {ExtractBusinessType(project.Name)} ara ve bul. " +
                        "Google Maps'te ara. Bulunan HER işletmenin bilgilerini JSON formatında ver. " +
                        "En az 5 işletme bul. HALÜSİNASYON YAPMA — bulamadığını uydurma.")],
                    maxTokens: 4096,
                    useWebSearch: true,
                    ct: ct);

                var durationMs = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

                run.MarkCollectingArtifacts(); await _runRepo.UpdateAsync(run, ct);
                run.MarkNormalizing(); await _runRepo.UpdateAsync(run, ct);
                run.MarkReviewing(); await _runRepo.UpdateAsync(run, ct);
                run.MarkCompleted(result, 500, 300, 0.002m, durationMs);
                await _runRepo.UpdateAsync(run, ct);

                allResults.Add(result);
                await Notify($"    ✓ {district} tamamlandı ({durationMs}ms)");

                // Rate limit — 3 saniye bekle
                await Task.Delay(3000, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "İlçe araması başarısız: {District}", district);
                run.MarkFailed(ex.Message);
                await _runRepo.UpdateAsync(run, ct);
                await Notify($"    ✗ {district} başarısız: {ex.Message}");
            }
        }

        // Tüm ilçe sonuçlarını birleştir
        var combined = string.Join("\n\n---\n\n", allResults);
        previousOutputs.Add($"[{task.RoleId}: {task.Title}]\n{combined}");

        task.MarkAwaitingReview(); await _taskRepo.UpdateAsync(task, ct);
        task.MarkApproved(); await _taskRepo.UpdateAsync(task, ct);
        task.MarkCompleted(); await _taskRepo.UpdateAsync(task, ct);

        await Notify($"  ✓ İlçe araması tamamlandı — {districts.Count} ilçe tarandı");
    }

    /// <summary>Tekil görev çalıştırma — research-agent dışındaki tüm görevler için.</summary>
    private async Task ExecuteSingleTaskAsync(
        CrewOpsTask task, Project project, List<string> previousOutputs, Guid projectId, CancellationToken ct)
    {
        await Notify($"[Görev] {task.RoleId}: {task.Title}");

        task.MarkQueued(); await _taskRepo.UpdateAsync(task, ct);
        task.MarkInProgress(); await _taskRepo.UpdateAsync(task, ct);

        var run = ExecutionRun.Create(task.Id, projectId, task.RoleId, task.ComplexityHint, 1);
        await _runRepo.AddAsync(run, ct);
        run.MarkQueued(); await _runRepo.UpdateAsync(run, ct);
        run.MarkWorkspacePrepared("/workspace"); await _runRepo.UpdateAsync(run, ct);
        run.MarkRunning(); await _runRepo.UpdateAsync(run, ct);

        var startTime = DateTime.UtcNow;

        try
        {
            var agentPrompt = BuildAgentPrompt(task, project, previousOutputs);
            var needsSearch = task.RoleId is "data-analyst" or "seo-analyst" or "seo-specialist";

            var result = await _llm.SendMessageAsync(
                agentPrompt,
                [new ChatMessage("user", $"Görev: {task.Title}\n\nBu görevi tamamla ve somut çıktı üret.")],
                maxTokens: 4096,
                useWebSearch: needsSearch,
                ct: ct);

            var durationMs = (long)(DateTime.UtcNow - startTime).TotalMilliseconds;

            run.MarkCollectingArtifacts(); await _runRepo.UpdateAsync(run, ct);
            run.MarkNormalizing(); await _runRepo.UpdateAsync(run, ct);
            run.MarkReviewing(); await _runRepo.UpdateAsync(run, ct);
            run.MarkCompleted(result, 500, 300, 0.002m, durationMs);
            await _runRepo.UpdateAsync(run, ct);

            previousOutputs.Add($"[{task.RoleId}: {task.Title}]\n{result}");

            task.MarkAwaitingReview(); await _taskRepo.UpdateAsync(task, ct);
            task.MarkApproved(); await _taskRepo.UpdateAsync(task, ct);
            task.MarkCompleted(); await _taskRepo.UpdateAsync(task, ct);

            await Notify($"  ✓ Tamamlandı ({durationMs}ms)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Görev başarısız: {TaskId}", task.Id);
            run.MarkFailed(ex.Message); await _runRepo.UpdateAsync(run, ct);
            task.MarkFailed(); await _taskRepo.UpdateAsync(task, ct);
            await Notify($"  ✗ Başarısız: {ex.Message}");
        }
    }

    /// <summary>İlçe bazlı arama prompt'u — odaklı ve spesifik.</summary>
    private static string BuildDistrictSearchPrompt(CrewOpsTask task, Project project, string district, string city)
    {
        var businessType = ExtractBusinessType(project.Name);
        var jsonExample = """[{"ad":"İşletme Adı","adres":"Tam adres","ilce":"İlçe","telefon":"+90...","puan":4.5,"yorumSayisi":150,"siteDurumu":"yok","siteUrl":null}]""";

        return $"""
            Sen bir araştırma agent'ısın. Google Maps'te gerçek işletme araması yapıyorsun.

            ## GÖREV
            {city} ili {district} ilçesindeki {businessType} bul.
            Google Maps'te "{businessType} {district} {city}" araması yap.

            ## KRİTİK KURALLAR
            1. SADECE Google Maps / Google Haritalar verisini kullan
            2. HALÜSİNASYON YAPMA — gerçek olduğundan emin olmadığın bilgiyi ASLA üretme
            3. Bulamadığın bilgi için "bilinmiyor" yaz
            4. SADECE {city} {district} ilçesindeki işletmeleri yaz
            5. SADECE {businessType} kategorisindeki işletmeleri yaz — başka kategori YAZMA
            6. Belediye, kültür merkezi, okul, hastane gibi alakasız yerler YAZMA
            7. Sonuçları JSON array formatında ver: {jsonExample}
            8. Her işletme için: ad, adres, ilce, telefon, puan, yorumSayisi, siteDurumu bilgisi ZORUNLU
            9. siteDurumu: "yok" (web sitesi yok), "var" (web sitesi var), "bilinmiyor"
            10. En az 5 işletme bul — mümkünse 10+
            """;
    }

    /// <summary>Proje adından şehir adını çıkarır.</summary>
    private static string ExtractCity(string text)
    {
        var cities = new[] { "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya",
            "gaziantep", "kayseri", "mersin", "eskisehir", "diyarbakir", "samsun", "trabzon" };
        var lower = text.ToLowerInvariant()
            .Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u').Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g');
        foreach (var c in cities)
            if (lower.Contains(c)) return char.ToUpper(c[0]) + c[1..];
        return "İstanbul"; // default
    }

    /// <summary>Proje adı/açıklamasından ilçe adlarını çıkarır.</summary>
    private static List<string> ExtractDistricts(string text)
    {
        var knownDistricts = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["istanbul"] = ["Kadıköy", "Beşiktaş", "Şişli", "Bakırköy", "Ataşehir", "Üsküdar", "Beyoğlu", "Fatih", "Maltepe", "Pendik", "Kartal", "Tuzla", "Sarıyer", "Beykoz", "Zeytinburnu", "Bayrampaşa", "Başakşehir", "Esenyurt", "Küçükçekmece", "Avcılar"],
            ["bursa"] = ["Nilüfer", "Osmangazi", "Yıldırım", "Mudanya", "Gemlik", "İnegöl", "Gürsu"],
            ["ankara"] = ["Çankaya", "Keçiören", "Yenimahalle", "Mamak", "Etimesgut", "Sincan", "Altındağ", "Pursaklar"],
            ["izmir"] = ["Konak", "Bornova", "Karşıyaka", "Buca", "Bayraklı", "Çiğli", "Gaziemir", "Balçova"],
            ["antalya"] = ["Muratpaşa", "Konyaaltı", "Kepez", "Aksu", "Döşemealtı"],
        };

        var lower = text.ToLowerInvariant();
        var found = new List<string>();

        foreach (var (_, districts) in knownDistricts)
        {
            foreach (var d in districts)
            {
                var dLower = d.ToLowerInvariant().Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u').Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g');
                var textNorm = lower.Replace('ı', 'i').Replace('ö', 'o').Replace('ü', 'u').Replace('ş', 's').Replace('ç', 'c').Replace('ğ', 'g');
                if (textNorm.Contains(dLower))
                    found.Add(d);
            }
        }

        // Hiç bulamadıysa, şehre göre ilk 3 ilçeyi default al
        if (found.Count == 0)
        {
            var city = ExtractCity(text).ToLowerInvariant();
            if (knownDistricts.TryGetValue(city, out var defaults))
                found.AddRange(defaults.Take(3));
        }

        return found;
    }

    /// <summary>Proje adından işletme türünü çıkarır.</summary>
    private static string ExtractBusinessType(string name)
    {
        var lower = name.ToLowerInvariant();
        if (lower.Contains("diş") || lower.Contains("dis")) return "diş klinikleri";
        if (lower.Contains("berber")) return "erkek berberleri";
        if (lower.Contains("güzellik") || lower.Contains("guzellik") || lower.Contains("kuaför") || lower.Contains("kuafor")) return "güzellik salonları";
        if (lower.Contains("restoran") || lower.Contains("cafe") || lower.Contains("kafe")) return "restoran ve kafeler";
        if (lower.Contains("oto") || lower.Contains("yıkama") || lower.Contains("servis")) return "oto yıkama ve servis";
        if (lower.Contains("veteriner")) return "veteriner klinikleri";
        if (lower.Contains("eczane")) return "eczaneler";
        if (lower.Contains("avukat") || lower.Contains("hukuk")) return "hukuk büroları";
        return "işletmeler";
    }

    private async Task TransitionSafe(Project project, ProjectState target, string triggeredBy, CancellationToken ct)
    {
        try
        {
            _stateMachine.Transition(project, target, triggeredBy);
            await _projectRepo.UpdateAsync(project, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "State geçişi atlandı: {Target}", target);
        }
    }

    private static string BuildAgentPrompt(CrewOpsTask task, Project project, List<string> previousOutputs)
    {
        var contextSection = previousOutputs.Count > 0
            ? "\n## Önceki Görevlerin Çıktıları\n" + string.Join("\n---\n", previousOutputs)
            : "";

        var jsonExample = """[{"ad":"Salon Adı","adres":"Tam adres","ilce":"İlçe","telefon":"+90...","puan":4.5,"yorumSayisi":150,"siteDurumu":"yok","siteUrl":null}]""";

        return $"""
            Sen CrewOps AI Takım Orkestratörü'nde bir {task.RoleId} agent'ısın.

            ## Proje: {project.Name}
            ## Görevin: {task.Title}
            {contextSection}

            ## KRİTİK KURALLAR
            - Türkçe yanıt ver
            - SADECE Google Maps / Google Haritalar verisi kullan
            - HALÜSİNASYON YAPMA — gerçek olduğundan emin olmadığın bilgiyi ÜRETME
            - Bulamadığın bilgi için "bilinmiyor" yaz, ASLA uydurma
            - 20 tane zorunlu DEĞİL — kaç tane gerçek veri varsa o kadar yaz
            - Az ama GERÇEK veri, çok ama UYDURMA veriden iyidir
            - Önceki görevlerin çıktılarını kullan ve üzerine inşa et
            - SON GÖREVDE sonuçları JSON array formatında ver: {jsonExample}
            - ŞEHİR: Kullanıcının belirttiği şehir dışına ÇIKMA
            """;
    }

    private async Task GenerateMarketingMessagesAsync(Guid projectId, CancellationToken ct)
    {
        var leads = await _db.Leads
            .Where(l => l.ProjectId == projectId && l.DemoSiteUrl != null)
            .ToListAsync(ct);

        foreach (var lead in leads)
        {
            try
            {
                var message = await _llm.SendMessageAsync(
                    """
                    Sen profesyonel bir dijital pazarlama uzmanısın.
                    Güzellik salonlarına web sitesi satışı yapıyorsun.
                    Salon'a özel, kısa ve ikna edici bir WhatsApp/mail mesajı yaz.
                    Mesaj Türkçe olmalı, samimi ama profesyonel.
                    Demo site linkini mesaja ekle.
                    Max 5 cümle.
                    """,
                    [new ChatMessage("user", $"""
                    Salon: {lead.Name}
                    Adres: {lead.Address}
                    Puan: {lead.GoogleRating}/5 ({lead.GoogleReviewCount} yorum)
                    Demo Site: {lead.DemoSiteUrl}

                    Bu salona web sitesi satış mesajı yaz.
                    """)],
                    maxTokens: 300,
                    ct: ct);

                // Notes'a pazarlama mesajını kaydet
                var notesProp = typeof(Domain.Entities.Lead).GetProperty("Notes")!;
                notesProp.SetValue(lead, message.Trim());
                var updatedProp = typeof(Domain.Entities.Lead).GetProperty("UpdatedAt")!;
                updatedProp.SetValue(lead, DateTime.UtcNow);

                await Notify($"  Mesaj hazır: {lead.Name}");
                await Task.Delay(1500, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Pazarlama mesajı hatası: {Name}", lead.Name);
            }
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task Notify(string message)
    {
        _logger.LogInformation("Orchestration: {Message}", message);
        if (OnProgress is not null)
            await OnProgress(message);
    }
}
