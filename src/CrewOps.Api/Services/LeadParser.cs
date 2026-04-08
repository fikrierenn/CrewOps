using System.Text.Json;
using System.Text.RegularExpressions;
using CrewOps.Domain.Entities;

namespace CrewOps.Api.Services;

/// <summary>
/// Agent çıktısından Lead (potansiyel müşteri) bilgilerini parse eder.
/// JSON array veya tablo formatını destekler.
/// </summary>
public static class LeadParser
{
    /// <summary>
    /// Agent çıktısındaki salon/işletme bilgilerini Lead entity'lerine dönüştürür.
    /// </summary>
    public static List<Lead> ParseLeads(Guid projectId, string agentOutput)
    {
        // Önce JSON array dene
        var leads = TryParseJson(projectId, agentOutput);
        if (leads.Count > 0) return leads;

        // JSON bulamadıysa tablo formatından parse et
        leads = TryParseTable(projectId, agentOutput);
        return leads;
    }

    private static List<Lead> TryParseJson(Guid projectId, string text)
    {
        var leads = new List<Lead>();

        // Code block varsa strip et: ```json ... ```
        var cleaned = Regex.Replace(text, @"```(?:json)?\s*", "");

        // JSON array blokları bul — [ ile başlayıp "ad" içeren her blok
        var jsonBlocks = ExtractJsonBlocks(cleaned);
        if (jsonBlocks.Count == 0) return leads;

        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var seenNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var jsonBlock in jsonBlocks)
        {
            try
            {
                // Kesilmiş JSON'u düzeltmeye çalış
                var jsonText = FixTruncatedJson(jsonBlock);

                var items = JsonSerializer.Deserialize<List<LeadDto>>(jsonText, options);
                if (items is null) continue;

                foreach (var item in items)
                {
                    if (string.IsNullOrWhiteSpace(item.Ad)) continue;
                    if (!seenNames.Add(item.Ad)) continue; // Duplicate skip

                    leads.Add(Lead.Create(
                        projectId,
                        item.Ad,
                        item.Adres,
                        item.Ilce,
                        item.Telefon,
                        item.Puan,
                        item.YorumSayisi,
                        item.SiteUrl,
                        item.SiteDurumu));
                }
            }
            catch { /* Bu JSON bloğu parse edilemedi — sonrakine geç */ }
        }

        return leads;
    }

    /// <summary>Metinden tüm JSON array bloklarını çıkarır — bracket counting ile.</summary>
    private static List<string> ExtractJsonBlocks(string text)
    {
        var blocks = new List<string>();
        var i = 0;
        while (i < text.Length)
        {
            // [ ile başlayan ve "ad" içeren blok ara
            var start = text.IndexOf('[', i);
            if (start < 0) break;

            // Bu blokta "ad" var mı kontrol et (ilk 500 karakter içinde)
            var preview = text.Substring(start, Math.Min(500, text.Length - start));
            if (!preview.Contains("\"ad\""))
            {
                i = start + 1;
                continue;
            }

            // Bracket counting ile bloğun sonunu bul
            var depth = 0;
            var end = start;
            for (var j = start; j < text.Length; j++)
            {
                if (text[j] == '[') depth++;
                else if (text[j] == ']') depth--;
                if (depth == 0)
                {
                    end = j + 1;
                    break;
                }
            }

            // Depth 0'a ulaşamadıysa — kesilmiş JSON
            if (depth > 0)
                end = text.Length;

            var block = text[start..end];
            if (block.Contains("\"ad\""))
                blocks.Add(block);

            i = end;
        }

        return blocks;
    }

    /// <summary>Kesilmiş JSON'u düzeltmeye çalışır (token limiti yüzünden kesilmiş olabilir).</summary>
    private static string FixTruncatedJson(string json)
    {
        var trimmed = json.TrimEnd();

        // Zaten geçerli mi?
        if (trimmed.EndsWith(']')) return trimmed;

        // Son tamamlanmamış object'i kaldır
        var lastCompleteObj = trimmed.LastIndexOf('}');
        if (lastCompleteObj > 0)
        {
            return trimmed[..(lastCompleteObj + 1)] + "]";
        }

        return json;
    }

    private static List<Lead> TryParseTable(Guid projectId, string text)
    {
        var leads = new List<Lead>();
        var lines = text.Split('\n');

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            // Tablo satırı: | 1. Salon Adı | Adres | ... |
            if (!trimmed.StartsWith('|') || trimmed.Contains("---") || trimmed.Contains("Ad ") && trimmed.Contains("Adres"))
                continue;

            var cells = trimmed.Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Select(c => c.Trim()).ToArray();

            if (cells.Length < 3) continue;

            // İlk hücre: "1. Salon Adı" veya "Salon Adı"
            var name = Regex.Replace(cells[0], @"^\d+\.\s*", "").Trim();
            if (string.IsNullOrWhiteSpace(name) || name.Length < 3) continue;

            var address = cells.Length > 1 ? cells[1] : null;
            var phone = cells.Length > 2 ? cells[2] : null;

            decimal? rating = null;
            int? reviewCount = null;
            string? siteStatus = null;

            // Puan ve yorum sayısı bul
            foreach (var cell in cells.Skip(3))
            {
                if (decimal.TryParse(cell.Replace(",", "."), System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var r) && r is >= 1 and <= 5)
                    rating = r;
                else if (int.TryParse(Regex.Replace(cell, @"[^\d]", ""), out var rc) && rc > 10)
                    reviewCount = rc;
                else if (cell.Contains("yok", StringComparison.OrdinalIgnoreCase) ||
                         cell.Contains("kötü", StringComparison.OrdinalIgnoreCase))
                    siteStatus = cell;
            }

            leads.Add(Lead.Create(projectId, name, address, null, phone, rating, reviewCount, null, siteStatus ?? "yok"));
        }

        return leads;
    }

    private sealed class LeadDto
    {
        public string? Ad { get; set; }
        public string? Adres { get; set; }
        public string? Ilce { get; set; }
        public string? Telefon { get; set; }
        public decimal? Puan { get; set; }
        public int? YorumSayisi { get; set; }
        public string? SiteDurumu { get; set; }
        public string? SiteUrl { get; set; }
    }
}
