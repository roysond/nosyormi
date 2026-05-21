using Nosyormi.Domain.Entities;

namespace Nosyormi.Application.Statements;

public record StatementSummary(
    Guid Id,
    string FileName,
    DateTime UploadedAt,
    int TransactionCount);

public record StatementDetail(
    Guid Id,
    string FileName,
    DateTime UploadedAt,
    IReadOnlyList<TransactionSummary> Transactions);

public record TransactionSummary(
    Guid Id,
    DateOnly TransactionDate,
    string Description,
    decimal Amount,
    bool IsAnomaly,
    string? Category);

public interface IStatementQueryService
{
    Task<IReadOnlyList<StatementSummary>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<StatementDetail?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
