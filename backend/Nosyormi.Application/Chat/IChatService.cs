namespace Nosyormi.Application.Chat;

public record ChatMessage(string Role, string Content);

public record ChartUpdate(
    string Type,
    string? Category,
    string[]? HighlightTransactionIds);

public record ChatResponse(string Answer, ChartUpdate? ChartUpdate);

public interface IChatService
{
    Task<ChatResponse> ChatAsync(
        Guid statementId,
        string userMessage,
        IReadOnlyList<ChatMessage> conversationHistory,
        CancellationToken cancellationToken = default);
}
