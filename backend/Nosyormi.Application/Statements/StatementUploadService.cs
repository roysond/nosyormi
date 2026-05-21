using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Analysis;
using Nosyormi.Application.Categorization;
using Nosyormi.Application.Csv;
using Nosyormi.Application.Embeddings;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Application.Statements;

public class StatementUploadService
{
    private readonly ICsvStatementParser _parser;
    private readonly ICategoryClassifier _classifier;
    private readonly IAnomalyDetector _anomalyDetector;
    private readonly IEmbeddingService _embeddingService;
    private readonly DbContext _db;

    public StatementUploadService(
        ICsvStatementParser parser,
        ICategoryClassifier classifier,
        IAnomalyDetector anomalyDetector,
        IEmbeddingService embeddingService,
        DbContext db)
    {
        _parser = parser;
        _classifier = classifier;
        _anomalyDetector = anomalyDetector;
        _embeddingService = embeddingService;
        _db = db;
    }

    public async Task<StatementUploadResult> UploadAsync(
        string fileName,
        Stream csvStream,
        CancellationToken cancellationToken = default)
    {
        using var readBuffer = new MemoryStream();
        await csvStream.CopyToAsync(readBuffer, cancellationToken);
        var fileBytes = readBuffer.ToArray();

        var fileHash = Convert.ToHexString(SHA256.HashData(fileBytes)).ToLowerInvariant();

        var isDuplicate = await _db.Set<Statement>()
            .AnyAsync(s => s.FileHash == fileHash, cancellationToken);

        if (isDuplicate)
            throw new InvalidOperationException($"DUPLICATE_FILE_HASH:{fileHash}");

        await using var parseStream = new MemoryStream(fileBytes);

        // 1. Parse the CSV
        var rows = await _parser.ParseAsync(parseStream, cancellationToken);

        // 2. Create the statement record
        var statement = new Statement
        {
            Id = Guid.NewGuid(),
            FileName = fileName,
            FileHash = fileHash,
            UploadedAt = DateTime.UtcNow
        };

        // 3. Classify rows and convert into Transaction entities
        var transactions = new List<Transaction>();
        var categoryNamesById = new Dictionary<Guid, string>();

        foreach (var row in rows)
        {
            var result = await _classifier.ClassifyAsync(
                row.Description,
                row.Amount,
                cancellationToken);

            var category = await GetOrCreateCategoryAsync(result.Category, cancellationToken);

            categoryNamesById[category.Id] = category.Name;

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

        // 4. Detect anomalies
        var transactionInputs = transactions
            .Select(t => new TransactionInput(
                t.Id,
                categoryNamesById[t.CategoryId!.Value],
                t.Amount))
            .ToList();

        var anomalyResults = await _anomalyDetector.DetectAsync(
            transactionInputs,
            cancellationToken);

        var transactionsById = transactions.ToDictionary(t => t.Id);

        foreach (var result in anomalyResults.Where(r => r.IsAnomaly))
            transactionsById[result.TransactionId].IsAnomaly = true;

        // 5. Generate embeddings
        foreach (var transaction in transactions)
        {
            var embedding = await _embeddingService.GetEmbeddingAsync(
                transaction.Description,
                cancellationToken);

            transaction.Embedding = embedding;
        }

        // 6. Save everything in one transaction
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
