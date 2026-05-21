using Nosyormi.Application.Analysis;
using Nosyormi.Infrastructure.Analysis;
using Xunit;

namespace Nosyormi.Tests.Analysis;

public class ForecastingServiceTests
{
    private readonly IForecastingService _service = new MovingAverageForecastingService();

    [Fact]
    public async Task ForecastAsync_WithConsistentSpending_ReturnsForecastPerCategory()
    {
        // Arrange: consistent monthly spending across categories
        var transactions = new List<MonthlySpend>
        {
            new("Food", 2024, 1, 300m),
            new("Food", 2024, 2, 320m),
            new("Food", 2024, 3, 310m),
            new("Transport", 2024, 1, 100m),
            new("Transport", 2024, 2, 110m),
            new("Transport", 2024, 3, 105m),
        };

        // Act
        var results = await _service.ForecastAsync(transactions, CancellationToken.None);

        // Assert: one forecast result per category
        Assert.Contains(results, r => r.Category == "Food");
        Assert.Contains(results, r => r.Category == "Transport");
    }

    [Fact]
    public async Task ForecastAsync_WithEmptyInput_ReturnsEmptyResults()
    {
        // Arrange
        var transactions = new List<MonthlySpend>();

        // Act
        var results = await _service.ForecastAsync(transactions, CancellationToken.None);

        // Assert
        Assert.Empty(results);
    }

    [Fact]
    public async Task ForecastAsync_ForecastedAmountIsPositive()
    {
        // Arrange
        var transactions = new List<MonthlySpend>
        {
            new("Food", 2024, 1, 300m),
            new("Food", 2024, 2, 320m),
            new("Food", 2024, 3, 310m),
        };

        // Act
        var results = await _service.ForecastAsync(transactions, CancellationToken.None);

        // Assert: forecasted amounts must be positive numbers
        Assert.All(results, r => Assert.True(r.ForecastedAmount > 0));
    }

    [Fact]
    public async Task ForecastAsync_WithSingleMonth_StillReturnsForecast()
    {
        // Arrange: only one month of data
        var transactions = new List<MonthlySpend>
        {
            new("Food", 2024, 1, 300m),
        };

        // Act
        var results = await _service.ForecastAsync(transactions, CancellationToken.None);

        // Assert: should still produce a forecast, not crash
        Assert.NotEmpty(results);
    }

    [Fact]
    public async Task ForecastAsync_ForecastReasonablyCloseToAverage()
    {
        // Arrange: perfectly consistent spending of 300 per month
        var transactions = new List<MonthlySpend>
        {
            new("Food", 2024, 1, 300m),
            new("Food", 2024, 2, 300m),
            new("Food", 2024, 3, 300m),
        };

        // Act
        var results = await _service.ForecastAsync(transactions, CancellationToken.None);
        var foodForecast = results.First(r => r.Category == "Food");

        // Assert: forecast should be within 20% of the actual average (300)
        Assert.InRange(foodForecast.ForecastedAmount, 240m, 360m);
    }
}
