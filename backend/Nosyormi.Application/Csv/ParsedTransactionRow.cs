namespace Nosyormi.Application.Csv;

public class ParsedTransactionRow
{
    public DateOnly TransactionDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}