namespace CrewOps.Domain.ValueObjects;

/// <summary>
/// Bir görevin yaşam döngüsündeki anlık durumunu temsil eder.
/// </summary>
public enum TaskStatus
{
    /// <summary>Görev oluşturuldu; bağımlılıkları tamamlanmamış.</summary>
    Pending,

    /// <summary>Bağımlılıkları tamamlandı; yürütme kuyruğuna alındı.</summary>
    Queued,

    /// <summary>ExecutionRun aktif olarak çalışıyor.</summary>
    InProgress,

    /// <summary>Yürütme tamamlandı; PM review bekliyor.</summary>
    AwaitingReview,

    /// <summary>Review onaylandı; görev başarılı sayıldı.</summary>
    Approved,

    /// <summary>Review, revize istedi; görev tekrar Pending'e döner.</summary>
    Revised,

    /// <summary>Review, eskalasyon kararı verdi; insan müdahalesi gerekiyor.</summary>
    Escalated,

    /// <summary>Görev başarıyla tamamlandı ve kabul edildi.</summary>
    Completed,

    /// <summary>Tüm denemeler başarısız oldu; orchestration bloğu var.</summary>
    Failed,

    /// <summary>Görev bilinçli olarak atlandı (kapsam dışı veya iptal).</summary>
    Skipped
}
