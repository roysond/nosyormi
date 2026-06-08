using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Nosyormi.Application.Categorization;

namespace Nosyormi.Infrastructure.Categorization;

public class OpenRouterCategoryClassifier : ICategoryClassifier
{
    private const string ChatCompletionsUrl = "https://openrouter.ai/api/v1/chat/completions";
    private const string ApiKeyEnvVar = "OPENROUTER_API_KEY";
    private const string ModelEnvVar = "MODEL_LIGHT";

    private const string SystemPrompt =
        "You are a financial transaction categorizer. Given a transaction description and amount, return ONLY a JSON object with two fields: 'category' (string) and 'confidence' (float between 0 and 1). Choose category from this exact list only: Food & Groceries, Transport & Fuel, Parking & Tolls, Subscriptions, Shopping, Utilities & Bills, Income, Healthcare, Entertainment, Dining & Takeaway, Transfers & Payments, ATM & Cash, Education, Government & Fees, Other.\n\nCATEGORIZATION RULES — follow strictly, top rules take priority:\n- Income: any money received, deposits, Zelle received, direct deposits, refunds credited to account.\n- ATM & Cash: any ATM cash withdrawal or ATM cash deposit transaction. Key signals: 'ATM', 'CASH WITHDRAWAL', 'CASH DEPOSIT', 'ATM WITHDRAWAL'.\n- Transfers & Payments: peer-to-peer money transfers, Zelle sent, Payment ID transactions, bank transfers sent to another person. Key signals: 'Payment ID', 'Money Sent', 'Zelle', 'TRANSFER'.\n- Subscriptions: ANY recurring membership, pass, renewal, or subscription. Key signals: 'RENEWAL', 'PASS', 'MEMBERSHIP', 'SERVICES', 'SUBSCRIPTION', 'DashPass', 'Prime', 'Plus'. Phone plans (SimpleMobile, T-Mobile, AT&T), gym memberships, software tools, annual renewals all belong here.\n- Dining & Takeaway: restaurant meals, food delivery orders (DoorDash orders, UberEats, GrubHub orders) but NOT their subscription passes.\n- Food & Groceries: supermarkets, grocery stores, wholesale food purchases (Costco food runs, not Costco membership).\n- Transport & Fuel: gas stations, fuel purchases, ride-share trips, toll payments on highways.\n- Parking & Tolls: parking meters, parking lots, toll booths.\n- Shopping: retail stores, Amazon product purchases, general merchandise, department stores.\n- Entertainment: movies, concerts, events, theatres, experience venues.\n- Utilities & Bills: electricity, water, gas bills, internet, phone bills paid to providers.\n- Healthcare: pharmacies, medical offices, hospitals, clinics.\n- Education: tuition, university, college, student loans, Nelnet, Sallie Mae, Trine University.\n- Other: genuinely unrecognizable transactions only. Use this as a last resort.\n\nNever invent new categories. Never add explanation. Return raw JSON only.";

    private static readonly CategoryResult FallbackResult = new("Other", 0.0f);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;

    public OpenRouterCategoryClassifier(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<CategoryResult> ClassifyAsync(
        string description,
        decimal amount,
        CancellationToken cancellationToken = default)
    {
        // Pre-classify known patterns to bypass AI for high-confidence cases
        var upperDesc = description.ToUpperInvariant();

        // Square terminal payments (TST*) are almost always cafes, restaurants, or food vendors
        if (upperDesc.StartsWith("TST*") || upperDesc.StartsWith("SQ *"))
        {
            return new CategoryResult("Dining & Takeaway", 0.95f);
        }

        // DoorDash food orders (not DashPass) are dining
        if ((upperDesc.Contains("DOORDASH") || upperDesc.Contains("DD *DOORDASH")) &&
            !upperDesc.Contains("DASHPASS") &&
            !upperDesc.Contains("DASH PASS"))
        {
            return new CategoryResult("Dining & Takeaway", 0.95f);
        }

        // Known restaurant merchants — explicitly classified as Dining & Takeaway
        if (upperDesc.Contains("NNT HYDERABAD") ||
            upperDesc.Contains("HYDERABAD KITCHEN") ||
            upperDesc.Contains("7 SPICES") ||
            upperDesc.Contains("CKE*7 SPICES") ||
            upperDesc.Contains("BABA SAJ") ||
            upperDesc.Contains("NOON O KABAB") ||
            upperDesc.Contains("HALAL PIZZA") ||
            upperDesc.Contains("PIZZA BIZZA") ||
            upperDesc.Contains("GRAND ISTANBUL") ||
            upperDesc.Contains("ANNAPURNA") ||
            upperDesc.Contains("THOUSAND TALES") ||
            upperDesc.Contains("A THOUSAND T") ||
            upperDesc.Contains("SWEET RESERVE") ||
            upperDesc.Contains("AMAZING BREAD") ||
            upperDesc.Contains("FILLI CAFE") ||
            upperDesc.Contains("CAFE 44") ||
            upperDesc.Contains("TROPICAL SMOOTHIE") ||
            upperDesc.Contains("CHOWBUS") ||
            upperDesc.Contains("MIGHTY HALAL"))
        {
            return new CategoryResult("Dining & Takeaway", 0.99f);
        }

        // Known grocery and food retail merchants — explicitly Food & Groceries
        if (upperDesc.Contains("HARLEM FOODS") ||
            upperDesc.Contains("PITAINN") ||
            upperDesc.Contains("PITA INN") ||
            upperDesc.Contains("JERRY S FRUIT") ||
            upperDesc.Contains("OASIS BAKERY") ||
            upperDesc.Contains("JEWEL OSCO") ||
            upperDesc.Contains("7455 W ARCHER") ||
            upperDesc.Contains("TOUHY RIVER") ||
            upperDesc.Contains("CASEYS") ||
            upperDesc.Contains("FOOD SERVICE PREP"))
        {
            return new CategoryResult("Food & Groceries", 0.99f);
        }

        if (upperDesc.Contains("USCIS") ||
            upperDesc.Contains("DMV") ||
            upperDesc.Contains("IRS") ||
            upperDesc.Contains("GOVERNMENT") ||
            upperDesc.Contains("GOVT") ||
            upperDesc.Contains("MUNICIPALITY") ||
            upperDesc.Contains("CITY OF") ||
            upperDesc.Contains("STATE OF") ||
            upperDesc.Contains("COUNTY OF") ||
            upperDesc.Contains("COURT") ||
            upperDesc.Contains("LICENSE FEE") ||
            upperDesc.Contains("PERMIT FEE"))
        {
            return new CategoryResult("Government & Fees", 0.99f);
        }

        if (upperDesc.Contains("TRINE") ||
            upperDesc.Contains("UNIVERSITY") ||
            upperDesc.Contains("COLLEGE") ||
            upperDesc.Contains("TUITION") ||
            upperDesc.Contains("STUDENT LOAN") ||
            upperDesc.Contains("NELNET") ||
            upperDesc.Contains("SALLIE MAE") ||
            upperDesc.Contains("FEDLOAN") ||
            upperDesc.Contains("NAVIENT"))
        {
            return new CategoryResult("Education", 0.99f);
        }

        if (upperDesc.Contains("DASHPASS") ||
            upperDesc.Contains("DASH PASS") ||
            upperDesc.Contains("AMAZON PRIME") ||
            upperDesc.Contains("NETFLIX") ||
            upperDesc.Contains("SPOTIFY") ||
            upperDesc.Contains("APPLE.COM/BILL") ||
            upperDesc.Contains("GOOGLE ONE") ||
            upperDesc.Contains("YOUTUBE PREMIUM") ||
            upperDesc.Contains("DISNEY PLUS") ||
            upperDesc.Contains("DISNEY+") ||
            upperDesc.Contains("HULU") ||
            upperDesc.Contains("PARAMOUNT") ||
            upperDesc.Contains("PEACOCK") ||
            upperDesc.Contains("RENEWAL") ||
            upperDesc.Contains("MEMBERSHIP"))
        {
            return new CategoryResult("Subscriptions", 0.99f);
        }

        if (upperDesc.StartsWith("WT ") || upperDesc.Contains("WIRE TRANSFER") || upperDesc.Contains("WIRE FROM") || upperDesc.Contains("WIRE TO"))
        {
            return new CategoryResult(amount > 0 ? "Income" : "Transfers & Payments", 0.99f);
        }

        if (upperDesc.Contains("ATM") || upperDesc.Contains("CASH WITHDRAWAL") || upperDesc.Contains("CASH DEPOSIT"))
        {
            return new CategoryResult("ATM & Cash", 0.99f);
        }

        if (upperDesc.Contains("ZELLE FROM") || upperDesc.Contains("MONEY RECEIVED FROM"))
        {
            return new CategoryResult("Income", 0.99f);
        }

        if (upperDesc.Contains("PAYMENT ID") ||
            upperDesc.Contains("MONEY SENT") ||
            upperDesc.Contains("ZELLE TO") ||
            upperDesc.Contains("ZELLE"))
        {
            return new CategoryResult("Transfers & Payments", 0.99f);
        }

        var apiKey = Environment.GetEnvironmentVariable(ApiKeyEnvVar);
        var model = Environment.GetEnvironmentVariable(ModelEnvVar);

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(model))
            return FallbackResult;

        using var request = BuildRequest(description, amount, model, apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return FallbackResult;
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
                return FallbackResult;

            var completion = await response.Content.ReadFromJsonAsync<ChatCompletionResponse>(
                JsonOptions,
                cancellationToken);

            var content = completion?.Choices?.FirstOrDefault()?.Message?.Content;
            return TryMapToCategoryResult(content);
        }
    }

    private static HttpRequestMessage BuildRequest(
        string description,
        decimal amount,
        string model,
        string apiKey)
    {
        var body = new ChatCompletionRequest
        {
            Model = model,
            Messages =
            [
                new ChatRequestMessage { Role = "system", Content = SystemPrompt },
                new ChatRequestMessage
                {
                    Role = "user",
                    Content = $"Description: {description}, Amount: {amount}"
                }
            ],
            MaxTokens = 50,
            Temperature = 0
        };

        var request = new HttpRequestMessage(HttpMethod.Post, ChatCompletionsUrl)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        return request;
    }

    private static CategoryResult TryMapToCategoryResult(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return FallbackResult;

        try
        {
            var json = ExtractJsonPayload(content);
            var parsed = JsonSerializer.Deserialize<ModelCategoryPayload>(json, JsonOptions);

            if (parsed is null || string.IsNullOrWhiteSpace(parsed.Category))
                return FallbackResult;

            if (!IsKnownCategory(parsed.Category))
                return FallbackResult;

            return new CategoryResult(parsed.Category, parsed.Confidence);
        }
        catch (JsonException)
        {
            return FallbackResult;
        }
    }

    private static bool IsKnownCategory(string category) =>
        CategoryTaxonomy.All.Contains(category, StringComparer.Ordinal);

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

    private sealed class ModelCategoryPayload
    {
        public string? Category { get; init; }
        public float Confidence { get; init; }
    }
}
