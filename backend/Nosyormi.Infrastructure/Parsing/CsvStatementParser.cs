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
                TransactionDate = ParseDate(csv.GetField("Date")),
                Description = csv.GetField("Description") ?? string.Empty,
                Amount = ParseAmount(csv.GetField("Amount"))
            };

            rows.Add(row);
        }

        return rows;
    }

    private static DateOnly ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return DateOnly.MinValue;

        // Try common US formats first (per our locale default)
        string[] formats = { "MM/dd/yyyy", "M/d/yyyy", "yyyy-MM-dd" };

        if (DateOnly.TryParseExact(value, formats, CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var parsed))
        {
            return parsed;
        }

        return DateOnly.MinValue;
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