namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir görevin karmaşıklığına göre hangi LLM model ailesinin kullanılacağını belirtir.
/// Model seçimi otomatiktir; her tier için farklı maliyet/kalite dengesi sağlanır.
/// </summary>
public enum ModelTier
{
    /// <summary>
    /// Rutin, düşük riskli görevler için.
    /// Hedef model: Haiku serisi (hız ve maliyet öncelikli).
    /// Örnek kullanım: dosya düzenleme, kod formatlama, test yazma.
    /// </summary>
    Operational,

    /// <summary>
    /// Orta karmaşıklıktaki görevler için.
    /// Hedef model: Sonnet serisi (denge).
    /// Örnek kullanım: feature implementasyonu, API entegrasyonu, refactoring.
    /// </summary>
    Complex,

    /// <summary>
    /// Yüksek riskli, mimari veya kritik karar gerektiren görevler için.
    /// Hedef model: Opus serisi (kalite öncelikli).
    /// Örnek kullanım: mimari tasarım, güvenlik analizi, kritik bug fix.
    /// </summary>
    Critical
}
