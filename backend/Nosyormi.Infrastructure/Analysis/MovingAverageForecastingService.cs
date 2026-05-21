using Nosyormi.Application.Analysis;

namespace Nosyormi.Infrastructure.Analysis;

public class MovingAverageForecastingService : IForecastingService
{
    public Task<IReadOnlyList<CategoryForecast>> ForecastAsync(
        IReadOnlyList<MonthlySpend> transactions,
        CancellationToken cancellationToken = default)
    {
        var forecasts = transactions
            .GroupBy(t => t.Category)
            .Select(BuildCategoryForecast)
            .OrderByDescending(f => f.ForecastedAmount)
            .ToList();

        return Task.FromResult<IReadOnlyList<CategoryForecast>>(forecasts);
    }

    private static CategoryForecast BuildCategoryForecast(IGrouping<string, MonthlySpend> categoryGroup)
    {
        var monthlyTotals = categoryGroup
            .OrderBy(m => m.Year)
            .ThenBy(m => m.Month)
            .Select(m => m.Amount)
            .ToList();

        var actualAverage = CalculateActualAverage(monthlyTotals);
        var forecastedAmount = CalculateWeightedForecast(monthlyTotals);

        return new CategoryForecast(
            categoryGroup.Key,
            actualAverage,
            forecastedAmount,
            monthlyTotals.Count);
    }

    private static decimal CalculateActualAverage(IReadOnlyList<decimal> monthlyTotals)
    {
        if (monthlyTotals.Count == 0)
            return 0;

        var average = monthlyTotals.Average();
        return Math.Round(average, 2);
    }

    private static decimal CalculateWeightedForecast(IReadOnlyList<decimal> monthlyTotals)
    {
        if (monthlyTotals.Count == 0)
            return 0;

        decimal forecast = monthlyTotals.Count switch
        {
            1 => monthlyTotals[0],
            2 => CalculateTwoMonthForecast(monthlyTotals),
            _ => CalculateThreePlusMonthForecast(monthlyTotals)
        };

        return Math.Round(forecast, 2);
    }

    private static decimal CalculateTwoMonthForecast(IReadOnlyList<decimal> monthlyTotals) =>
        (monthlyTotals[0] * 0.4m) + (monthlyTotals[1] * 0.6m);

    private static decimal CalculateThreePlusMonthForecast(IReadOnlyList<decimal> monthlyTotals)
    {
        var oldest = monthlyTotals[0];
        var mostRecent = monthlyTotals[^1];
        var middleAverage = monthlyTotals
            .Skip(1)
            .Take(monthlyTotals.Count - 2)
            .Average();

        return (oldest * 0.2m) + (middleAverage * 0.3m) + (mostRecent * 0.5m);
    }
}
