using CrewOps.Domain.DomainEvents;
using CrewOps.Domain.ValueObjects;

namespace CrewOps.Domain.Aggregates;

/// <summary>
/// CrewOps'un merkezi aggregate'i. Herhangi bir domain'deki (yazılım, pazarlama, SEO vb.)
/// teslimat projesinin tüm yaşam döngüsünü temsil eder.
/// State geçişleri yalnızca ProjectStateMachine aracılığıyla yapılır.
/// </summary>
public sealed class Project
{
    private readonly List<IDomainEvent> _domainEvents = [];

    // ---------------------------------------------------------------------------
    // Kimlik ve temel özellikler
    // ---------------------------------------------------------------------------

    public Guid Id { get; private set; }

    /// <summary>Projenin görünen adı.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Proje kaynak kod deposunun yerel yolu.
    /// Yazılım dışı projeler (pazarlama, SEO vb.) için null olabilir.
    /// </summary>
    public string? RepoPath { get; private set; }

    /// <summary>
    /// Teknoloji yığını özeti (örn. ".NET 10 / React / SQL Server").
    /// Yazılım dışı projeler için null olabilir.
    /// </summary>
    public string? Stack { get; private set; }

    /// <summary>İnsan kullanıcının ilk talebi — mutabakat bağlamı için korunur.</summary>
    public string InitialRequest { get; private set; } = string.Empty;

    // ---------------------------------------------------------------------------
    // Evrensel orkestratör özellikleri
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Projenin iş alanı tanımlayıcısı (örn. "software", "marketing", "seo").
    /// TeamTemplate seçimi ve output contract belirleme için kullanılır.
    /// </summary>
    public string? Domain { get; private set; }

    /// <summary>Seçilen takım şablonunun referansı.</summary>
    public Guid? TeamTemplateId { get; private set; }

    /// <summary>
    /// Proje bazında yönetişim kuralları. TeamTemplate atandığında kopyalanır.
    /// State machine bu preset'e bakarak geçiş kararı verir — infra'ya bağımlılık yok.
    /// </summary>
    public GovernancePreset? Governance { get; private set; }

    // ---------------------------------------------------------------------------
    // State machine
    // ---------------------------------------------------------------------------

    /// <summary>Projenin anlık durumu. Yalnızca Transition() aracılığıyla değişir.</summary>
    public ProjectState State { get; private set; }

    // ---------------------------------------------------------------------------
    // Mutabakat özeti (agreement onaylandıktan sonra doldurulur)
    // ---------------------------------------------------------------------------

    public string? AgreementSummary { get; private set; }
    public DateTime? AgreementApprovedAt { get; private set; }

    // ---------------------------------------------------------------------------
    // Zaman damgaları
    // ---------------------------------------------------------------------------

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // ---------------------------------------------------------------------------
    // Domain events (transient — kalıcı değil)
    // ---------------------------------------------------------------------------

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    // ---------------------------------------------------------------------------
    // EF Core için parametresiz constructor (private)
    // ---------------------------------------------------------------------------

    private Project() { }

    // ---------------------------------------------------------------------------
    // Factory methods
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Yazılım projesi oluşturur. RepoPath ve Stack zorunludur.
    /// Başlangıç durumu her zaman <see cref="ProjectState.New"/>'dir.
    /// </summary>
    public static Project Create(string name, string repoPath, string stack, string initialRequest)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(repoPath);
        ArgumentException.ThrowIfNullOrWhiteSpace(stack);

        var now = DateTime.UtcNow;
        return new Project
        {
            Id = Guid.NewGuid(),
            Name = name,
            RepoPath = repoPath,
            Stack = stack,
            InitialRequest = initialRequest,
            Domain = "software",
            State = ProjectState.New,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// Herhangi bir domain için evrensel proje oluşturur.
    /// RepoPath ve Stack opsiyoneldir (yazılım dışı projeler için null olabilir).
    /// </summary>
    public static Project CreateUniversal(
        string name,
        string initialRequest,
        string? repoPath = null,
        string? stack = null,
        string? domain = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(initialRequest);

        var now = DateTime.UtcNow;
        return new Project
        {
            Id = Guid.NewGuid(),
            Name = name,
            RepoPath = repoPath,
            Stack = stack,
            InitialRequest = initialRequest,
            Domain = domain,
            State = ProjectState.New,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    // ---------------------------------------------------------------------------
    // State geçişi (yalnızca ProjectStateMachine bu metodu çağırır)
    // ---------------------------------------------------------------------------

    /// <summary>
    /// State'i doğrudan günceller. Bu metot yalnızca <c>ProjectStateMachine</c> tarafından
    /// çağrılmalıdır; doğrulama state machine içinde yapılır.
    /// </summary>
    internal void ApplyTransition(ProjectState newState, string? triggeredBy)
    {
        var fromState = State;
        State = newState;
        UpdatedAt = DateTime.UtcNow;

        _domainEvents.Add(new ProjectStateChanged(
            ProjectId: Id,
            FromState: fromState,
            ToState: newState,
            TriggeredBy: triggeredBy,
            OccurredAt: UpdatedAt));
    }

    // ---------------------------------------------------------------------------
    // Domain davranışları
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Takım şablonunu projeye atar. Governance preset kopyalanır — mevcut projeler
    /// template değişikliklerinden etkilenmez.
    /// </summary>
    public void AssignTeamTemplate(Guid templateId, string templateName, GovernancePreset governance)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(templateName);
        ArgumentNullException.ThrowIfNull(governance);

        TeamTemplateId = templateId;
        Governance = governance;
        UpdatedAt = DateTime.UtcNow;

        _domainEvents.Add(new TeamTemplateAssigned(
            ProjectId: Id,
            TeamTemplateId: templateId,
            TemplateName: templateName,
            OccurredAt: UpdatedAt));
    }

    /// <summary>
    /// Mutabakat onaylandığında özet bilgisini günceller.
    /// </summary>
    public void RecordAgreementApproval(string summary, string approvedBy)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(summary);
        ArgumentException.ThrowIfNullOrWhiteSpace(approvedBy);

        AgreementSummary = summary;
        AgreementApprovedAt = DateTime.UtcNow;
        UpdatedAt = AgreementApprovedAt.Value;

        _domainEvents.Add(new AgreementApproved(
            ProjectId: Id,
            AgreementId: Guid.Empty,
            ApprovedBy: approvedBy,
            OccurredAt: AgreementApprovedAt.Value));
    }

    /// <summary>
    /// Birikmiş domain event'leri temizler (dispatch sonrası çağrılır).
    /// </summary>
    public void ClearDomainEvents() => _domainEvents.Clear();
}
