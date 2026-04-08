namespace CrewOps.Api.Services;

/// <summary>
/// PM Agent servisi — kullanıcı ile sohbet eder, proje planlar, görev oluşturur.
/// Her proje için ayrı conversation history tutar.
/// LlmClient üzerinden çoklu provider desteği (Claude, OpenAI, Gemini).
/// </summary>
public sealed class PmAgentService
{
    private readonly LlmClient _llm;
    private readonly ILogger<PmAgentService> _logger;

    // Proje bazlı conversation history (memory'de — MVP için yeterli)
    private readonly Dictionary<Guid, List<ChatMessage>> _conversations = new();

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

    public PmAgentService(LlmClient llm, ILogger<PmAgentService> logger)
    {
        _llm = llm;
        _logger = logger;
    }

    /// <summary>Aktif LLM provider adını döner.</summary>
    public string ActiveProvider => _llm.GetActiveProvider();

    /// <summary>
    /// PM agent'a mesaj gönderir, yanıt döner.
    /// </summary>
    public async Task<string> ChatAsync(Guid projectId, string userMessage, CancellationToken ct = default)
    {
        if (!_conversations.ContainsKey(projectId))
            _conversations[projectId] = new List<ChatMessage>();

        var history = _conversations[projectId];
        history.Add(new ChatMessage("user", userMessage));

        try
        {
            var response = await _llm.SendMessageAsync(SystemPrompt, history, ct: ct);
            history.Add(new ChatMessage("assistant", response));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "PM Agent yanıt üretemedi: ProjectId={ProjectId}", projectId);
            throw;
        }
    }

    /// <summary>
    /// Proje için conversation history döner.
    /// </summary>
    public IReadOnlyList<ChatMessage> GetHistory(Guid projectId) =>
        _conversations.TryGetValue(projectId, out var history)
            ? history.AsReadOnly()
            : [];
}
