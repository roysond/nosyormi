namespace Nosyormi.Application.Analysis;

public interface IForecastingService
{
    Task<IReadOnlyList<CategoryForecast>> ForecastAsync(
        IReadOnlyList<MonthlySpend> transactions,
        CancellationToken cancellationToken = default);
}

public record MonthlySpend(string Category, int Year, int Month, decimal Amount);

public record CategoryForecast(
    string Category,
    decimal ActualAverage,
    decimal ForecastedAmount,
    int DataPointsUsed);
