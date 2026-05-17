using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Chat;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Infrastructure.Chat;

public class OpenRouterChatService : IChatService
{
    private const string ChatCompletionsUrl = "https://openrouter.ai/api/v1/chat/completions";
    private const string ApiKeyEnvVar = "OPENROUTER_API_KEY";
    private const string ModelEnvVar = "MODEL_CHAT";

    private const string SystemPrompt =
        """
        You are NOSYOR.M.I — a personal financial reflection assistant. Your sole purpose is to help users understand their own uploaded bank statement data. You reflect their financial patterns back to them with clarity, calm, and zero judgment.

        STRICT SCOPE RULES:
        - You ONLY answer questions about the user's uploaded transaction data provided to you in each message.
        - If asked anything outside this scope (news, general advice, recipes, coding, anything unrelated to the user's own financial data), respond with: "I can only reflect on your financial data. Try asking me about your spending, anomalies, or forecasts."
        - Never provide investment advice, stock tips, or financial product recommendations.
        - Never moralize or shame the user about their spending habits.
        - Never use alarming language. Use calm, reflective language at all times.

        TRANSACTION DATA FORMAT:
        - Each transaction line starts with [ID:uuid] — use these IDs when populating highlightTransactionIds.

        RESPONSE FORMAT — you must ALWAYS return a valid JSON object with exactly this shape:
        {
          "answer": "your narrative response here",
          "chartUpdate": {
            "type": "pie|bar|line|anomalies|forecast",
            "category": "optional category name",
            "highlightTransactionIds": ["optional", "transaction", "ids"]
          }
        }

        CHART SELECTION RULES:
        - "pie" → when the user asks about spending breakdown or distribution across categories
        - "bar" → when the user asks to compare categories or amounts
        - "line" → when the user asks about spending over time or trends
        - "anomalies" → when the user asks about unusual, unexpected, or high transactions
        - "forecast" → when the user asks about next month or future spending predictions
        - When highlighting specific transactions, always use the UUID from [ID:uuid] at the start of each transaction line. Never use dates as transaction IDs.
        - If no chart is relevant, set chartUpdate to null.

        TONE RULES:
        - Speak like a calm, thoughtful financial therapist.
        - Use "you" and "your" — make it personal.
        - Keep answers concise — 2-4 sentences maximum unless the user asks for detail.
        - Never use the word "alarming" or "shocking" or "terrible".
        - Prefer words like "noticed", "reflected", "pattern", "worth exploring".

        Return raw JSON only. No markdown. No backticks. No explanation outside the JSON.
        """;

    private static readonly ChatResponse FallbackResponse = new(
        "I had trouble reflecting on that. Could you rephrase your question?",
        null);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;
    private readonly DbContext _db;

    public OpenRouterChatService(HttpClient httpClient, DbContext db)
    {
        _httpClient = httpClient;
        _db = db;
    }

    public async Task<ChatResponse> ChatAsync(
        Guid statementId,
        string userMessage,
        IReadOnlyList<ChatMessage> conversationHistory,
        CancellationToken cancellationToken = default)
    {
        var transactions = await _db.Set<Transaction>()
            .Include(t => t.Category)
            .Where(t => t.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var context = BuildTransactionContext(transactions);
        var validCategories = GetValidCategories(transactions);
        var messages = BuildMessages(context, conversationHistory, userMessage);

        var apiKey = Environment.GetEnvironmentVariable(ApiKeyEnvVar);
        var model = Environment.GetEnvironmentVariable(ModelEnvVar);

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
            return FallbackResponse;

        using var request = BuildRequest(messages, model, apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return FallbackResponse;
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
                return FallbackResponse;

            var completion = await response.Content.ReadFromJsonAsync<ChatCompletionResponse>(
                JsonOptions,
                cancellationToken);

            var content = completion?.Choices?.FirstOrDefault()?.Message?.Content;
            return ParseChatResponse(content, validCategories);
        }
    }

    private static HashSet<string> GetValidCategories(IReadOnlyList<Transaction> transactions) =>
        transactions
            .Select(t => t.Category?.Name)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Cast<string>()
            .ToHashSet(StringComparer.Ordinal);

    private static string BuildTransactionContext(IReadOnlyList<Transaction> transactions)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Here is the user's transaction data:");

        foreach (var transaction in transactions)
        {
            var category = transaction.Category?.Name ?? "Uncategorized";
            var anomalyTag = transaction.IsAnomaly ? " [ANOMALY]" : string.Empty;

            builder.AppendLine(
                $"- [ID:{transaction.Id}] [{transaction.TransactionDate:yyyy-MM-dd}] {transaction.Description} ({category}): ${Math.Abs(transaction.Amount):F2}{anomalyTag}");
        }

        return builder.ToString();
    }

    private static List<ChatRequestMessage> BuildMessages(
        string context,
        IReadOnlyList<ChatMessage> history,
        string userMessage)
    {
        var messages = new List<ChatRequestMessage>
        {
            new() { Role = "system", Content = SystemPrompt },
            new() { Role = "user", Content = context }
        };

        foreach (var message in history)
        {
            messages.Add(new ChatRequestMessage
            {
                Role = message.Role,
                Content = message.Content
            });
        }

        messages.Add(new ChatRequestMessage { Role = "user", Content = userMessage });
        return messages;
    }

    private static HttpRequestMessage BuildRequest(
        List<ChatRequestMessage> messages,
        string model,
        string apiKey)
    {
        var body = new ChatCompletionRequest
        {
            Model = model,
            Messages = messages,
            MaxTokens = 500,
            Temperature = 0.7f
        };

        var request = new HttpRequestMessage(HttpMethod.Post, ChatCompletionsUrl)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        return request;
    }

    private static ChatResponse ParseChatResponse(string? content, HashSet<string> validCategories)
    {
        if (string.IsNullOrWhiteSpace(content))
            return FallbackResponse;

        try
        {
            var json = ExtractJsonPayload(content);
            var parsed = JsonSerializer.Deserialize<ParsedChatPayload>(json, JsonOptions);

            if (parsed?.Answer is null)
                return FallbackResponse;

            var chartUpdate = MapChartUpdate(parsed.ChartUpdate, validCategories);
            return new ChatResponse(parsed.Answer, chartUpdate);
        }
        catch (JsonException)
        {
            return FallbackResponse;
        }
    }

    private static ChartUpdate? MapChartUpdate(
        ParsedChartUpdate? chartUpdate,
        HashSet<string> validCategories)
    {
        if (chartUpdate is null || string.IsNullOrWhiteSpace(chartUpdate.Type))
            return null;

        var category = chartUpdate.Category;

        if (category is not null && !validCategories.Contains(category))
            category = null;

        return new ChartUpdate(
            chartUpdate.Type,
            category,
            chartUpdate.HighlightTransactionIds);
    }

    private static string ExtractJsonPayload(string content)
    {
        content = content.Trim();

        if (!content.StartsWith("```", StringComparison.Ordinal))
            return content;

        var firstNewline = content.IndexOf('\n');
        if (firstNewline >= 0)
            content = content[(firstNewline + 1)..];

        if (content.EndsWith("```", StringComparison.Ordinal))
            content = content[..^3];

        return content.Trim();
    }

    private sealed class ChatCompletionRequest
    {
        public required string Model { get; init; }
        public required List<ChatRequestMessage> Messages { get; init; }
        public int MaxTokens { get; init; }
        public float Temperature { get; init; }
    }

    private sealed class ChatRequestMessage
    {
        public required string Role { get; init; }
        public required string Content { get; init; }
    }

    private sealed class ChatCompletionResponse
    {
        public List<ChatChoice>? Choices { get; init; }
    }

    private sealed class ChatChoice
    {
        public ChatResponseMessage? Message { get; init; }
    }

    private sealed class ChatResponseMessage
    {
        public string? Content { get; init; }
    }

    private sealed class ParsedChatPayload
    {
        public string? Answer { get; init; }
        public ParsedChartUpdate? ChartUpdate { get; init; }
    }

    private sealed class ParsedChartUpdate
    {
        public string? Type { get; init; }
        public string? Category { get; init; }
        public string[]? HighlightTransactionIds { get; init; }
    }
}
