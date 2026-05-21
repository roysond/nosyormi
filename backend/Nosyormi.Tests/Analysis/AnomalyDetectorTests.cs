using Nosyormi.Application.Analysis;
using Nosyormi.Infrastructure.Analysis;
using Xunit;

namespace Nosyormi.Tests.Analysis;

public class AnomalyDetectorTests
{
    private readonly IAnomalyDetector _detector = new ZScoreAnomalyDetector();

    [Fact]
    public async Task DetectAsync_WithNormalTransactions_ReturnsNoAnomalies()
    {
        // Arrange: all transactions are similar amounts
        var transactions = new List<TransactionInput>
        {
            new(Guid.NewGuid(), "Food", -50m),
            new(Guid.NewGuid(), "Food", -55m),
            new(Guid.NewGuid(), "Food", -48m),
            new(Guid.NewGuid(), "Food", -52m),
            new(Guid.NewGuid(), "Food", -51m),
        };

        // Act
        var results = await _detector.DetectAsync(transactions, CancellationToken.None);

        // Assert: no anomalies in a uniform dataset
        Assert.All(results, r => Assert.False(r.IsAnomaly));
    }

    [Fact]
    public async Task DetectAsync_WithOneExtremeOutlier_FlagsItAsAnomaly()
    {
        // Arrange: one transaction is 10x the normal amount
        var outlierTransactionId = Guid.NewGuid();
        var transactions = new List<TransactionInput>
        {
            new(Guid.NewGuid(), "Food", -50m),
            new(Guid.NewGuid(), "Food", -55m),
            new(Guid.NewGuid(), "Food", -48m),
            new(Guid.NewGuid(), "Food", -52m),
            new(Guid.NewGuid(), "Food", -51m),
            new(outlierTransactionId, "Food", -500m), // extreme outlier
        };

        // Act
        var results = await _detector.DetectAsync(transactions, CancellationToken.None);

        // Assert: only the outlier is flagged
        var outlierResult = results.First(r => r.TransactionId == outlierTransactionId);
        Assert.True(outlierResult.IsAnomaly);
    }

    [Fact]
    public async Task DetectAsync_WithEmptyList_ReturnsEmptyResults()
    {
        // Arrange
        var transactions = new List<TransactionInput>();

        // Act
        var results = await _detector.DetectAsync(transactions, CancellationToken.None);

        // Assert
        Assert.Empty(results);
    }

    [Fact]
    public async Task DetectAsync_WithSingleTransaction_ReturnsNoAnomaly()
    {
        // Arrange: cannot compute Z-score with only one value
        var transactions = new List<TransactionInput>
        {
            new(Guid.NewGuid(), "Food", -100m),
        };

        // Act
        var results = await _detector.DetectAsync(transactions, CancellationToken.None);

        // Assert: single transaction cannot be an anomaly
        Assert.All(results, r => Assert.False(r.IsAnomaly));
    }

    [Fact]
    public async Task DetectAsync_ResultCountMatchesInputCount()
    {
        // Arrange
        var transactions = new List<TransactionInput>
        {
            new(Guid.NewGuid(), "Food", -50m),
            new(Guid.NewGuid(), "Shopping", -200m),
            new(Guid.NewGuid(), "Transport", -30m),
        };

        // Act
        var results = await _detector.DetectAsync(transactions, CancellationToken.None);

        // Assert: one result per input transaction
        Assert.Equal(transactions.Count, results.Count);
    }
}
