using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Analysis;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Infrastructure.Analysis;

public class TimeSeriesService : ITimeSeriesService
{
    private const int DailyThresholdDays = 90;
    private const int MonthlyThresholdDays = 548;

    private readonly DbContext _db;

    public TimeSeriesService(DbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<TimeSeriesPoint>> GetTimeSeriesAsync(
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var transactions = await _db.Set<Transaction>()
            .Where(t => t.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var validTransactions = transactions
            .Where(t => t.TransactionDate != default)
            .ToList();

        if (validTransactions.Count == 0)
            return [];

        var earliest = validTransactions.Min(t => t.TransactionDate);
        var latest = validTransactions.Max(t => t.TransactionDate);
        var granularity = DetermineGranularity(earliest, latest);

        var points = validTransactions
            .GroupBy(t => FormatPeriod(t.TransactionDate, granularity))
            .Select(group => BuildTimeSeriesPoint(group, granularity))
            .OrderBy(point => point.Period)
            .ToList();

        return points;
    }

    private static string DetermineGranularity(DateOnly earliest, DateOnly latest)
    {
        var dayCount = latest.DayNumber - earliest.DayNumber;

        if (dayCount < DailyThresholdDays)
            return "daily";

        if (dayCount < MonthlyThresholdDays)
            return "monthly";

        return "yearly";
    }

    private static string FormatPeriod(DateOnly date, string granularity) => granularity switch
    {
        "daily"   => date.ToString("yyyy-MM-dd"),
        "monthly" => date.ToString("yyyy-MM"),
        "yearly"  => date.ToString("yyyy"),
        _         => date.ToString("yyyy-MM")
    };

    private static TimeSeriesPoint BuildTimeSeriesPoint(
        IGrouping<string, Transaction> group,
        string granularity)
    {
        var totalSpend = Math.Round(
            group.Where(t => t.Amount < 0).Sum(t => Math.Abs(t.Amount)),
            2);

        var totalIncome = Math.Round(
            group.Where(t => t.Amount > 0).Sum(t => t.Amount),
            2);

        return new TimeSeriesPoint(
            group.Key,
            granularity,
            totalSpend,
            totalIncome,
            group.Count());
    }
}
