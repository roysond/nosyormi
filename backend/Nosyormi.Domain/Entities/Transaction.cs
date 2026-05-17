namespace Nosyormi.Domain.Entities;

public class Transaction
{
    public Guid Id { get; set; }

    // Which uploaded statement did this transaction come from?
    public Guid StatementId { get; set; }
    public Statement Statement { get; set; } = null!;

    // What category did we sort it into? (nullable — may be uncategorized initially)
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }

    // Core transaction data
    public DateOnly TransactionDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // Anomaly flag — set by the Statistical Layer later
    public bool IsAnomaly { get; set; }

    public float[]? Embedding { get; set; }

    // When this row was created in our DB (audit trail)
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}