using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CrewOps.Api.Services;

/// <summary>
/// Çoklu LLM provider desteği — Claude, OpenAI, Gemini, Groq.
/// appsettings.json'daki "Llm:ProviderChain" veya .env'deki API key'lere göre otomatik seçim.
/// Sırayla dener: birisi başarısız olursa sonrakine geçer (fallback chain).
/// </summary>
public sealed class LlmClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<LlmClient> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public LlmClient(HttpClient http, IConfiguration config, ILogger<LlmClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Akıllı provider seçimi ile mesaj gönderir.
    /// Web search gerekiyorsa Gemini öncelikli, yoksa Groq öncelikli.
    /// İlk başarılı yanıtı döner. Hepsi başarısız olursa son hatayı fırlatır.
    /// </summary>
    public async Task<string> SendMessageAsync(
        string systemPrompt,
        List<ChatMessage> messages,
        int maxTokens = 4096,
        bool useWebSearch = false,
        CancellationToken ct = default)
    {
        var providers = useWebSearch
            ? GetWebSearchChain()   // Web search → Gemini önce (Google Search Grounding)
            : GetContentChain();    // İçerik üretimi → Groq önce (hızlı, sınırsız token)
        Exception? lastError = null;

        foreach (var provider in providers)
        {
            try
            {
                _logger.LogInformation("LLM çağrısı: {Provider}, WebSearch: {WebSearch}", provider, useWebSearch);
                return provider switch
                {
                    "claude" => await CallClaudeAsync(systemPrompt, messages, maxTokens, ct),
                    "openai" => await CallOpenAiAsync(systemPrompt, messages, maxTokens, ct),
                    "gemini" => await CallGeminiAsync(systemPrompt, messages, maxTokens, useWebSearch, ct),
                    "groq" => await CallGroqAsync(systemPrompt, messages, maxTokens, ct),
                    _ => throw new InvalidOperationException($"Bilinmeyen provider: {provider}")
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{Provider} başarısız, sonraki deneniyor...", provider);
                lastError = ex;
            }
        }

        throw lastError ?? new InvalidOperationException("Hiçbir LLM provider yapılandırılmamış.");
    }

    /// <summary>Aktif provider adını döner (UI'da göstermek için).</summary>
    public string GetActiveProvider() => GetContentChain().FirstOrDefault() ?? "none";

    /// <summary>Web search gereken görevler için chain: Gemini önce (Google Search Grounding).</summary>
    private List<string> GetWebSearchChain()
    {
        var chain = new List<string>();
        if (!string.IsNullOrWhiteSpace(_config["Gemini:ApiKey"])) chain.Add("gemini");
        if (!string.IsNullOrWhiteSpace(_config["Anthropic:ApiKey"])) chain.Add("claude");
        // Groq ve OpenAI web search desteklemiyor, fallback olarak eklenebilir
        if (!string.IsNullOrWhiteSpace(_config["Groq:ApiKey"])) chain.Add("groq");
        if (!string.IsNullOrWhiteSpace(_config["OpenAI:ApiKey"])) chain.Add("openai");
        return chain;
    }

    /// <summary>İçerik üretimi için chain: Groq önce (hızlı, büyük context).</summary>
    private List<string> GetContentChain()
    {
        // Manuel yapılandırma varsa onu kullan
        var configured = _config["Llm:ProviderChain"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(p => p.ToLowerInvariant()).ToList();
        }

        // Yoksa: Groq → Gemini → Claude → OpenAI
        var chain = new List<string>();
        if (!string.IsNullOrWhiteSpace(_config["Groq:ApiKey"])) chain.Add("groq");
        if (!string.IsNullOrWhiteSpace(_config["Gemini:ApiKey"])) chain.Add("gemini");
        if (!string.IsNullOrWhiteSpace(_config["Anthropic:ApiKey"])) chain.Add("claude");
        if (!string.IsNullOrWhiteSpace(_config["OpenAI:ApiKey"])) chain.Add("openai");
        return chain;
    }

    // ─── Claude (Anthropic) ──────────────────────────────────

    private async Task<string> CallClaudeAsync(string systemPrompt, List<ChatMessage> messages, int maxTokens, CancellationToken ct)
    {
        var apiKey = _config["Anthropic:ApiKey"] ?? throw new InvalidOperationException("Anthropic:ApiKey eksik");
        var model = _config["Anthropic:Model"] ?? "claude-sonnet-4-20250514";

        var request = new
        {
            model,
            max_tokens = maxTokens,
            system = systemPrompt,
            messages = messages.Select(m => new { role = m.Role, content = m.Content }).ToArray()
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        req.Content = new StringContent(JsonSerializer.Serialize(request, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower }), Encoding.UTF8, "application/json");
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");

        var response = await _http.SendAsync(req, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Claude: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("content").EnumerateArray()
            .First(c => c.GetProperty("type").GetString() == "text")
            .GetProperty("text").GetString() ?? string.Empty;
    }

    // ─── OpenAI ──────────────────────────────────────────────

    private async Task<string> CallOpenAiAsync(string systemPrompt, List<ChatMessage> messages, int maxTokens, CancellationToken ct)
    {
        var apiKey = _config["OpenAI:ApiKey"] ?? throw new InvalidOperationException("OpenAI:ApiKey eksik");
        var model = _config["OpenAI:Model"] ?? "gpt-4o-mini";

        var allMessages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };
        allMessages.AddRange(messages.Select(m => (object)new { role = m.Role, content = m.Content }));

        var request = new
        {
            model,
            max_tokens = maxTokens,
            messages = allMessages
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");
        req.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await _http.SendAsync(req, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"OpenAI: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("choices")[0]
            .GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }

    // ─── Groq (OpenAI uyumlu API — Llama, Mixtral, Gemma) ────

    private async Task<string> CallGroqAsync(string systemPrompt, List<ChatMessage> messages, int maxTokens, CancellationToken ct)
    {
        var apiKey = _config["Groq:ApiKey"] ?? throw new InvalidOperationException("Groq:ApiKey eksik");
        var model = _config["Groq:Model"] ?? "llama-3.3-70b-versatile";

        var allMessages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };
        allMessages.AddRange(messages.Select(m => (object)new { role = m.Role, content = m.Content }));

        var request = new
        {
            model,
            max_tokens = maxTokens,
            messages = allMessages
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        req.Content = new StringContent(JsonSerializer.Serialize(request, JsonOpts), Encoding.UTF8, "application/json");
        req.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await _http.SendAsync(req, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Groq: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("choices")[0]
            .GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }

    // ─── Gemini (Google) ─────────────────────────────────────

    private async Task<string> CallGeminiAsync(string systemPrompt, List<ChatMessage> messages, int maxTokens, bool useWebSearch, CancellationToken ct)
    {
        var apiKey = _config["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini:ApiKey eksik");
        var model = _config["Gemini:Model"] ?? "gemini-2.5-flash";

        var contents = new List<object>();

        // System prompt'u ilk user mesajına ekle
        var firstUserMsg = true;
        foreach (var msg in messages)
        {
            var role = msg.Role == "assistant" ? "model" : "user";
            var text = firstUserMsg && role == "user"
                ? $"[System: {systemPrompt}]\n\n{msg.Content}"
                : msg.Content;

            if (firstUserMsg && role == "user") firstUserMsg = false;

            contents.Add(new { role, parts = new[] { new { text } } });
        }

        if (firstUserMsg)
        {
            contents.Add(new { role = "user", parts = new[] { new { text = systemPrompt } } });
        }

        // Request body — Google Search Grounding opsiyonel
        var requestDict = new Dictionary<string, object>
        {
            ["contents"] = contents,
            ["generationConfig"] = new { maxOutputTokens = maxTokens }
        };

        // Google Search + Maps Grounding aktifse tools ekle
        if (useWebSearch)
        {
            requestDict["tools"] = new object[]
            {
                new { google_search = new { } },
                new { google_maps = new { } }
            };
        }

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Content = new StringContent(JsonSerializer.Serialize(requestDict, JsonOpts), Encoding.UTF8, "application/json");

        var response = await _http.SendAsync(req, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Gemini: {response.StatusCode} - {body}");

        using var doc = JsonDocument.Parse(body);
        var candidate = doc.RootElement.GetProperty("candidates")[0];

        // Tüm text part'ları birleştir
        var parts = candidate.GetProperty("content").GetProperty("parts");
        var textParts = new List<string>();
        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var textProp))
                textParts.Add(textProp.GetString() ?? "");
        }

        return string.Join("\n", textParts);
    }
}

public sealed record ChatMessage(string Role, string Content);
