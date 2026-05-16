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
        "You are a financial transaction categorizer. Given a transaction description and amount, return ONLY a JSON object with two fields: 'category' (string) and 'confidence' (float between 0 and 1). Choose category from this exact list only: Food & Groceries, Transport & Fuel, Subscriptions, Shopping, Utilities & Bills, Income, Healthcare, Entertainment, Dining & Takeaway, Other. Never invent new categories. Never add explanation. Return raw JSON only.";

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
