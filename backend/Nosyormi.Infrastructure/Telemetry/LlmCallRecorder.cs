using Microsoft.Extensions.DependencyInjection;
using Nosyormi.Application.Telemetry;
using Nosyormi.Domain.Entities;
using Nosyormi.Infrastructure.Persistence;

namespace Nosyormi.Infrastructure.Telemetry;

public class LlmCallRecorder : ILlmCallRecorder
{
    // Hardcoded estimates that drift as provider pricing changes.
    private static readonly Dictionary<string, (decimal InputPerMillion, decimal OutputPerMillion)> PriceTable =
        new()
        {
            ["openai/gpt-4o-mini"] = (0.15m, 0.60m),
            ["anthropic/claude-sonnet-4-5"] = (3.00m, 15.00m),
            ["openai/text-embedding-3-small"] = (0.02m, 0m)
        };

    private readonly IServiceScopeFactory _scopeFactory;

    public LlmCallRecorder(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public async Task RecordAsync(
        string operationName,
        string requestModel,
        string? responseModel,
        int inputTokens,
        int outputTokens,
        double durationMs,
        bool isSuccess,
        string? errorType,
        Guid? statementId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<NosyormiDbContext>();

            var resolvedStatementId = statementId ?? LlmCallContext.CurrentStatementId;

            var estimatedCostUsd = 0m;
            if (PriceTable.TryGetValue(requestModel, out var prices))
            {
                estimatedCostUsd =
                    (inputTokens / 1_000_000m) * prices.InputPerMillion +
                    (outputTokens / 1_000_000m) * prices.OutputPerMillion;
            }

            db.LlmCalls.Add(new LlmCall
            {
                Id = Guid.NewGuid(),
                Timestamp = DateTime.UtcNow,
                OperationName = operationName,
                RequestModel = requestModel,
                ResponseModel = responseModel,
                InputTokens = inputTokens,
                OutputTokens = outputTokens,
                DurationMs = durationMs,
                IsSuccess = isSuccess,
                ErrorType = errorType,
                StatementId = resolvedStatementId,
                EstimatedCostUsd = estimatedCostUsd
            });

            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Telemetry must never break the calling service.
        }
    }
}
