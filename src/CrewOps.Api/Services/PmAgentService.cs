using CrewOps.Domain.Entities;
using CrewOps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CrewOps.Api.Services;

/// <summary>
/// PM Agent servisi — kullanıcı ile sohbet eder, proje planlar, görev oluşturur.
/// Her proje için ayrı conversation history tutar — DB'de kalıcı.
/// LlmClient üzerinden çoklu provider desteği (Groq, Gemini, Claude).
/// </summary>
public sealed class PmAgentService
{
    private readonly LlmClient _llm;
    private readonly IDbContextFactory<CrewOpsDbContext> _dbFactory;
    private readonly ILogger<PmAgentService> _logger;

    // In-memory cache (DB'den yüklenir, performans için)
    private readonly Dictionary<Guid, List<ChatMessage>> _cache = new();

    private const string SystemPrompt = """
        Sen CrewOps AI Takım Orkestratörü'nün PM (Product Manager) agent'ısın.

        ## Görevin
        - Kullanıcının talebini anla, netleştir, yapılandır
        - Projeyi planla, görevlere böl
        - Her görev için uygun rolü belirle
        - Riskleri ve bağımlılıkları tanımla
        - Kullanıcıya Türkçe cevap ver
        - Kullanıcının belirttiği şehir/lokasyonu görev açıklamalarına MUTLAKA yaz
        - "Sen karar ver" derse makul kriterler belirle: min 4.0 puan, min 100 yorum gibi

        ## Çalışma Tarzın
        - Kısa, net ve profesyonel ol
        - İlk mesajda projeyi anla, sorular sor
        - Yeterli bilgi topladığında plan öner
        - Planı kullanıcı onayladığında görevleri oluştur
        - İLK YANITINDA projeye kısa ve açıklayıcı bir ad öner. Formatı şu şekilde olmalı:
          [PROJE_ADI: Önerilen Proje Adı]
          Örnek: [PROJE_ADI: İstanbul Güzellik Salonu Hedef Liste]

        ## Kullanılabilir Roller
        - pm: Product Manager
        - architect: Yazılım Mimarı
        - backend: Backend Engineer
        - frontend: Frontend Engineer
        - sql: SQL Engineer
        - qa: QA Engineer
        - devops: DevOps Engineer
        - content-strategist: İçerik Stratejisti
        - copywriter: Metin Yazarı
        - seo-specialist: SEO Uzmanı
        - seo-analyst: SEO Analisti
        - data-analyst: Veri Analisti
        - research-agent: Araştırma Ajanı

        ## Yanıt Formatı
        Normal sohbette düz metin kullan.
        Plan önerirken şu formatı kullan:

        ### Proje Planı: [Proje Adı]
        **Domain:** [software/marketing/seo/analytics]
        **Tahmini Süre:** [süre]

        **Görevler:**
        1. [Görev başlığı] → Rol: [rol-id] | Karmaşıklık: [Operational/Complex/Critical]
        2. [Görev başlığı] → Rol: [rol-id] | Karmaşıklık: [Operational/Complex/Critical]
        ...

        Bu planı onaylıyor musunuz?
        """;

    public PmAgentService(LlmClient llm, IDbContextFactory<CrewOpsDbContext> dbFactory, ILogger<PmAgentService> logger)
    {
        _llm = llm;
        _dbFactory = dbFactory;
        _logger = logger;
    }

    /// <summary>Aktif LLM provider adını döner.</summary>
    public string ActiveProvider => _llm.GetActiveProvider();

    /// <summary>PM agent'a mesaj gönderir, yanıt döner. Hem cache'e hem DB'ye yazar.</summary>
    public async Task<string> ChatAsync(Guid projectId, string userMessage, CancellationToken ct = default)
    {
        var history = await GetOrLoadHistoryAsync(projectId, ct);

        // Kullanıcı mesajını ekle
        history.Add(new ChatMessage("user", userMessage));
        await SaveMessageToDbAsync(projectId, "user", userMessage, history.Count - 1, ct);

        try
        {
            var response = await _llm.SendMessageAsync(SystemPrompt, history, ct: ct);

            // PM yanıtını ekle
            history.Add(new ChatMessage("assistant", response));
            await SaveMessageToDbAsync(projectId, "assistant", response, history.Count - 1, ct);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PM Agent yanıt üretemedi: ProjectId={ProjectId}", projectId);
            throw;
        }
    }

    /// <summary>Proje için conversation history döner (cache + DB).</summary>
    public IReadOnlyList<ChatMessage> GetHistory(Guid projectId)
    {
        if (_cache.TryGetValue(projectId, out var cached))
            return cached.AsReadOnly();
        return [];
    }

    /// <summary>Cache'i DB'den yükler (yoksa boş başlatır).</summary>
    private async Task<List<ChatMessage>> GetOrLoadHistoryAsync(Guid projectId, CancellationToken ct)
    {
        if (_cache.TryGetValue(projectId, out var cached))
            return cached;

        // DB'den yükle
        await using var db = await _dbFactory.CreateDbContextAsync(ct);
        var dbMessages = await db.ChatMessages
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.Sequence)
            .ToListAsync(ct);

        var history = dbMessages
            .Select(m => new ChatMessage(m.Role, m.Content))
            .ToList();

        _cache[projectId] = history;
        _logger.LogInformation("Chat history yüklendi: {ProjectId}, {Count} mesaj", projectId, history.Count);
        return history;
    }

    /// <summary>Mesajı DB'ye kaydeder.</summary>
    private async Task SaveMessageToDbAsync(Guid projectId, string role, string content, int sequence, CancellationToken ct)
    {
        try
        {
            await using var db = await _dbFactory.CreateDbContextAsync(ct);
            var entity = ChatMessageEntity.Create(projectId, role, content, sequence);
            db.ChatMessages.Add(entity);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chat mesajı DB'ye kaydedilemedi");
        }
    }
}
