namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir ExecutionRun'ın yaşam döngüsündeki anlık durumunu temsil eder.
/// </summary>
public enum ExecutionStatus
{
    /// <summary>Run kaydı oluşturuldu; henüz kuyruğa alınmadı.</summary>
    Created,

    /// <summary>Worker kuyruğuna alındı; workspace hazırlanıyor.</summary>
    Queued,

    /// <summary>Çalışma dizini hazırlandı; worker başlatılmaya hazır.</summary>
    WorkspacePrepared,

    /// <summary>Worker aktif olarak çalışıyor.</summary>
    Running,

    /// <summary>Worker tamamlandı; artifact'lar toplanıyor.</summary>
    CollectingArtifacts,

    /// <summary>Ham çıktı normalleştiriliyor (5-bölüm sözleşme ayrıştırması).</summary>
    Normalizing,

    /// <summary>Normalleştirilmiş çıktı PM review'a gönderildi.</summary>
    Reviewing,

    /// <summary>Run başarıyla tamamlandı ve onaylandı.</summary>
    Completed,

    /// <summary>Run başarısız oldu; hata kaydedildi.</summary>
    Failed,

    /// <summary>Run belirlenen sürede tamamlanamadı.</summary>
    TimedOut
}
