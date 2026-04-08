using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;
using TaskStatus = CrewOps.Domain.ValueObjects.TaskStatus;

namespace CrewOps.Domain.Aggregates;

/// <summary>
/// Orchestration loop tarafından yürütülecek bir iş birimini temsil eder.
/// DAG bağımlılık modeli: bir görev, tüm bağımlılıkları tamamlanmadan
/// <see cref="TaskStatus.Queued"/> durumuna geçemez.
/// </summary>
public sealed class CrewOpsTask
{
    private readonly List<IDomainEvent> _domainEvents = [];
    private readonly List<Guid> _dependencyIds = [];

    // ---------------------------------------------------------------------------
    // Kimlik ve temel özellikler
    // ---------------------------------------------------------------------------

    public Guid Id { get; private set; }
    public Guid ProjectId { get; private set; }

    /// <summary>Kısa başlık (örn. "API endpoint'leri yaz").</summary>
    public string Title { get; private set; } = string.Empty;

    /// <summary>Detaylı görev açıklaması — worker'a gönderilecek prompt'un temelidir.</summary>
    public string Description { get; private set; } = string.Empty;

    /// <summary>Hangi rolün bu görevi üstleneceği (örn. "backend-developer").</summary>
    public string RoleId { get; private set; } = string.Empty;

    /// <summary>Karmaşıklık ipucu — model seçimini belirler.</summary>
    public ModelTier ComplexityHint { get; private set; }

    /// <summary>
    /// Görevin hangi domain'e ait olduğu ipucu — output contract seçimi için kullanılır.
    /// Null ise projenin domain'i kullanılır.
    /// </summary>
    public string? DomainHint { get; private set; }

    // ---------------------------------------------------------------------------
    // Durum
    // ---------------------------------------------------------------------------

    public TaskStatus Status { get; private set; }

    /// <summary>Kaç kez yeniden denendi.</summary>
    public int RetryCount { get; private set; }

    // ---------------------------------------------------------------------------
    // DAG bağımlılıkları
    // ---------------------------------------------------------------------------

    /// <summary>Bu görevin başlayabilmesi için tamamlanmış olması gereken görev ID'leri.</summary>
    public IReadOnlyList<Guid> DependencyIds => _dependencyIds.AsReadOnly();

    // ---------------------------------------------------------------------------
    // Zaman damgaları
    // ---------------------------------------------------------------------------

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // ---------------------------------------------------------------------------
    // Domain events
    // ---------------------------------------------------------------------------

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    // ---------------------------------------------------------------------------
    // EF Core için parametresiz constructor
    // ---------------------------------------------------------------------------

    private CrewOpsTask() { }

    // ---------------------------------------------------------------------------
    // Factory method
    // ---------------------------------------------------------------------------

    public static CrewOpsTask Create(
        Guid projectId,
        string title,
        string description,
        string roleId,
        ModelTier complexityHint,
        IEnumerable<Guid>? dependencyIds = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(title);
        ArgumentException.ThrowIfNullOrWhiteSpace(description);
        ArgumentException.ThrowIfNullOrWhiteSpace(roleId);

        var now = DateTime.UtcNow;
        var task = new CrewOpsTask
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Title = title,
            Description = description,
            RoleId = roleId,
            ComplexityHint = complexityHint,
            Status = TaskStatus.Pending,
            RetryCount = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        if (dependencyIds is not null)
            task._dependencyIds.AddRange(dependencyIds);

        return task;
    }

    // ---------------------------------------------------------------------------
    // Durum geçişleri
    // ---------------------------------------------------------------------------

    /// <summary>Bağımlılıkları tamamlanan görev kuyruğa alınır.</summary>
    public void MarkQueued()
    {
        EnsureStatus(TaskStatus.Pending, "kuyruğa alınabilmesi");
        ChangeStatus(TaskStatus.Queued);
    }

    /// <summary>Worker görevi işlemeye başladığında çağrılır.</summary>
    public void MarkInProgress()
    {
        EnsureStatus(TaskStatus.Queued, "başlatılabilmesi");
        ChangeStatus(TaskStatus.InProgress);
    }

    /// <summary>Worker tamamlandı; PM review bekliyor.</summary>
    public void MarkAwaitingReview()
    {
        EnsureStatus(TaskStatus.InProgress, "review'a gönderilebilmesi");
        ChangeStatus(TaskStatus.AwaitingReview);
    }

    /// <summary>PM review onayladı.</summary>
    public void MarkApproved()
    {
        EnsureStatus(TaskStatus.AwaitingReview, "onaylanabilmesi");
        ChangeStatus(TaskStatus.Approved);
    }

    /// <summary>Review revizyon istedi; görev yeniden Pending'e döner.</summary>
    public void MarkRevised()
    {
        EnsureStatus(TaskStatus.AwaitingReview, "revize edilebilmesi");
        RetryCount++;
        ChangeStatus(TaskStatus.Revised);
    }

    /// <summary>Görev başarıyla tamamlandı ve kabul edildi.</summary>
    public void MarkCompleted()
    {
        if (Status is not TaskStatus.Approved and not TaskStatus.AwaitingReview)
            throw new InvalidOperationException($"Görev tamamlanamaz: mevcut durum '{Status}'.");

        var now = DateTime.UtcNow;
        Status = TaskStatus.Completed;
        UpdatedAt = now;

        _domainEvents.Add(new TaskCompleted(
            ProjectId: ProjectId,
            TaskId: Id,
            RoleId: RoleId,
            OccurredAt: now));
    }

    /// <summary>Review eskalasyon kararı verdi.</summary>
    public void MarkEscalated()
    {
        EnsureStatus(TaskStatus.AwaitingReview, "eskalasyon yapılabilmesi");
        ChangeStatus(TaskStatus.Escalated);
    }

    /// <summary>Tüm denemeler başarısız oldu.</summary>
    public void MarkFailed()
    {
        ChangeStatus(TaskStatus.Failed);
    }

    /// <summary>Görev bilinçli olarak atlandı.</summary>
    public void MarkSkipped()
    {
        ChangeStatus(TaskStatus.Skipped);
    }

    /// <summary>Revised görev yeniden Pending'e döner (retry için).</summary>
    public void ResetToPending()
    {
        EnsureStatus(TaskStatus.Revised, "yeniden Pending'e alınabilmesi");
        ChangeStatus(TaskStatus.Pending);
    }

    public void ClearDomainEvents() => _domainEvents.Clear();

    // ---------------------------------------------------------------------------
    // Yardımcı metodlar
    // ---------------------------------------------------------------------------

    private void EnsureStatus(TaskStatus required, string operationDescription)
    {
        if (Status != required)
            throw new InvalidOperationException(
                $"Görev {Id}: {operationDescription} için durum '{required}' olmalıdır; mevcut: '{Status}'.");
    }

    private void ChangeStatus(TaskStatus newStatus)
    {
        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;
    }
}
