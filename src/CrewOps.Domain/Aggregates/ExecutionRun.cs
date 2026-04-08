using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Aggregates;

/// <summary>
/// Bir görevin tek bir yürütme denemesini temsil eder.
/// Her retry yeni bir ExecutionRun kaydı oluşturur.
/// Token kullanımı, maliyet ve süre bilgisi bu aggregate üzerinde tutulur.
/// </summary>
public sealed class ExecutionRun
{
    private readonly List<IDomainEvent> _domainEvents = [];

    // ---------------------------------------------------------------------------
    // Kimlik ve ilişkiler
    // ---------------------------------------------------------------------------

    public Guid Id { get; private set; }
    public Guid TaskId { get; private set; }
    public Guid ProjectId { get; private set; }

    /// <summary>Bu run'ı yürüten rolün tanımlayıcısı (örn. "backend-developer").</summary>
    public string RoleId { get; private set; } = string.Empty;

    /// <summary>Kullanılan model seviyesi.</summary>
    public ModelTier ModelTier { get; private set; }

    // ---------------------------------------------------------------------------
    // Durum
    // ---------------------------------------------------------------------------

    /// <summary>Run'ın anlık durumu.</summary>
    public ExecutionStatus Status { get; private set; }

    // ---------------------------------------------------------------------------
    // Çalışma verileri
    // ---------------------------------------------------------------------------

    /// <summary>Worker'ın çalışma dizini (workspace hazırlandığında set edilir).</summary>
    public string? WorkspacePath { get; private set; }

    /// <summary>Worker'ın ham çıktısı (tamamlandığında set edilir).</summary>
    public string? RawOutput { get; private set; }

    /// <summary>Hata mesajı (başarısız olduğunda set edilir).</summary>
    public string? ErrorMessage { get; private set; }

    // ---------------------------------------------------------------------------
    // Metrikler
    // ---------------------------------------------------------------------------

    /// <summary>LLM'e gönderilen token sayısı.</summary>
    public int InputTokens { get; private set; }

    /// <summary>LLM'den alınan token sayısı.</summary>
    public int OutputTokens { get; private set; }

    /// <summary>Bu run'ın toplam maliyeti (USD).</summary>
    public decimal CostUsd { get; private set; }

    /// <summary>Toplam çalışma süresi (milisaniye).</summary>
    public long DurationMs { get; private set; }

    /// <summary>Kaçıncı deneme (1-based).</summary>
    public int AttemptNumber { get; private set; }

    // ---------------------------------------------------------------------------
    // Zaman damgaları
    // ---------------------------------------------------------------------------

    public DateTime CreatedAt { get; private set; }

    /// <summary>Worker'ın fiilen çalışmaya başladığı an (Running state'e geçiş).</summary>
    public DateTime? StartedAt { get; private set; }

    /// <summary>Run'ın sonlandığı an (Completed, Failed veya TimedOut).</summary>
    public DateTime? CompletedAt { get; private set; }

    // ---------------------------------------------------------------------------
    // Domain events
    // ---------------------------------------------------------------------------

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    // ---------------------------------------------------------------------------
    // EF Core için parametresiz constructor
    // ---------------------------------------------------------------------------

    private ExecutionRun() { }

    // ---------------------------------------------------------------------------
    // Factory method
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Yeni bir yürütme kaydı oluşturur. Başlangıç durumu <see cref="ExecutionStatus.Created"/>.
    /// </summary>
    public static ExecutionRun Create(
        Guid taskId,
        Guid projectId,
        string roleId,
        ModelTier modelTier,
        int attemptNumber)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(roleId);

        if (attemptNumber < 1)
            throw new ArgumentOutOfRangeException(nameof(attemptNumber), "Deneme numarası 1'den küçük olamaz.");

        var now = DateTime.UtcNow;
        return new ExecutionRun
        {
            Id = Guid.NewGuid(),
            TaskId = taskId,
            ProjectId = projectId,
            RoleId = roleId,
            ModelTier = modelTier,
            Status = ExecutionStatus.Created,
            AttemptNumber = attemptNumber,
            CreatedAt = now
        };
    }

    // ---------------------------------------------------------------------------
    // Durum geçişleri
    // ---------------------------------------------------------------------------

    /// <summary>Worker kuyruğuna alındı.</summary>
    public void MarkQueued()
    {
        EnsureStatus(ExecutionStatus.Created, "kuyruğa alınabilmesi");
        Status = ExecutionStatus.Queued;
    }

    /// <summary>Çalışma dizini hazırlandı.</summary>
    public void MarkWorkspacePrepared(string workspacePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workspacePath);
        EnsureStatus(ExecutionStatus.Queued, "workspace hazırlanabilmesi");
        WorkspacePath = workspacePath;
        Status = ExecutionStatus.WorkspacePrepared;
    }

    /// <summary>Worker çalışmaya başladı.</summary>
    public void MarkRunning()
    {
        EnsureStatus(ExecutionStatus.WorkspacePrepared, "çalıştırılabilmesi");
        Status = ExecutionStatus.Running;
        StartedAt = DateTime.UtcNow;

        _domainEvents.Add(new ExecutionRunStarted(
            ProjectId: ProjectId,
            TaskId: TaskId,
            RunId: Id,
            RoleId: RoleId,
            OccurredAt: StartedAt.Value));
    }

    /// <summary>Worker tamamlandı, artifact'lar toplanıyor.</summary>
    public void MarkCollectingArtifacts()
    {
        EnsureStatus(ExecutionStatus.Running, "artifact toplanabilmesi");
        Status = ExecutionStatus.CollectingArtifacts;
    }

    /// <summary>Ham çıktı normalleştiriliyor.</summary>
    public void MarkNormalizing()
    {
        EnsureStatus(ExecutionStatus.CollectingArtifacts, "normalleştirilebilmesi");
        Status = ExecutionStatus.Normalizing;
    }

    /// <summary>Normalleştirilmiş çıktı review'a gönderildi.</summary>
    public void MarkReviewing()
    {
        EnsureStatus(ExecutionStatus.Normalizing, "review'a gönderilebilmesi");
        Status = ExecutionStatus.Reviewing;
    }

    /// <summary>Run başarıyla tamamlandı.</summary>
    public void MarkCompleted(
        string rawOutput,
        int inputTokens,
        int outputTokens,
        decimal costUsd,
        long durationMs)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawOutput);
        EnsureStatus(ExecutionStatus.Reviewing, "tamamlanabilmesi");

        Status = ExecutionStatus.Completed;
        RawOutput = rawOutput;
        InputTokens = inputTokens;
        OutputTokens = outputTokens;
        CostUsd = costUsd;
        DurationMs = durationMs;
        CompletedAt = DateTime.UtcNow;

        _domainEvents.Add(new ExecutionRunCompleted(
            ProjectId: ProjectId,
            TaskId: TaskId,
            RunId: Id,
            Success: true,
            CostUsd: costUsd,
            OccurredAt: CompletedAt.Value));
    }

    /// <summary>Run başarısız oldu.</summary>
    public void MarkFailed(string errorMessage)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(errorMessage);
        EnsureNotTerminal("başarısız olarak işaretlenebilmesi");

        Status = ExecutionStatus.Failed;
        ErrorMessage = errorMessage;
        CompletedAt = DateTime.UtcNow;

        _domainEvents.Add(new ExecutionRunCompleted(
            ProjectId: ProjectId,
            TaskId: TaskId,
            RunId: Id,
            Success: false,
            CostUsd: CostUsd,
            OccurredAt: CompletedAt.Value));
    }

    /// <summary>Run zaman aşımına uğradı.</summary>
    public void MarkTimedOut()
    {
        EnsureStatus(ExecutionStatus.Running, "zaman aşımına uğrayabilmesi");

        Status = ExecutionStatus.TimedOut;
        CompletedAt = DateTime.UtcNow;

        _domainEvents.Add(new ExecutionRunCompleted(
            ProjectId: ProjectId,
            TaskId: TaskId,
            RunId: Id,
            Success: false,
            CostUsd: CostUsd,
            OccurredAt: CompletedAt.Value));
    }

    /// <summary>Birikmiş domain event'leri temizler.</summary>
    public void ClearDomainEvents() => _domainEvents.Clear();

    // ---------------------------------------------------------------------------
    // Yardımcı metodlar
    // ---------------------------------------------------------------------------

    private void EnsureStatus(ExecutionStatus required, string operationDescription)
    {
        if (Status != required)
            throw new InvalidOperationException(
                $"ExecutionRun {Id}: {operationDescription} için durum '{required}' olmalıdır; mevcut: '{Status}'.");
    }

    private void EnsureNotTerminal(string operationDescription)
    {
        if (Status is ExecutionStatus.Completed or ExecutionStatus.Failed or ExecutionStatus.TimedOut)
            throw new InvalidOperationException(
                $"ExecutionRun {Id}: {operationDescription} için terminal durumda olmamalıdır; mevcut: '{Status}'.");
    }
}
