using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nosyormi.Application.Telemetry;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Infrastructure.Chat;

public class BankDetectionService
{
    private const string RequestModel = "openai/gpt-4o-mini";

    private readonly HttpClient _http;
    private readonly ILlmCallRecorder _recorder;
    private readonly string _apiKey;
    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public BankDetectionService(HttpClient http, IConfiguration config, ILlmCallRecorder recorder)
    {
        _http = http;
        _recorder = recorder;
        _apiKey = config["OpenRouter:ApiKey"] ??
            throw new InvalidOperationException("OpenRouter:ApiKey not configured.");
    }

    public async Task<(string BankName, string AccountType)> DetectAsync(
        string fileName,
        IReadOnlyList<Transaction> transactions,
        CancellationToken cancellationToken = default)
    {
        var bankName = MatchBankFromFileName(fileName);
        var accountType = DetectAccountType(transactions);

        if (bankName is not null)
            return (bankName, accountType);

        bankName = await DetectBankWithAiAsync(fileName, transactions, cancellationToken);
        return (bankName, accountType);
    }

    private static string? MatchBankFromFileName(string fileName)
    {
        var normalized = fileName.ToLowerInvariant();

        if (normalized.Contains("bank of america") || normalized.Contains("bank_of_america")
            || normalized.Contains("bankofamerica") || normalized.Contains("boa"))
            return "Bank of America";

        if (normalized.Contains("wells fargo") || normalized.Contains("wells_fargo")
            || normalized.Contains("wellsfargo"))
            return "Wells Fargo";

        if (normalized.Contains("chase") || normalized.Contains("jpmorgan"))
            return "Chase";

        if (normalized.Contains("huntington"))
            return "Huntington Bank";

        if (normalized.Contains("citi"))
            return "Citibank";

        if (normalized.Contains("usbank") || normalized.Contains("us_bank") || normalized.Contains("usb"))
            return "U.S. Bank";

        if (normalized.Contains("pnc"))
            return "PNC Bank";

        if (normalized.Contains("capital one") || normalized.Contains("capital_one")
            || normalized.Contains("capitalone"))
            return "Capital One";

        if (normalized.Contains("discover"))
            return "Discover Bank";

        if (normalized.Contains("ally"))
            return "Ally Bank";

        if (normalized.Contains("tdbank") || normalized.Contains("td_bank"))
            return "TD Bank";

        return null;
    }

    private static string DetectAccountType(IReadOnlyList<Transaction> transactions)
    {
        foreach (var transaction in transactions)
        {
            var description = transaction.Description.ToUpperInvariant();
            if (description.Contains("SAVINGS INTEREST") || description.Contains("SAVINGS TRANSFER"))
                return "Savings";
        }

        return "Checking";
    }

    private async Task<string> DetectBankWithAiAsync(
        string fileName,
        IReadOnlyList<Transaction> transactions,
        CancellationToken cancellationToken)
    {
        var sampleDescriptions = transactions
            .Take(5)
            .Select(t => t.Description)
            .ToList();

        var userMessage = $"""
            File: {fileName}
            Sample transactions:
            {string.Join('\n', sampleDescriptions)}
            What bank issued this statement?
            """;

        var requestBody = new
        {
            model = RequestModel,
            max_tokens = 30,
            temperature = 0,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "You are a bank statement classifier. Reply with only the full bank name, nothing else."
                },
                new { role = "user", content = userMessage }
            }
        };

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post,
                "https://openrouter.ai/api/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = new StringContent(
                JsonSerializer.Serialize(requestBody, JsonOptions),
                Encoding.UTF8, "application/json");

            var stopwatch = Stopwatch.StartNew();
            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request, cancellationToken);
            }
            catch (HttpRequestException)
            {
                stopwatch.Stop();
                await _recorder.RecordAsync(
                    "bank_detect",
                    RequestModel,
                    responseModel: null,
                    inputTokens: 0,
                    outputTokens: 0,
                    stopwatch.Elapsed.TotalMilliseconds,
                    isSuccess: false,
                    errorType: "HttpRequestException",
                    statementId: null,
                    cancellationToken);
                return "Unknown Bank";
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    stopwatch.Stop();
                    await _recorder.RecordAsync(
                        "bank_detect",
                        RequestModel,
                        responseModel: null,
                        inputTokens: 0,
                        outputTokens: 0,
                        stopwatch.Elapsed.TotalMilliseconds,
                        isSuccess: false,
                        errorType: $"HTTP_{(int)response.StatusCode}",
                        statementId: null,
                        cancellationToken);
                    return "Unknown Bank";
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var responseModel = root.TryGetProperty("model", out var modelProp)
                    ? modelProp.GetString()
                    : null;

                var inputTokens = 0;
                var outputTokens = 0;
                if (root.TryGetProperty("usage", out var usage))
                {
                    if (usage.TryGetProperty("prompt_tokens", out var promptTokens))
                        inputTokens = promptTokens.GetInt32();
                    if (usage.TryGetProperty("completion_tokens", out var completionTokens))
                        outputTokens = completionTokens.GetInt32();
                }

                stopwatch.Stop();
                await _recorder.RecordAsync(
                    "bank_detect",
                    RequestModel,
                    responseModel,
                    inputTokens,
                    outputTokens,
                    stopwatch.Elapsed.TotalMilliseconds,
                    isSuccess: true,
                    errorType: null,
                    statementId: null,
                    cancellationToken);

                return root
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString()?.Trim() ?? "Unknown Bank";
            }
        }
        catch
        {
            return "Unknown Bank";
        }
    }
}
