using Nosyormi.Application.Analysis;

namespace Nosyormi.Infrastructure.Analysis;

public class ZScoreAnomalyDetector : IAnomalyDetector
{
    private const double AnomalyThreshold = 2.0;
    private const int MinimumGroupSize = 3;

    public Task<IReadOnlyList<AnomalyResult>> DetectAsync(
        IReadOnlyList<TransactionInput> transactions,
        CancellationToken cancellationToken = default)
    {
        var results = transactions
            .GroupBy(t => t.Category)
            .SelectMany(CalculateZScores)
            .ToDictionary(r => r.TransactionId);

        var ordered = transactions
            .Select(t => results[t.Id])
            .ToList();

        return Task.FromResult<IReadOnlyList<AnomalyResult>>(ordered);
    }

    private static IEnumerable<AnomalyResult> CalculateZScores(IEnumerable<TransactionInput> group)
    {
        var items = group.ToList();

        if (items.Count < MinimumGroupSize)
            return items.Select(t => new AnomalyResult(t.Id, IsAnomaly: false, ZScore: 0));

        var amounts = items.Select(t => Math.Abs((double)t.Amount)).ToList();
        var mean = amounts.Average();
        var standardDeviation = CalculateStandardDeviation(amounts, mean);

        if (standardDeviation == 0)
            return items.Select(t => new AnomalyResult(t.Id, IsAnomaly: false, ZScore: 0));

        return items.Select(t =>
        {
            var zScore = (Math.Abs((double)t.Amount) - mean) / standardDeviation;
            return new AnomalyResult(t.Id, zScore > AnomalyThreshold, zScore);
        });
    }

    private static double CalculateStandardDeviation(IReadOnlyList<double> values, double mean)
    {
        var variance = values.Sum(v => (v - mean) * (v - mean)) / values.Count;
        return Math.Sqrt(variance);
    }
}
