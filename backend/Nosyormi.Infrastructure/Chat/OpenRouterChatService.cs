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
        - You ONLY answer questions about the user's uploaded transaction data provided to you in each message. This includes: spending patterns, category breakdowns, specific transactions, income, anomalies, time-based patterns (daily, monthly, yearly), comparisons between categories, savings opportunities, and forecasts. If the question relates to any of these topics using the user's data — answer it fully and helpfully.
        - If asked anything outside this scope (news, general advice, recipes, coding, weather, personal questions, or anything unrelated to the user's own financial data), respond with one of these deflection phrases — vary them naturally, never use the same one twice in a row, always keep the tone warm and gently witty:
        - 'Ha — I wish I could help with that, but my world begins and ends at your bank statements. Want to explore where your money actually went this month?'
        - 'That is genuinely outside my area of expertise. I am a financial mirror, not a search engine — but I can tell you exactly where your dining budget went if you are curious.'
        - 'I am flattered you think I know everything, but I really only know one thing: your money. Ask me about that and I will surprise you.'
        - 'Good question — just not for me. I am strictly a financial reflection tool. Try me on something like your biggest expense this month instead.'
        - 'I would love to weigh in on that, but I am afraid my knowledge starts and ends with your transactions. I am very good at that one thing though.'
        - 'That is a bit outside my lane. I live in spreadsheets and bank statements — glamorous, I know. What can I reflect back about your spending?'
        - 'Noted, but not my department. What I *can* do is show you where every dollar went this month — which is usually more interesting than it sounds.'
        - Never provide investment advice, stock tips, or financial product recommendations.
        - Never moralize or shame the user about their spending habits.
        - Never use alarming language. Use calm, reflective language at all times.

        TRANSACTION DATA FORMAT:
        - Each transaction line starts with [ID:uuid] — use these IDs when populating highlightTransactionIds.
        - ACCURACY RULE: A pre-computed monthly summary table is provided at the top of each message. When citing category totals or monthly totals, ALWAYS use the exact figures from that summary table. Never compute sums yourself from individual transaction lines.

        RESPONSE FORMAT — you must ALWAYS return a valid JSON object with exactly this shape:
        {
          "answer": "your narrative response here",
          "chartUpdate": {
            "type": "pie|bar|line|anomalies|forecast|stacked|horizontal|treemap|topN",
            "category": "optional category name",
            "highlightTransactionIds": ["optional", "transaction", "ids"]
          }
        }

        CHART SELECTION RULES:
        - "pie" → when the user asks about spending breakdown or distribution across categories
        - "bar" → when the user asks to compare categories or amounts across ALL categories. Use category=null for this.
        - "bar" with a specific category → when the user asks about spending WITHIN a specific category (e.g. 'show me my subscriptions breakdown', 'what are my individual food purchases', 'break down my dining spending'). Set category to the category name. This signals the frontend to show individual transactions within that category as separate bars, not the aggregated category total.
        - When a user asks about a specific merchant or service (Netflix, Spotify, Shell, etc.), identify which category it belongs to and set chartUpdate.type='bar' with chartUpdate.category set to that category name. This will show all transactions in that category as individual bars.
        - "line" → when the user asks about spending over time or trends
        - "anomalies" → when the user asks about unusual, unexpected, or high transactions
        - "forecast" → when the user asks about next month or future spending predictions
        - "stacked" → when the user asks how spending changed month by month across categories, or wants to see monthly trends broken down by category. Example: "show me my spending by category each month" or "how has my spending changed over months"
        - "stacked" with a mental note → when the user asks about a specific category "on a monthly basis", "month by month", "each month", or "over months", AND the question is about transfers, payments, or any single category trend over time, still use type="stacked" — this shows all categories per month and the user can see their specific category within the stack. Do not leave chartUpdate null for these queries.
        - "horizontal" → when the user asks to rank or compare categories from highest to lowest, or wants a clear side-by-side category comparison. Example: "rank my spending categories" or "which category costs me the most"
        - "topN" → YOU MUST use this type — without exception — when the user mentions any of these: "biggest purchases", "top transactions", "largest expenses", "most expensive", "highest spending", "top N", "show me my top". Set type="topN", category=null. You MUST populate highlightTransactionIds with the IDs of the N highest-amount EXPENSE transactions (amount < 0) from the data, sorted by absolute value descending. N is the number the user specifies, or 10 if unspecified. This is a hard rule — never substitute type="bar" for these queries.
        - "treemap" → when the user wants a visual map or picture of their spending, or asks to see spending proportions visually. Example: "show me a spending map" or "visualise my budget" or "show me where my money goes as a picture"
        - For general or open-ended questions about spending patterns, habits, or behaviour (e.g. "what patterns do you notice", "how do I spend", "what are my habits"), choose the chart type that best visualises what your answer actually describes: use "stacked" if your answer discusses month-over-month trends or consistency across months, use "bar" if your answer compares categories, use "line" if your answer focuses on spending rhythm or time-based flow, use "pie" if your answer is about proportional distribution across categories. Never leave chartUpdate null for pattern questions — always pick the most relevant type.
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
            return ParseChatResponse(content, validCategories, userMessage, transactions);
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

        // Pre-compute monthly category totals for accurate AI summarization
        var monthlySummary = transactions
            .Where(t => t.Amount < 0)
            .GroupBy(t => new {
                Year = t.TransactionDate.Year,
                Month = t.TransactionDate.Month,
                Category = t.Category?.Name ?? "Uncategorized"
            })
            .Select(g => new {
                Period = $"{new DateTime(g.Key.Year, g.Key.Month, 1):MMM yyyy}",
                g.Key.Category,
                Total = g.Sum(t => Math.Abs(t.Amount))
            })
            .OrderBy(x => x.Period)
            .ThenBy(x => x.Category)
            .ToList();

        builder.AppendLine("=== PRE-COMPUTED MONTHLY CATEGORY TOTALS (use these exact figures when citing amounts) ===");
        var periods = monthlySummary.Select(x => x.Period).Distinct().OrderBy(x => x);
        foreach (var period in periods)
        {
            var periodItems = monthlySummary.Where(x => x.Period == period).ToList();
            var periodTotal = periodItems.Sum(x => x.Total);
            builder.AppendLine($"[{period}] Total: ${periodTotal:F2}");
            foreach (var item in periodItems)
            {
                builder.AppendLine($"  - {item.Category}: ${item.Total:F2}");
            }
        }
        builder.AppendLine("=== END OF SUMMARY ===");
        builder.AppendLine();

        // Individual transaction lines
        builder.AppendLine("Here is the user's transaction data:");
        foreach (var transaction in transactions)
        {
            var category = transaction.Category?.Name ?? "Uncategorized";
            var anomalyTag = transaction.IsAnomaly ? " [ANOMALY]" : string.Empty;
            var direction = transaction.Amount >= 0 ? "INCOME" : "EXPENSE";
            var absAmount = Math.Abs(transaction.Amount);
            builder.AppendLine(
                $"- [ID:{transaction.Id}] [{transaction.TransactionDate:yyyy-MM-dd}] [{direction}] {transaction.Description} ({category}): ${absAmount:F2}{anomalyTag}");
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
            var content = message.Role == "assistant"
                ? $"{{\"answer\": {JsonSerializer.Serialize(message.Content)}, \"chartUpdate\": null}}"
                : message.Content;

            messages.Add(new ChatRequestMessage
            {
                Role = message.Role,
                Content = content
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
            MaxTokens = 1500,
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

    private static ChatResponse ParseChatResponse(
        string? content,
        HashSet<string> validCategories,
        string userMessage,
        IReadOnlyList<Transaction> transactions)
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

            // Force topN chart if query is about biggest/top transactions but AI didn't emit it
            if (chartUpdate == null || chartUpdate.Type != "topN")
            {
                var lower = userMessage.ToLowerInvariant();
                var isTopNQuery =
                    lower.Contains("biggest purchase") ||
                    lower.Contains("largest expense") ||
                    lower.Contains("largest purchase") ||
                    lower.Contains("most expensive") ||
                    lower.Contains("top 7") ||
                    lower.Contains("top 10") ||
                    lower.Contains("top 5") ||
                    lower.Contains("top transactions") ||
                    lower.Contains("highest spending") ||
                    lower.Contains("biggest expense");

                if (isTopNQuery)
                {
                    // Extract N from message
                    int n = 10;
                    var words = lower.Split(' ');
                    for (int i = 0; i < words.Length - 1; i++)
                    {
                        if ((words[i] == "top" || words[i] == "biggest" || words[i] == "largest") &&
                            int.TryParse(words[i + 1], out var parsed2))
                        {
                            n = parsed2;
                            break;
                        }
                    }

                    // Pick top N expense transaction IDs by absolute amount
                    var topIds = transactions
                        .Where(t => t.Amount < 0)
                        .OrderByDescending(t => Math.Abs(t.Amount))
                        .Take(n)
                        .Select(t => t.Id.ToString())
                        .ToArray();

                    chartUpdate = new ChartUpdate("topN", null, topIds);
                }
            }

            return new ChatResponse(parsed.Answer, chartUpdate);
        }
        catch (JsonException ex)
        {
            Console.Error.WriteLine($"[ChatService] JSON parse failed. Exception: {ex.Message}. Raw content: {content}");
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
