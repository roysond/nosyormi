namespace Nosyormi.Application.Analysis;

public record TimeSeriesPoint(
    string Period,
    string Granularity,
    decimal TotalSpend,
    decimal TotalIncome,
    int TransactionCount);

public interface ITimeSeriesService
{
    Task<IReadOnlyList<TimeSeriesPoint>> GetTimeSeriesAsync(
        Guid statementId,
        CancellationToken cancellationToken = default);
}
