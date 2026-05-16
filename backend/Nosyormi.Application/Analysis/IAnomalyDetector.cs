namespace Nosyormi.Application.Analysis;

public interface IAnomalyDetector
{
    Task<IReadOnlyList<AnomalyResult>> DetectAsync(
        IReadOnlyList<TransactionInput> transactions,
        CancellationToken cancellationToken = default);
}

public record TransactionInput(Guid Id, string Category, decimal Amount);

public record AnomalyResult(Guid TransactionId, bool IsAnomaly, double ZScore);
