using System.Text.RegularExpressions;

namespace CrewOps.Api.Services;

public static class MarkdownHelper
{
    private static readonly Regex PathRegex = new(
        @"(/project/[a-f0-9\-]+(?:/\w+)?)",
        RegexOptions.IgnoreCase);

    /// <summary>
    /// HTML içindeki /project/xxx/yyy yollarını tıklanabilir linklere dönüştürür.
    /// </summary>
    public static string MakeLinksClickable(string html)
    {
        return PathRegex.Replace(html, match =>
        {
            var path = match.Groups[1].Value;
            return $"<a href='{path}' class='chat-link'>{path}</a>";
        });
    }
}
