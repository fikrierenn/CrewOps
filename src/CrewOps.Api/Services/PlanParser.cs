using System.Text.RegularExpressions;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Api.Services;

/// <summary>
/// PM'in markdown formatındaki plan yanıtını parse ederek yapılandırılmış görev listesi çıkarır.
/// </summary>
public static class PlanParser
{
    // Geniş regex — çeşitli PM formatlarını yakalar
    // "1. Görev başlığı → Rol: research-agent | Karmaşıklık: Complex"
    // "1. Görev başlığı - Rol: research-agent | Karmaşıklık: Complex"
    // "1. **Görev başlığı** → Rol: research-agent / data-analyst | Karmaşıklık: Complex"
    // Backtick'li ve backtick'siz rol formatını destekler: Rol: `research-agent` veya Rol: research-agent
    // Greedy (.+) — başlık uzun olabilir (açıklama dahil), son → Rol: 'a kadar alır
    private static readonly Regex TaskPattern = new(
        @"^\d+\.\s+\*{0,2}(.+)\*{0,2}\s*(?:→|->|–)\s*Rol:\s*`?([\w\-]+(?:\s*/\s*[\w\-]+)?)`?\s*\|\s*(?:Karma[sş][ıi]kl[ıi]k|Complexity):\s*(Operational|Complex|Critical)",
        RegexOptions.Multiline | RegexOptions.IgnoreCase);

    private static readonly Regex SimpleTaskPattern = new(
        @"^\d+\.\s+\*{0,2}(.+)\*{0,2}\s*(?:→|->|–)\s*Rol:\s*`?([\w\-]+)`?",
        RegexOptions.Multiline | RegexOptions.IgnoreCase);

    public static bool ContainsPlan(string pmResponse) =>
        pmResponse.Contains("Proje Plan", StringComparison.OrdinalIgnoreCase) &&
        (pmResponse.Contains("Görev", StringComparison.OrdinalIgnoreCase) ||
         pmResponse.Contains("Rol:", StringComparison.OrdinalIgnoreCase));

    public static bool IsApprovalConfirmation(string pmResponse)
    {
        var lower = pmResponse.ToLowerInvariant();
        return lower.Contains("onaylan") ||
               lower.Contains("çalışmaya başla") ||
               lower.Contains("başlıyoruz") ||
               lower.Contains("hemen başla") ||
               lower.Contains("ekibimiz") ||
               lower.Contains("çalışmaya geç") ||
               lower.Contains("plan kabul") ||
               lower.Contains("uygulamaya") ||
               lower.Contains("harekete geç");
    }

    public static List<ParsedTask> ParsePlan(IReadOnlyList<ChatMessage> history)
    {
        // Son plan içeren assistant mesajını bul
        var planMessage = history
            .Where(m => m.Role == "assistant" && ContainsPlan(m.Content))
            .LastOrDefault();

        if (planMessage is null)
            return [];

        return ParseTasks(planMessage.Content);
    }

    public static List<ParsedTask> ParseTasks(string planText)
    {
        // Önce detaylı regex dene
        var tasks = ParseWithRegex(planText, TaskPattern, withComplexity: true);

        // Bulamadıysa basit regex dene
        if (tasks.Count == 0)
            tasks = ParseWithRegex(planText, SimpleTaskPattern, withComplexity: false);

        // Hala bulamadıysa satır bazlı fallback
        if (tasks.Count == 0)
            tasks = FallbackParse(planText);

        return tasks;
    }

    private static List<ParsedTask> ParseWithRegex(string text, Regex pattern, bool withComplexity)
    {
        var tasks = new List<ParsedTask>();
        var matches = pattern.Matches(text);

        foreach (Match match in matches)
        {
            var title = CleanTitle(match.Groups[1].Value);
            var roleId = match.Groups[2].Value.Split('/')[0].Trim();
            var complexity = ModelTier.Complex;

            if (withComplexity && match.Groups.Count > 3)
            {
                complexity = match.Groups[3].Value.Trim().ToLowerInvariant() switch
                {
                    "critical" => ModelTier.Critical,
                    "operational" => ModelTier.Operational,
                    _ => ModelTier.Complex
                };
            }

            tasks.Add(new ParsedTask(title, roleId, complexity));
        }

        return tasks;
    }

    /// <summary>
    /// Blok parse — numaralı görevleri ve altlarındaki Rol/Karmaşıklık bilgilerini yakalar.
    /// PM formatı: "1. Görev başlığı\n* Rol: pm\n* Karmaşıklık: Operational" şeklinde olabilir.
    /// </summary>
    private static List<ParsedTask> FallbackParse(string text)
    {
        var tasks = new List<ParsedTask>();
        var lines = text.Split('\n');

        string? currentTitle = null;
        string? currentRole = null;
        var currentComplexity = ModelTier.Complex;

        for (var i = 0; i < lines.Length; i++)
        {
            var trimmed = lines[i].Trim();

            // Yeni görev başlığı (numaralı satır)
            var titleMatch = Regex.Match(trimmed, @"^\d+\.\s+\*{0,2}(.+?)(?:\*{0,2}\s*$|\*{0,2}\s*(?:→|->|-|–).*)");
            if (titleMatch.Success)
            {
                // Önceki görevi kaydet
                if (currentTitle is not null && currentRole is not null)
                    tasks.Add(new ParsedTask(CleanTitle(currentTitle), currentRole, currentComplexity));

                currentTitle = titleMatch.Groups[1].Value;
                currentRole = null;
                currentComplexity = ModelTier.Complex;

                // Aynı satırda "→ Rol:" varsa yakala
                var inlineRole = Regex.Match(trimmed, @"Rol:\s*`?([\w\-]+)`?", RegexOptions.IgnoreCase);
                if (inlineRole.Success) currentRole = inlineRole.Groups[1].Value.Trim();

                if (trimmed.Contains("Operational", StringComparison.OrdinalIgnoreCase)) currentComplexity = ModelTier.Operational;
                if (trimmed.Contains("Critical", StringComparison.OrdinalIgnoreCase)) currentComplexity = ModelTier.Critical;
                continue;
            }

            // Alt satırlarda Rol: ve Karmaşıklık: ara
            if (currentTitle is not null)
            {
                var roleMatch = Regex.Match(trimmed, @"Rol:\s*`?([\w\-]+)`?", RegexOptions.IgnoreCase);
                if (roleMatch.Success) currentRole = roleMatch.Groups[1].Value.Trim();

                if (trimmed.Contains("Operational", StringComparison.OrdinalIgnoreCase)) currentComplexity = ModelTier.Operational;
                if (trimmed.Contains("Critical", StringComparison.OrdinalIgnoreCase)) currentComplexity = ModelTier.Critical;
            }
        }

        // Son görevi kaydet
        if (currentTitle is not null && currentRole is not null)
            tasks.Add(new ParsedTask(CleanTitle(currentTitle), currentRole, currentComplexity));

        return tasks;
    }

    private static string CleanTitle(string title) =>
        title.Trim().TrimEnd('*').TrimStart('*').Trim();
}

public sealed record ParsedTask(string Title, string RoleId, ModelTier Complexity);
