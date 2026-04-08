namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir görevin veya takımın varsayılan çıktı formatını belirler.
/// Output contract profili bu enum'a göre beklenen section'ları seçer.
/// </summary>
public enum OutputType
{
    /// <summary>
    /// Yazılım geliştirme çıktısı: unified diff formatında PATCH section'ı içerir.
    /// Çıktı: SUMMARY | FILES_CHANGED | PATCH | NEXT | RISKS
    /// </summary>
    CodePatch,

    /// <summary>
    /// Doküman/içerik çıktısı: tam metin CONTENT section'ı içerir.
    /// Çıktı: SUMMARY | DELIVERABLES | CONTENT | NEXT | RISKS
    /// Kullanım: pazarlama, blog yazarlığı, içerik üretimi.
    /// </summary>
    Document,

    /// <summary>
    /// Analiz çıktısı: yapılandırılmış analiz CONTENT section'ı içerir.
    /// Kullanım: iş analizi, finansal modelleme, pazar araştırması.
    /// </summary>
    Analysis,

    /// <summary>
    /// Plan/strateji çıktısı: plan formatında CONTENT section'ı içerir.
    /// Kullanım: stratejik planlama, yol haritası, mimari tasarım.
    /// </summary>
    Plan
}
