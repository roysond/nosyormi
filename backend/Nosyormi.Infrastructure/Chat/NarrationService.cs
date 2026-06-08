using Microsoft.Extensions.Configuration;
using Nosyormi.Domain.Entities;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Nosyormi.Infrastructure.Chat;

public class NarrationService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public NarrationService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _apiKey = config["OpenRouter:ApiKey"] ??
            throw new InvalidOperationException("OpenRouter:ApiKey not configured.");
    }

    public async Task<string> GenerateNarrationAsync(
        IReadOnlyList<Transaction> transactions,
        CancellationToken cancellationToken = default)
    {
        var expenses = transactions.Where(t => t.Amount < 0).ToList();
        var income = transactions.Where(t => t.Amount > 0).ToList();

        var totalExpenses = expenses.Sum(t => Math.Abs(t.Amount));
        var totalIncome = income.Sum(t => t.Amount);

        var categoryTotals = expenses
            .GroupBy(t => t.Category?.Name ?? "Other")
            .Select(g => new { Category = g.Key, Total = g.Sum(t => Math.Abs(t.Amount)) })
            .OrderByDescending(x => x.Total)
            .Take(5)
            .ToList();

        var dateRange = transactions.Any()
            ? $"{transactions.Min(t => t.TransactionDate):MMM yyyy} to {transactions.Max(t => t.TransactionDate):MMM yyyy}"
            : "unknown period";

        var anomalyCount = transactions.Count(t => t.IsAnomaly);

        var summary = new StringBuilder();
        summary.AppendLine($"Statement period: {dateRange}");
        summary.AppendLine($"Total income: ${totalIncome:F2}");
        summary.AppendLine($"Total expenses: ${totalExpenses:F2}");
        summary.AppendLine($"Transaction count: {transactions.Count}");
        summary.AppendLine($"Anomalies detected: {anomalyCount}");
        summary.AppendLine("Top spending categories:");
        foreach (var cat in categoryTotals)
            summary.AppendLine($"  {cat.Category}: ${cat.Total:F2}");

        var prompt = $"""
            You are NOSYOR.M.I, a personal finance reflection assistant.
            Generate a single warm, insightful paragraph (3-4 sentences) that
            summarises this person's financial statement at a glance.
            Be specific with the biggest numbers. Be conversational and encouraging.
            Do not use bullet points or headers — just one flowing paragraph.

            Data:
            {summary}
            """;

        var requestBody = new
        {
            model = "anthropic/claude-sonnet-4-5",
            max_tokens = 200,
            temperature = 0.4,
            messages = new[]
            {
                new { role = "user", content = prompt }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post,
            "https://openrouter.ai/api/v1/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(requestBody, JsonOptions),
            Encoding.UTF8, "application/json");

        var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "Your financial story is taking shape.";
    }
}
