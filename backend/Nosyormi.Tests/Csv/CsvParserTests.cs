using Nosyormi.Application.Csv;
using Nosyormi.Infrastructure.Parsing;
using System.Text;
using Xunit;

namespace Nosyormi.Tests.Csv;

public class CsvParserTests
{
    private readonly ICsvStatementParser _parser = new CsvStatementParser();

    private static Stream ToStream(string content)
    {
        return new MemoryStream(Encoding.UTF8.GetBytes(content));
    }

    [Fact]
    public async Task ParseAsync_WithValidCsv_ReturnsCorrectRowCount()
    {
        // Arrange
        var csv = """
            Date,Description,Amount
            2024-01-01,Starbucks,-5.50
            2024-01-02,Salary,3200.00
            2024-01-03,Uber Eats,-24.50
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert
        Assert.Equal(3, rows.Count);
    }

    [Fact]
    public async Task ParseAsync_WithValidCsv_ParsesAmountsCorrectly()
    {
        // Arrange
        var csv = """
            Date,Description,Amount
            2024-01-01,Starbucks,-5.50
            2024-01-02,Salary,3200.00
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert
        Assert.Equal(-5.50m, rows[0].Amount);
        Assert.Equal(3200.00m, rows[1].Amount);
    }

    [Fact]
    public async Task ParseAsync_WithValidCsv_ParsesDatesCorrectly()
    {
        // Arrange
        var csv = """
            Date,Description,Amount
            2024-01-15,Groceries,-87.43
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert
        Assert.Equal(new DateOnly(2024, 1, 15), rows[0].TransactionDate);
    }

    [Fact]
    public async Task ParseAsync_WithValidCsv_ParsesDescriptionsCorrectly()
    {
        // Arrange
        var csv = """
            Date,Description,Amount
            2024-01-01,Amazon Purchase,-142.67
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert
        Assert.Equal("Amazon Purchase", rows[0].Description);
    }

    [Fact]
    public async Task ParseAsync_WithEmptyCsv_ReturnsEmptyList()
    {
        // Arrange: headers only, no data rows
        var csv = """
            Date,Description,Amount
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert
        Assert.Empty(rows);
    }

    [Fact]
    public async Task ParseAsync_WithNegativeAmounts_ParsesCorrectly()
    {
        // Arrange
        var csv = """
            Date,Description,Amount
            2024-01-01,Phone Bill,-65.00
            2024-01-02,Electric Bill,-89.12
            """;

        // Act
        var rows = await _parser.ParseAsync(ToStream(csv), CancellationToken.None);

        // Assert: expenses are negative
        Assert.All(rows, r => Assert.True(r.Amount < 0));
    }
}
