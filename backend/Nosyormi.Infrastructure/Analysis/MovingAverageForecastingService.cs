using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Analysis;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Infrastructure.Analysis;

public class MovingAverageForecastingService : IForecastingService
{
    private const string IncomeCategory = "Income";

    private readonly DbContext _db;

    public MovingAverageForecastingService(DbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CategoryForecast>> ForecastAsync(
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var transactions = await _db.Set<Transaction>()
            .Include(t => t.Category)
            .Where(t => t.StatementId == statementId)
            .Where(t => t.Amount < 0)
            .Where(t => t.Category != null && t.Category.Name != IncomeCategory)
            .ToListAsync(cancellationToken);

        var forecasts = transactions
            .GroupBy(t => t.Category!.Name)
            .Select(BuildCategoryForecast)
            .OrderByDescending(f => f.ForecastedAmount)
            .ToList();

        return forecasts;
    }

    private static CategoryForecast BuildCategoryForecast(IGrouping<string, Transaction> categoryGroup)
    {
        var monthlyTotals = GetMonthlyTotals(categoryGroup)
            .OrderBy(m => m.Year)
            .ThenBy(m => m.Month)
            .Select(m => m.Total)
            .ToList();

        var actualAverage = CalculateActualAverage(monthlyTotals);
        var forecastedAmount = CalculateWeightedForecast(monthlyTotals);

        return new CategoryForecast(
            categoryGroup.Key,
            actualAverage,
            forecastedAmount,
            monthlyTotals.Count);
    }

    private static IEnumerable<(int Year, int Month, decimal Total)> GetMonthlyTotals(
        IEnumerable<Transaction> transactions)
    {
        return transactions
            .GroupBy(t => new { t.TransactionDate.Year, t.TransactionDate.Month })
            .Select(g => (
                g.Key.Year,
                g.Key.Month,
                Total: g.Sum(t => Math.Abs(t.Amount))));
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
