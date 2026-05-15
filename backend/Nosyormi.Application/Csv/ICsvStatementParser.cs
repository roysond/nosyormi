namespace Nosyormi.Application.Csv;

public interface ICsvStatementParser
{
    Task<IReadOnlyList<ParsedTransactionRow>> ParseAsync(
        Stream csvStream,
        CancellationToken cancellationToken = default);
}
