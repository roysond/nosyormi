namespace Nosyormi.Application.Analysis;

public interface IForecastingService
{
    Task<IReadOnlyList<CategoryForecast>> ForecastAsync(
        Guid statementId,
        CancellationToken cancellationToken = default);
}

public record CategoryForecast(
    string Category,
    decimal ActualAverage,
    decimal ForecastedAmount,
    int DataPointsUsed);
