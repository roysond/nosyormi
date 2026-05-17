using Microsoft.EntityFrameworkCore;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Application.Statements;

public class StatementQueryService
{
    private readonly DbContext _db;

    public StatementQueryService(DbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<StatementSummary>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        return await _db.Set<Statement>()
            .OrderByDescending(s => s.UploadedAt)
            .Select(s => new StatementSummary(
                s.Id,
                s.FileName,
                s.UploadedAt,
                _db.Set<Transaction>().Count(t => t.StatementId == s.Id)
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<StatementDetail?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.Set<Statement>()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (statement is null)
            return null;

        var transactions = await _db.Set<Transaction>()
            .Where(t => t.StatementId == id)
            .OrderBy(t => t.TransactionDate)
            .Select(t => new TransactionSummary(
                t.Id,
                t.TransactionDate,
                t.Description,
                t.Amount,
                t.IsAnomaly,
                t.Category != null ? t.Category.Name : "Other"
            ))
            .ToListAsync(cancellationToken);

        return new StatementDetail(
            statement.Id,
            statement.FileName,
            statement.UploadedAt,
            transactions
        );
    }
}

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