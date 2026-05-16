using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Categorization;
using Nosyormi.Application.Csv;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Application.Statements;

public class StatementUploadService
{
    private readonly ICsvStatementParser _parser;
    private readonly ICategoryClassifier _classifier;
    private readonly DbContext _db;

    public StatementUploadService(
        ICsvStatementParser parser,
        ICategoryClassifier classifier,
        DbContext db)
    {
        _parser = parser;
        _classifier = classifier;
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

        // 3. Classify rows and convert into Transaction entities
        var transactions = new List<Transaction>();

        foreach (var row in rows)
        {
            var result = await _classifier.ClassifyAsync(
                row.Description,
                row.Amount,
                cancellationToken);

            var category = await GetOrCreateCategoryAsync(result.Category, cancellationToken);

            transactions.Add(new Transaction
            {
                Id = Guid.NewGuid(),
                StatementId = statement.Id,
                TransactionDate = row.TransactionDate,
                Description = row.Description,
                Amount = row.Amount,
                CategoryId = category.Id,
                IsAnomaly = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        // 4. Save everything in one transaction
        _db.Add(statement);
        _db.AddRange(transactions);
        await _db.SaveChangesAsync(cancellationToken);

        return new StatementUploadResult(statement.Id, transactions.Count);
    }

    private async Task<Category> GetOrCreateCategoryAsync(
        string categoryName,
        CancellationToken cancellationToken)
    {
        var tracked = _db.Set<Category>()
            .Local
            .FirstOrDefault(c => c.Name == categoryName);

        if (tracked is not null)
            return tracked;

        var existing = await _db.Set<Category>()
            .FirstOrDefaultAsync(c => c.Name == categoryName, cancellationToken);

        if (existing is not null)
            return existing;

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = categoryName
        };

        _db.Add(category);
        return category;
    }
}

public record StatementUploadResult(Guid StatementId, int TransactionCount);
