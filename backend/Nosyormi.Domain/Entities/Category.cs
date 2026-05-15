namespace Nosyormi.Domain.Entities;

public class Category
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? IconKey { get; set; }

    // Navigation: a category has many transactions
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}