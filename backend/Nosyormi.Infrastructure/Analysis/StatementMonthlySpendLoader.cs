using Microsoft.EntityFrameworkCore;
using Nosyormi.Application.Analysis;
using Nosyormi.Domain.Entities;

namespace Nosyormi.Infrastructure.Analysis;

public static class StatementMonthlySpendLoader
{
    private const string IncomeCategory = "Income";

    public static async Task<IReadOnlyList<MonthlySpend>> LoadAsync(
        DbContext db,
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var transactions = await db.Set<Transaction>()
            .Include(t => t.Category)
            .Where(t => t.StatementId == statementId)
            .Where(t => t.Amount < 0)
            .Where(t => t.Category != null && t.Category.Name != IncomeCategory)
            .ToListAsync(cancellationToken);

        return transactions
            .GroupBy(t => new { Category = t.Category!.Name, t.TransactionDate.Year, t.TransactionDate.Month })
            .Select(g => new MonthlySpend(
                g.Key.Category,
                g.Key.Year,
                g.Key.Month,
                g.Sum(t => Math.Abs(t.Amount))))
            .ToList();
    }
}
