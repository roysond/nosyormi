using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Nosyormi.Application.Embeddings;
using Nosyormi.Application.Telemetry;

namespace Nosyormi.Infrastructure.Embeddings;

public class OpenRouterEmbeddingService : IEmbeddingService
{
    private const string EmbeddingsUrl = "https://openrouter.ai/api/v1/embeddings";
    private const string ApiKeyEnvVar = "OPENROUTER_API_KEY";
    private const string EmbeddingModelEnvVar = "EMBEDDING_MODEL";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;
    private readonly ILlmCallRecorder _recorder;

    public OpenRouterEmbeddingService(HttpClient httpClient, ILlmCallRecorder recorder)
    {
        _httpClient = httpClient;
        _recorder = recorder;
    }

    public async Task<float[]> GetEmbeddingAsync(
        string text,
        CancellationToken cancellationToken = default)
    {
        var apiKey = GetRequiredEnvironmentVariable(ApiKeyEnvVar);
        var model = GetRequiredEnvironmentVariable(EmbeddingModelEnvVar);

        using var request = BuildRequest(text, model, apiKey);

        var stopwatch = Stopwatch.StartNew();
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            stopwatch.Stop();
            await _recorder.RecordAsync(
                "embeddings",
                model,
                responseModel: null,
                inputTokens: 0,
                outputTokens: 0,
                stopwatch.Elapsed.TotalMilliseconds,
                isSuccess: false,
                errorType: "HttpRequestException",
                statementId: null,
                cancellationToken);
            throw new InvalidOperationException(
                "Failed to call OpenRouter embeddings API.",
                ex);
        }

        using (response)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                stopwatch.Stop();
                await _recorder.RecordAsync(
                    "embeddings",
                    model,
                    responseModel: null,
                    inputTokens: 0,
                    outputTokens: 0,
                    stopwatch.Elapsed.TotalMilliseconds,
                    isSuccess: false,
                    errorType: $"HTTP_{(int)response.StatusCode}",
                    statementId: null,
                    cancellationToken);
                throw new InvalidOperationException(
                    $"OpenRouter embeddings API returned {(int)response.StatusCode} {response.StatusCode}. Response: {responseBody}");
            }

            var (embedding, responseModel, inputTokens) = ParseEmbedding(responseBody);

            stopwatch.Stop();
            await _recorder.RecordAsync(
                "embeddings",
                model,
                responseModel,
                inputTokens,
                outputTokens: 0,
                stopwatch.Elapsed.TotalMilliseconds,
                isSuccess: true,
                errorType: null,
                statementId: null,
                cancellationToken);

            return embedding;
        }
    }

    private static string GetRequiredEnvironmentVariable(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(
                $"{name} environment variable is not set.");
        }

        return value;
    }

    private static HttpRequestMessage BuildRequest(string text, string model, string apiKey)
    {
        var body = new EmbeddingRequest
        {
            Model = model,
            Input = text
        };

        var request = new HttpRequestMessage(HttpMethod.Post, EmbeddingsUrl)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        return request;
    }

    private static (float[] Embedding, string? ResponseModel, int InputTokens) ParseEmbedding(string responseBody)
    {
        try
        {
            var response = JsonSerializer.Deserialize<EmbeddingResponse>(responseBody, JsonOptions);
            var embedding = response?.Data?.FirstOrDefault()?.Embedding;

            if (embedding is null || embedding.Length == 0)
            {
                throw new InvalidOperationException(
                    "OpenRouter embeddings response did not contain a valid embedding.");
            }

            return (embedding, response?.Model, response?.Usage?.PromptTokens ?? 0);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                "Failed to parse OpenRouter embeddings response.",
                ex);
        }
    }

    private sealed class EmbeddingRequest
    {
        public required string Model { get; init; }
        public required string Input { get; init; }
    }

    private sealed class EmbeddingResponse
    {
        public List<EmbeddingData>? Data { get; init; }
        public EmbeddingUsage? Usage { get; init; }
        public string? Model { get; init; }
    }

    private sealed class EmbeddingUsage
    {
        [JsonPropertyName("prompt_tokens")]
        public int PromptTokens { get; init; }

        [JsonPropertyName("completion_tokens")]
        public int CompletionTokens { get; init; }
    }

    private sealed class EmbeddingData
    {
        public float[]? Embedding { get; init; }
    }
}
