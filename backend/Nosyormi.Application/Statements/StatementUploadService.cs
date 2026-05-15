using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Csv;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Application.Statements;

public class StatementUploadService
{
    private readonly ICsvStatementParser _parser;
    private readonly DbContext _db;

    public StatementUploadService(ICsvStatementParser parser, DbContext db)
    {
        _parser = parser;
        _db = db;
    }

    public async Task<StatementUploadResult> UploadAsync(
        string fileName,
        Stream csvStream,
        CancellationToken cancellationToken = default)
    {
        // 1. Parse the CSV
        var rows = await _parser.ParseAsync(csvStream, cancellationToken);

        // 2. Create the statement record
        var statement = new Statement
        {
            Id = Guid.NewGuid(),
            FileName = fileName,
            UploadedAt = DateTime.UtcNow
        };

        // 3. Convert parsed rows into Transaction entities
        var transactions = rows.Select(r => new Transaction
        {
            Id = Guid.NewGuid(),
            StatementId = statement.Id,
            TransactionDate = r.TransactionDate,
            Description = r.Description,
            Amount = r.Amount,
            IsAnomaly = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        // 4. Save everything in one transaction
        _db.Add(statement);
        _db.AddRange(transactions);
        await _db.SaveChangesAsync(cancellationToken);

        return new StatementUploadResult(statement.Id, transactions.Count);
    }
}

public record StatementUploadResult(Guid StatementId, int TransactionCount);