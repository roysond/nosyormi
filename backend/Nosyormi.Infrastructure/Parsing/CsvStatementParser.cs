using System.Globalization;
using System.Text;
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
            BadDataFound = null,
            PrepareHeaderForMatch = args => args.Header.ToLowerInvariant()
        };

        var headerReader = await CreateReaderStartingAtHeaderAsync(csvStream);
        if (headerReader is null)
            throw new InvalidOperationException("CSV header row containing 'Date' was not found.");

        using var headerTextReader = headerReader;
        using var csv = new CsvReader(headerTextReader, config);

        var rows = new List<ParsedTransactionRow>();

        await csv.ReadAsync();
        csv.ReadHeader();

        while (await csv.ReadAsync())
        {
            var rawDate = csv.GetField("Date") ?? csv.GetField("DATE") ?? csv.GetField("date");
            if (string.IsNullOrWhiteSpace(rawDate))
                continue;

            var row = new ParsedTransactionRow
            {
                TransactionDate = ParseDate(rawDate),
                Description = ParseDescription(csv),
                Amount = ParseAmountFromRow(csv)
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

    private static async Task<TextReader?> CreateReaderStartingAtHeaderAsync(Stream csvStream)
    {
        using var reader = new StreamReader(csvStream);
        var csvContent = new StringBuilder();

        while (await reader.ReadLineAsync() is { } line)
        {
            if (!IsHeaderLine(line))
                continue;

            csvContent.AppendLine(line);
            while (await reader.ReadLineAsync() is { } remainingLine)
                csvContent.AppendLine(remainingLine);

            return new StringReader(csvContent.ToString());
        }

        return null;
    }

    private static bool IsHeaderLine(string line)
    {
        var lineConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = false,
            TrimOptions = TrimOptions.Trim,
            MissingFieldFound = null,
            BadDataFound = null
        };

        using var lineReader = new StringReader(line);
        using var csv = new CsvReader(lineReader, lineConfig);

        if (!csv.Read())
            return false;

        return csv.Parser.Record?.Any(field =>
            field?.Trim().Equals("Date", StringComparison.OrdinalIgnoreCase) == true) == true;
    }

    private static string ParseDescription(CsvReader csv)
    {
        var description = (csv.GetField("Description") ?? csv.GetField("DESCRIPTION"))?.Trim();
        if (!string.IsNullOrWhiteSpace(description))
            return description;

        var payeeName = csv.GetField("Payee Name")?.Trim();
        var memo = csv.GetField("Memo")?.Trim();

        if (string.IsNullOrWhiteSpace(payeeName) && string.IsNullOrWhiteSpace(memo))
            return string.Empty;

        if (string.IsNullOrWhiteSpace(payeeName))
            return memo!;

        if (string.IsNullOrWhiteSpace(memo))
            return payeeName;

        return CombinePayeeAndMemo(payeeName, memo);
    }

    private static string CombinePayeeAndMemo(string payeeName, string memo)
    {
        var combined = $"{payeeName} - {memo}".Trim();
        combined = NormalizeWhitespace(combined);

        var words = combined.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var dedupedWords = new List<string>(words.Length);

        foreach (var word in words)
        {
            if (seen.Add(word))
                dedupedWords.Add(word);
        }

        return string.Join(' ', dedupedWords);
    }

    private static string NormalizeWhitespace(string value) =>
        string.Join(' ', value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

    private static decimal ParseAmountFromRow(CsvReader csv)
    {
        if (TryParseAmount(csv.GetField("Amount"), out var amount))
            return amount;

        var headers = csv.HeaderRecord;
        if (headers is null)
            return 0;

        foreach (var header in headers)
        {
            if (header.Equals("Amount", StringComparison.OrdinalIgnoreCase))
                continue;

            if (header.Equals("Running Bal.", StringComparison.OrdinalIgnoreCase)
                || header.Equals("Running Bal", StringComparison.OrdinalIgnoreCase))
                continue;

            var fieldValue = csv.GetField(header);
            if (TryParseAmount(fieldValue, out amount) && LooksLikeAmount(fieldValue))
                return amount;
        }

        return 0;
    }

    private static bool LooksLikeAmount(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();
        return trimmed.Contains('$')
            || (trimmed.StartsWith('(') && trimmed.EndsWith(')'))
            || decimal.TryParse(
                trimmed.Replace("$", string.Empty).Replace(",", string.Empty).Trim('(', ')'),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out _);
    }

    private static bool TryParseAmount(string? value, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var normalized = value.Replace("$", string.Empty).Replace(",", string.Empty).Trim();
        var isNegative = normalized.StartsWith('(') && normalized.EndsWith(')');
        if (isNegative)
            normalized = normalized.Trim('(', ')');

        if (!decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            return false;

        amount = isNegative ? -parsed : parsed;
        return true;
    }

    private static decimal ParseAmount(string? value)
    {
        return TryParseAmount(value, out var amount) ? amount : 0;
    }
}