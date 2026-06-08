using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
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

        CATEGORY NAMES (exact strings for chartUpdate.category when drilling into one category):
        Food & Groceries, Transport & Fuel, Parking & Tolls, Subscriptions, Shopping, Utilities & Bills, Income, Healthcare, Entertainment, Dining & Takeaway, Transfers & Payments, ATM & Cash, Education, Government & Fees, Other.

        TRANSACTION DATA FORMAT:
        - Each transaction line starts with [ID:uuid] — use these IDs when populating highlightTransactionIds.
        - ACCURACY RULE: A pre-computed monthly summary table is provided at the top of each message. When citing category totals or monthly totals, ALWAYS use the exact figures from that summary table. Never compute sums yourself from individual transaction lines. When comparing amounts, always verify your conclusion against the numbers you cite — if you state that month A had $341 and month B had $430, you must conclude that month B is higher. Never contradict your own cited figures. When listing dates, months, or time periods in your answer, always present them in chronological order (oldest first) unless the user explicitly asks for a different order. When answering about specific merchants or transaction types, scan ALL transaction lines carefully, identify every matching transaction by description, cite the exact amounts and dates, and include their IDs in highlightTransactionIds. For all-time or overall spending questions, use the ALL-TIME CATEGORY TOTALS section. For month-specific questions, use the PRE-COMPUTED MONTHLY CATEGORY TOTALS section. Never add up monthly figures yourself — use the pre-computed all-time totals directly. ANOMALY RULE: When answering questions about unusual, flagged, or anomalous transactions, you MUST read each individual transaction line marked [ANOMALY] carefully. For each anomaly you mention, cite the EXACT amount from that specific transaction line — never approximate, never confuse one transaction's amount with another's description. Match each merchant name to its own exact dollar amount from the same transaction line. Do not invent transactions that are not marked [ANOMALY] in the data. INCOME vs EXPENSE RULE: Transactions marked [INCOME] in the data are money received into the account — they are NOT purchases or expenses. When answering about biggest purchases, top expenses, or spending, ONLY reference transactions marked [EXPENSE]. Never describe an [INCOME] transaction as a purchase, expense, or spending. If the user asks about their top purchases, list only [EXPENSE] transactions ordered by absolute amount descending. Note: Zelle payments sent TO other people are [EXPENSE] transactions and must be included when listing top purchases or expenses. Only Zelle payments received FROM others are [INCOME] and should be excluded from expense lists. TOP N RULE: When the user asks for biggest purchases, top expenses, or largest transactions, ALWAYS read the TOP 10 BIGGEST EXPENSES section and cite figures from that list only. Never compute top expenses yourself from individual transaction lines. The pre-computed list already excludes income transactions — trust it exactly as written. CATEGORY MONTHLY RULE: When the user asks about a specific category's spending each month, use ONLY the PRE-COMPUTED MONTHLY CATEGORY TOTALS section to find figures for that category per month. Never invent months that have zero spending — if a month does not appear in the summary for that category, it means zero spending that month. Do not reference months or years that have no data for the requested category. MERCHANT COUNT RULE: A PRE-COMPUTED MERCHANT SUMMARY section is provided when the user asks about a specific merchant. Use the exact count, total, and date range from that section. Do not compute these yourself. When answering questions about a specific merchant, service, or transaction type, you MUST count and sum ONLY the transactions whose IDs appear in highlightTransactionIds. These are the exact matching transactions — do not use category totals, all-time totals, or any pre-computed summary to answer merchant-specific questions. The total amount is the sum of those specific highlighted transaction amounts only. The count is the number of highlighted transaction IDs. If highlightTransactionIds contains 13 IDs, there are exactly 13 matching transactions — not more, not less. Always cite the exact first and last transaction dates from the highlighted set to determine the time range.

        RESPONSE FORMAT — you must ALWAYS return a valid JSON object with exactly this shape:
        {
          "answer": "your narrative response here",
          "chartUpdate": {
            "type": "pie|bar|line|anomalies|forecast|stacked|horizontal|treemap|topN|categoryMonthly",
            "category": "optional category name",
            "highlightTransactionIds": ["optional", "transaction", "ids"]
          }
        }

        CHART SELECTION RULES:
        - SPECIFIC TRANSACTION RULE (highest priority): When the user asks about a specific merchant, service, store, or transaction type (e.g. "Costco purchases", "DoorDash orders", "Amazon transactions", "parking meter charges", "Shell fuel purchases"), ALWAYS use type="bar" with category set to the matching category name AND populate highlightTransactionIds with the IDs of ALL transactions whose description contains that merchant/keyword. Scan every transaction line in the data, find matching descriptions, and include their [ID:uuid] values. This ensures the chart shows exactly the transactions the user asked about — not the whole category.
        - MONTHLY SPECIFIC RULE: When the user asks about a specific merchant or type "each month" or "every month" or "monthly", use type="categoryMonthly" with category set to the matching category AND populate highlightTransactionIds with matching transaction IDs so the frontend knows which transactions to aggregate monthly.
        - "pie" → when the user asks about spending breakdown or distribution across categories
        - "bar" → when the user asks to compare categories or amounts across ALL categories. Use category=null for this.
        - "bar" with a specific category → when the user asks about spending WITHIN a specific category (e.g. 'show me my subscriptions breakdown', 'what are my individual food purchases', 'break down my dining spending'). Set category to the category name. This signals the frontend to show individual transactions within that category as separate bars, not the aggregated category total.
        - When a user asks about a specific merchant or service (Netflix, Spotify, Shell, etc.), identify which category it belongs to and set chartUpdate.type='bar' with chartUpdate.category set to that category name. This will show all transactions in that category as individual bars.
        - "line" → when the user asks about spending over time or trends
        - "anomalies" → when the user asks about unusual, unexpected, or high transactions
        - "forecast" → when the user asks about next month or future spending predictions
        - "stacked" → when the user asks how spending changed month by month across categories, or wants to see monthly trends broken down by category. Example: "show me my spending by category each month" or "how has my spending changed over months"
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

    public async Task StreamChatAsync(
        Guid statementId,
        string userMessage,
        IReadOnlyList<ChatMessage> conversationHistory,
        HttpResponse httpResponse,
        CancellationToken cancellationToken = default)
    {
        const string errorMessage = "I had trouble reflecting on that. Could you rephrase your question?";

        async Task WriteErrorAsync()
        {
            await httpResponse.WriteAsync(
                $"data: {JsonSerializer.Serialize(new { type = "error", message = errorMessage }, JsonOptions)}\n\n",
                cancellationToken);
            await httpResponse.Body.FlushAsync(cancellationToken);
        }

        try
        {
            var transactions = await _db.Set<Transaction>()
                .Include(t => t.Category)
                .Where(t => t.StatementId == statementId)
                .ToListAsync(cancellationToken);

            var context = BuildTransactionContext(transactions, userMessage);
            var validCategories = GetValidCategories(transactions);
            var messages = BuildMessages(context, conversationHistory, userMessage);

            var apiKey = Environment.GetEnvironmentVariable(ApiKeyEnvVar);
            var model = Environment.GetEnvironmentVariable(ModelEnvVar);

            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
            {
                await WriteErrorAsync();
                return;
            }

            using var request = BuildRequest(messages, model, apiKey);

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken);
            }
            catch (HttpRequestException)
            {
                await WriteErrorAsync();
                return;
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    await WriteErrorAsync();
                    return;
                }

                var accumulated = new StringBuilder();
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var reader = new StreamReader(stream);

                while (!cancellationToken.IsCancellationRequested)
                {
                    var line = await reader.ReadLineAsync(cancellationToken);
                    if (line is null)
                        break;
                    if (string.IsNullOrWhiteSpace(line))
                        continue;
                    if (!line.StartsWith("data: ", StringComparison.Ordinal))
                        continue;

                    var data = line["data: ".Length..].Trim();
                    if (data == "[DONE]")
                        break;

                    ChatStreamChunk? chunk;
                    try
                    {
                        chunk = JsonSerializer.Deserialize<ChatStreamChunk>(data, JsonOptions);
                    }
                    catch (JsonException)
                    {
                        continue;
                    }

                    var delta = chunk?.Choices?.FirstOrDefault()?.Delta?.Content;
                    if (string.IsNullOrEmpty(delta))
                        continue;

                    accumulated.Append(delta);
                }

                var parsed = ParseChatResponse(
                    accumulated.ToString(),
                    validCategories,
                    userMessage,
                    transactions);

                var words = parsed.Answer.Split(' ');
                foreach (var word in words)
                {
                    await httpResponse.WriteAsync(
                        $"data: {JsonSerializer.Serialize(new { type = "text", content = word + " " }, JsonOptions)}\n\n",
                        cancellationToken);
                    await httpResponse.Body.FlushAsync(cancellationToken);
                    await Task.Delay(18, cancellationToken);
                }

                var chartUpdate = parsed.ChartUpdate;
                await httpResponse.WriteAsync(
                    $"data: {JsonSerializer.Serialize(new { type = "chart", chartUpdate }, JsonOptions)}\n\n",
                    cancellationToken);
                await httpResponse.Body.FlushAsync(cancellationToken);

                await httpResponse.WriteAsync(
                    $"data: {JsonSerializer.Serialize(new { type = "done" }, JsonOptions)}\n\n",
                    cancellationToken);
                await httpResponse.Body.FlushAsync(cancellationToken);
            }
        }
        catch
        {
            await WriteErrorAsync();
        }
    }

    private static HashSet<string> GetValidCategories(IReadOnlyList<Transaction> transactions) =>
        transactions
            .Select(t => t.Category?.Name)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Cast<string>()
            .ToHashSet(StringComparer.Ordinal);

    private static string BuildTransactionContext(
        IReadOnlyList<Transaction> transactions,
        string userMessage)
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

        // All-time category totals
        var allTimeTotals = transactions
            .Where(t => t.Amount < 0)
            .GroupBy(t => t.Category?.Name ?? "Other")
            .Select(g => new { Category = g.Key, Total = g.Sum(t => Math.Abs(t.Amount)) })
            .OrderByDescending(x => x.Total)
            .ToList();

        builder.AppendLine("=== ALL-TIME CATEGORY TOTALS (use these for overall spending questions) ===");
        foreach (var item in allTimeTotals)
        {
            builder.AppendLine($"  {item.Category}: ${item.Total:F2}");
        }
        builder.AppendLine("=== END OF ALL-TIME TOTALS ===");
        builder.AppendLine();

        var top10Expenses = transactions
            .Where(t => t.Amount < 0)
            .OrderByDescending(t => Math.Abs(t.Amount))
            .Take(10)
            .ToList();

        builder.AppendLine("=== TOP 10 BIGGEST EXPENSES (use these exact figures for top purchase questions) ===");
        for (int i = 0; i < top10Expenses.Count; i++)
        {
            var t = top10Expenses[i];
            var cat = t.Category?.Name ?? "Other";
            builder.AppendLine($"{i + 1}. [ID:{t.Id}] [{t.TransactionDate:yyyy-MM-dd}] {t.Description} ({cat}): ${Math.Abs(t.Amount):F2}");
        }
        builder.AppendLine("=== END OF TOP 10 EXPENSES ===");
        builder.AppendLine();

        // Pre-compute merchant-specific summary if user message mentions a specific merchant
        var lowerMessage = userMessage.ToLowerInvariant();
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "show", "me", "all", "my", "the", "a", "an", "i", "what", "how", "much",
            "did", "spend", "on", "in", "for", "at", "from", "to", "by", "and", "or",
            "with", "last", "this", "each", "every", "month", "week", "year", "purchases",
            "transactions", "orders", "spending", "breakdown", "where", "when", "which",
            "about", "can", "you", "tell", "give", "list", "see", "view", "get", "find",
            "have", "has", "had", "were", "was", "is", "are", "do", "does", "did",
            "food", "groceries", "grocery", "fuel", "transport", "dining", "takeaway",
            "subscription", "subscriptions", "entertainment", "shopping", "education",
            "atm", "cash", "transfer", "transfers", "payment", "payments", "parking",
            "tolls", "utilities", "bills", "healthcare", "government", "income", "other"
        };

        var messageWords = lowerMessage
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3 && !stopWords.Contains(w))
            .Distinct()
            .ToArray();

        if (messageWords.Length > 0)
        {
            var merchantMatches = transactions
                .Where(t =>
                    t.Category?.Name != "Transfers & Payments" &&
                    messageWords.Any(term =>
                        t.Description.Contains(term, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            if (merchantMatches.Count > 0 && merchantMatches.Count < transactions.Count)
            {
                var merchantTotal = merchantMatches.Sum(t => Math.Abs(t.Amount));
                var merchantCount = merchantMatches.Count;
                var firstDate = merchantMatches.Min(t => t.TransactionDate);
                var lastDate = merchantMatches.Max(t => t.TransactionDate);

                builder.AppendLine("=== PRE-COMPUTED MERCHANT SUMMARY (use these exact figures for merchant-specific questions) ===");
                builder.AppendLine($"Matching transactions: {merchantCount}");
                builder.AppendLine($"Total amount: ${merchantTotal:F2}");
                builder.AppendLine($"Date range: {firstDate:yyyy-MM-dd} to {lastDate:yyyy-MM-dd}");
                builder.AppendLine("Individual transactions:");
                foreach (var t in merchantMatches.OrderBy(t => t.TransactionDate))
                {
                    builder.AppendLine($"  [{t.TransactionDate:yyyy-MM-dd}] {t.Description}: ${Math.Abs(t.Amount):F2}");
                }
                builder.AppendLine("=== END OF MERCHANT SUMMARY ===");
                builder.AppendLine();
            }
        }

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
                ? $"{{\"answer\": {JsonSerializer.Serialize(message.Content)}, \"chartUpdate\": {{}}}}"
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
            Temperature = 0.3f,
            Stream = true
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

            // Keyword-based chart override — ensures correct chart renders regardless of AI chartUpdate
            var lower = userMessage.ToLowerInvariant();
            var words = lower.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            // Helper to find category match in message (partial keywords + full names)
            string? FindCategoryInMessage(HashSet<string> validCategories)
            {
                (string keyword, string category)[] partialMatches =
                [
                    ("fuel", "Transport & Fuel"),
                    ("transport", "Transport & Fuel"),
                    ("food", "Food & Groceries"),
                    ("groceries", "Food & Groceries"),
                    ("dining", "Dining & Takeaway"),
                    ("takeaway", "Dining & Takeaway"),
                    ("subscription", "Subscriptions"),
                    ("entertainment", "Entertainment"),
                    ("shopping", "Shopping"),
                    ("education", "Education"),
                    ("atm", "ATM & Cash"),
                    ("cash", "ATM & Cash"),
                    ("transfer", "Transfers & Payments"),
                    ("payment", "Transfers & Payments"),
                    ("parking", "Parking & Tolls"),
                    ("tolls", "Parking & Tolls"),
                    ("utilities", "Utilities & Bills"),
                    ("bills", "Utilities & Bills"),
                    ("healthcare", "Healthcare"),
                    ("government", "Government & Fees"),
                ];

                foreach (var (keyword, category) in partialMatches)
                {
                    if (lower.Contains(keyword) && validCategories.Contains(category))
                        return category;
                }

                foreach (var cat in validCategories)
                {
                    if (lower.Contains(cat.ToLowerInvariant()))
                        return cat;
                }

                return null;
            }

            // Helper to extract N from message
            int ExtractN(int defaultN = 10)
            {
                for (int i = 0; i < words.Length - 1; i++)
                {
                    if ((words[i] == "top" || words[i] == "biggest" || words[i] == "largest") &&
                        int.TryParse(words[i + 1], out var n))
                        return n;
                }
                return defaultN;
            }

            (DateOnly? From, DateOnly? To) DetectTimePeriod()
            {
                // Use the most recent transaction date as the reference point
                var maxDate = transactions.Any() ? transactions.Max(t => t.TransactionDate) : DateOnly.FromDateTime(DateTime.UtcNow);
                var refMonth = new DateOnly(maxDate.Year, maxDate.Month, 1);

                if (lower.Contains("last month"))
                {
                    // "last month" = the most recent month in the data
                    return (refMonth, refMonth.AddMonths(1).AddDays(-1));
                }
                if (lower.Contains("this month") || lower.Contains("current month"))
                {
                    return (refMonth, refMonth.AddMonths(1).AddDays(-1));
                }
                if (lower.Contains("last year"))
                {
                    return (new DateOnly(maxDate.Year - 1, 1, 1), new DateOnly(maxDate.Year - 1, 12, 31));
                }
                if (lower.Contains("this year"))
                {
                    return (new DateOnly(maxDate.Year, 1, 1), new DateOnly(maxDate.Year, 12, 31));
                }

                // Check for named month (e.g. "in March", "in January 2026")
                var monthNames = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    ["january"] = 1, ["february"] = 2, ["march"] = 3, ["april"] = 4,
                    ["may"] = 5, ["june"] = 6, ["july"] = 7, ["august"] = 8,
                    ["september"] = 9, ["october"] = 10, ["november"] = 11, ["december"] = 12
                };
                foreach (var (monthName, monthNum) in monthNames)
                {
                    if (!lower.Contains(monthName)) continue;

                    // Try to find year e.g. "march 2026"
                    var match = System.Text.RegularExpressions.Regex.Match(lower, monthName + @"\s+(\d{4})");
                    int year = match.Success ? int.Parse(match.Groups[1].Value) : maxDate.Year;

                    // If that month/year combo is in the future relative to data, try previous year
                    var candidate = new DateOnly(year, monthNum, 1);
                    if (candidate > maxDate)
                        candidate = candidate.AddYears(-1);

                    return (candidate, candidate.AddMonths(1).AddDays(-1));
                }

                return (null, null);
            }

            var (fromDate, toDate) = DetectTimePeriod();

            // FORECAST — next month, future spending, prediction
            bool isForecast = lower.Contains("next month") || lower.Contains("next week") ||
                lower.Contains("forecast") || lower.Contains("predict") || lower.Contains("will i spend") ||
                lower.Contains("will spend") || lower.Contains("future");

            // ANOMALIES — unusual, unexpected, flagged
            bool isAnomalies = lower.Contains("anomal") || lower.Contains("unusual") ||
                lower.Contains("unexpected") || lower.Contains("flagged") || lower.Contains("weird") ||
                lower.Contains("suspicious") || lower.Contains("outlier");

            // TOPN — biggest purchases, top transactions
            bool isTopN = lower.Contains("biggest purchase") || lower.Contains("largest expense") ||
                lower.Contains("largest purchase") || lower.Contains("most expensive") ||
                lower.Contains("top 7") || lower.Contains("top 10") || lower.Contains("top 5") ||
                lower.Contains("top 3") || lower.Contains("top transactions") || lower.Contains("biggest expense") ||
                lower.Contains("highest spending") || lower.Contains("what are my top");

            // CATEGORY MONTHLY / DRILL-DOWN — specific category mentioned in message
            string? mentionedCategory = FindCategoryInMessage(validCategories);
            bool hasMerchantTerm = transactions.Any(t =>
                t.Description.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Any(word => word.Length >= 4 && lower.Contains(word.ToLowerInvariant()) &&
                        !new[] { "purchase", "mobile", "from", "payment", "debit", "credit" }
                            .Contains(word.ToLowerInvariant())));

            bool isCategoryMonthly = (mentionedCategory is not null || hasMerchantTerm) &&
                (lower.Contains("each month") || lower.Contains("every month") ||
                lower.Contains("month by month") || lower.Contains("monthly") ||
                lower.Contains("per month") || lower.Contains("month to month") ||
                lower.Contains("over months") || lower.Contains("by month") ||
                lower.Contains("average") ||
                lower.Contains("trend") || lower.Contains("over time"));
            bool isCategoryDrillDown = mentionedCategory is not null && !isCategoryMonthly;

            // STACKED — monthly by category, month by month, each month, over months (no specific category)
            bool isStacked = mentionedCategory is null && !hasMerchantTerm &&
                (lower.Contains("each month") || lower.Contains("every month") ||
                lower.Contains("month by month") || lower.Contains("monthly") || lower.Contains("per month") ||
                lower.Contains("month to month") || lower.Contains("over months") || lower.Contains("by month")) &&
                !isForecast;

            // LINE — over time, trend, history, timeline (no specific category)
            bool isMonthSpecific = mentionedCategory is null && !isForecast && !isAnomalies && !isTopN && fromDate != null;
            bool isLine = mentionedCategory is null &&
                (lower.Contains("over time") || lower.Contains("trend") ||
                lower.Contains("history") || lower.Contains("timeline") || lower.Contains("across time") ||
                lower.Contains("time series") || lower.Contains("how has") || lower.Contains("changed over")) &&
                !isStacked && !isForecast;

            // HORIZONTAL — rank, compare, highest to lowest, which category
            bool isHorizontal = lower.Contains("rank") || lower.Contains("ranking") ||
                lower.Contains("compare categor") || lower.Contains("highest to lowest") ||
                lower.Contains("lowest to highest") || lower.Contains("which category") ||
                lower.Contains("category comparison");

            // TREEMAP — map, visualize, picture, proportion
            bool isTreemap = lower.Contains("spending map") || lower.Contains("visuali") ||
                lower.Contains("treemap") || lower.Contains("picture of") || lower.Contains("show me where") ||
                lower.Contains("where does my money");

            // PIE — breakdown, distribution, proportion
            bool isPie = (lower.Contains("breakdown") || lower.Contains("distribution") ||
                lower.Contains("proportion") || lower.Contains("split") || lower.Contains("percentage")) &&
                !isStacked && !isHorizontal && !isTreemap;

            // Apply overrides in priority order
            if (isForecast)
            {
                chartUpdate = new ChartUpdate("forecast", null, null);
            }
            else if (isAnomalies)
            {
                chartUpdate = new ChartUpdate("anomalies", null, null);
            }
            else if (isTopN)
            {
                var topIds = transactions
                    .Where(t => t.Amount < 0)
                    .OrderByDescending(t => Math.Abs(t.Amount))
                    .Take(ExtractN())
                    .Select(t => t.Id.ToString())
                    .ToArray();
                chartUpdate = new ChartUpdate("topN", null, topIds);
            }
            else if (isCategoryMonthly)
            {
                chartUpdate = new ChartUpdate("categoryMonthly", mentionedCategory, null);
            }
            else if (isCategoryDrillDown)
            {
                string[]? drillIds = null;

                if (fromDate != null)
                {
                    // Time period detected — filter category transactions to that period
                    drillIds = transactions
                        .Where(t => (t.Category?.Name ?? "Other") == mentionedCategory)
                        .Where(t => t.Amount < 0)
                        .Where(t => t.TransactionDate >= fromDate.Value)
                        .Where(t => toDate == null || t.TransactionDate <= toDate.Value)
                        .Select(t => t.Id.ToString())
                        .ToArray();
                    if (drillIds.Length == 0) drillIds = null;
                }

                chartUpdate = new ChartUpdate("bar", mentionedCategory, drillIds);
            }
            else if (isMonthSpecific)
            {
                var monthIds = transactions
                    .Where(t => t.Amount < 0)
                    .Where(t => t.TransactionDate >= fromDate!.Value)
                    .Where(t => t.TransactionDate <= fromDate!.Value.AddMonths(1).AddDays(-1))
                    .Select(t => t.Id.ToString())
                    .ToArray();
                chartUpdate = new ChartUpdate("bar", null, monthIds.Length > 0 ? monthIds : null);
            }
            else if (isStacked)
            {
                chartUpdate = new ChartUpdate("stacked", null, null);
            }
            else if (isLine)
            {
                chartUpdate = new ChartUpdate("line", null, null);
            }
            else if (isHorizontal)
            {
                chartUpdate = new ChartUpdate("horizontal", null, null);
            }
            else if (isTreemap)
            {
                chartUpdate = new ChartUpdate("treemap", null, null);
            }
            else if (isPie)
            {
                chartUpdate = new ChartUpdate("pie", null, null);
            }
            else if (chartUpdate == null)
            {
                // If AI returned nothing and no keyword matched, use stacked as intelligent default
                // only for questions about spending patterns
                if (lower.Contains("pattern") || lower.Contains("habit") || lower.Contains("how do i spend") ||
                    lower.Contains("spending look") || lower.Contains("overview"))
                {
                    chartUpdate = new ChartUpdate("stacked", null, null);
                }
            }

            // Merchant detection: if the chart has a category but no highlight IDs,
            // search transaction descriptions for specific merchant terms in the message.
            // This handles queries like "Show me my Costco purchases" where "Costco"
            // is not a category keyword but is a merchant name in the data.
            if (chartUpdate?.Type == "bar" || chartUpdate?.Type == "categoryMonthly")
            {
                var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "show", "me", "all", "my", "the", "a", "an", "i", "what", "how", "much",
                    "did", "spend", "on", "in", "for", "at", "from", "to", "by", "and", "or",
                    "with", "last", "this", "each", "every", "month", "week", "year", "purchases",
                    "transactions", "orders", "spending", "breakdown", "where", "when", "which",
                    "about", "can", "you", "tell", "give", "list", "see", "view", "get", "find",
                    "have", "has", "had", "were", "was", "is", "are", "do", "does", "did",
                    "food", "groceries", "grocery", "fuel", "transport", "dining", "takeaway",
                    "subscription", "subscriptions", "entertainment", "shopping", "education",
                    "atm", "cash", "transfer", "transfers", "payment", "payments", "parking",
                    "tolls", "utilities", "bills", "healthcare", "government", "income", "other"
                };

                var merchantTerms = words
                    .Where(w => w.Length >= 3 && !stopWords.Contains(w))
                    .Distinct()
                    .ToArray();

                if (merchantTerms.Length > 0)
                {
                    var matchingIds = transactions
                        .Where(t =>
                            t.Category?.Name != "Transfers & Payments" &&
                            merchantTerms.Any(term =>
                                t.Description.Contains(term, StringComparison.OrdinalIgnoreCase)))
                        .Select(t => t.Id.ToString())
                        .ToArray();

                    // Only apply if we found specific matches (not the entire dataset)
                    if (matchingIds.Length > 0 && matchingIds.Length < transactions.Count)
                    {
                        chartUpdate = new ChartUpdate(chartUpdate.Type, chartUpdate.Category, matchingIds);
                    }
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
        public bool Stream { get; init; }
    }

    private sealed class ChatStreamChunk
    {
        public List<ChatStreamChoice>? Choices { get; init; }
    }

    private sealed class ChatStreamChoice
    {
        public ChatStreamDelta? Delta { get; init; }
    }

    private sealed class ChatStreamDelta
    {
        public string? Content { get; init; }
    }

    private sealed class ChatRequestMessage
    {
        public required string Role { get; init; }
        public required string Content { get; init; }
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
