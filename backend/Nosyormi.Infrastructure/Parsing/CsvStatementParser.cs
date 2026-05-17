using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Nosyormi.Application.Csv;

namespace Nosyormi.Infrastructure.Parsing;

public class CsvStatementParser : ICsvStatementParser
{
    public async Task<IReadOnlyList<ParsedTransactionRow>> ParseAsync(
        Stream csvStream,
        CancellationToken cancellationToken = default)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            TrimOptions = TrimOptions.Trim,
            MissingFieldFound = null,
            BadDataFound = null
        };

        using var reader = new StreamReader(csvStream);
        using var csv = new CsvReader(reader, config);

        var rows = new List<ParsedTransactionRow>();

        await csv.ReadAsync();
        csv.ReadHeader();

        while (await csv.ReadAsync())
        {
            var row = new ParsedTransactionRow
            {
                TransactionDate = ParseDate(csv.GetField("Date") ?? string.Empty),
                Description = csv.GetField("Description") ?? string.Empty,
                Amount = ParseAmount(csv.GetField("Amount"))
            };

            rows.Add(row);
        }

        return rows;
    }

    private static DateOnly ParseDate(string rawDate)
    {
        var formats = new[]
        {
            "MM/dd/yyyy",
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "dd-MMM-yyyy",
            "MMM dd, yyyy",
            "M/d/yyyy",
            "d/M/yyyy"
        };

        var trimmed = rawDate.Trim();

        foreach (var format in formats)
        {
            if (DateOnly.TryParseExact(trimmed, format,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out var result))
            {
                return result;
            }
        }

        throw new FormatException($"Unable to parse date '{rawDate}'. Supported formats: MM/dd/yyyy, yyyy-MM-dd, dd/MM/yyyy, dd-MMM-yyyy.");
    }

    private static decimal ParseAmount(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return 0;

        // Strip currency symbols and spaces, handle parentheses as negatives
        value = value.Replace("$", "").Replace(",", "").Trim();

        bool isNegative = value.StartsWith("(") && value.EndsWith(")");
        if (isNegative)
            value = value.Trim('(', ')');

        if (decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount))
        {
            return isNegative ? -amount : amount;
        }

        return 0;
    }
}