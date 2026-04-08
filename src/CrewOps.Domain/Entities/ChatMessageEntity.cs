namespace CrewOps.Domain.Entities;

/// <summary>
/// PM Chat konuşma mesajı — DB'de kalıcı olarak saklanır.
/// Uygulama restart olsa bile konuşma geçmişi korunur.
/// </summary>
public sealed class ChatMessageEntity
{
    public Guid Id { get; private set; }
    public Guid ProjectId { get; private set; }

    /// <summary>"user" veya "assistant"</summary>
    public string Role { get; private set; } = string.Empty;

    /// <summary>Mesaj içeriği.</summary>
    public string Content { get; private set; } = string.Empty;

    /// <summary>Mesaj sırası (0-based).</summary>
    public int Sequence { get; private set; }

    public DateTime CreatedAt { get; private set; }

    private ChatMessageEntity() { }

    public static ChatMessageEntity Create(Guid projectId, string role, string content, int sequence)
    {
        return new ChatMessageEntity
        {
            Id = Guid.NewGuid(),
            ProjectId = projectId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = DateTime.UtcNow
        };
    }
}
