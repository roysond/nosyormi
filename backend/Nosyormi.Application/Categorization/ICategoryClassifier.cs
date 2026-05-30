namespace Nosyormi.Application.Categorization;

public interface ICategoryClassifier
{
    Task<CategoryResult> ClassifyAsync(
        string description,
        decimal amount,
        CancellationToken cancellationToken = default);
}

public record CategoryResult(string Category, float Confidence);

public static class CategoryTaxonomy
{
    public static readonly string[] All =
    [
        "Food & Groceries",
        "Transport & Fuel",
        "Parking & Tolls",
        "Subscriptions",
        "Shopping",
        "Utilities & Bills",
        "Income",
        "Healthcare",
        "Entertainment",
        "Dining & Takeaway",
        "Transfers & Payments",
        "ATM & Cash",
        "Other",
    ];
}
