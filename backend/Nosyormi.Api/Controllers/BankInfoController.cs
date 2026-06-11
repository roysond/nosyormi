using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Domain.Entities;
using Nosyormi.Infrastructure.Chat;

namespace Nosyormi.Api.Controllers;

[ApiController]
[Route("api/bankinfo")]
public class BankInfoController : ControllerBase
{
    private readonly DbContext _db;
    private readonly BankDetectionService _bankDetection;

    public BankInfoController(DbContext db, BankDetectionService bankDetection)
    {
        _db = db;
        _bankDetection = bankDetection;
    }

    [HttpGet("{statementId:guid}")]
    public async Task<IActionResult> GetBankInfo(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var statement = await _db.Set<Statement>()
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(statement.BankName))
        {
            var cachedTransactions = await _db.Set<Transaction>()
                .Where(t => t.StatementId == statementId)
                .ToListAsync(cancellationToken);

            var statementPeriod = ComputeStatementPeriod(cachedTransactions);
            return Ok(new
            {
                bankName = statement.BankName,
                accountType = statement.AccountType,
                statementPeriod
            });
        }

        var transactions = await _db.Set<Transaction>()
            .Where(t => t.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var (bankName, accountType) = await _bankDetection.DetectAsync(
            statement.FileName, transactions, cancellationToken);

        statement.BankName = bankName;
        statement.AccountType = accountType;
        await _db.SaveChangesAsync(cancellationToken);

        var period = ComputeStatementPeriod(transactions);
        return Ok(new { bankName, accountType, statementPeriod = period });
    }

    private static string ComputeStatementPeriod(IReadOnlyList<Transaction> transactions)
    {
        if (transactions.Count == 0)
            return "–";

        var dates = transactions.Select(t => t.TransactionDate).ToList();
        var from = dates.Min().ToString("MMM yyyy");
        var to = dates.Max().ToString("MMM yyyy");
        return $"{from} – {to}";
    }
}
