namespace Nosyormi.Domain.Entities;

/// <summary>
/// One recorded call to an LLM provider. Property names follow the
/// OpenTelemetry GenAI semantic conventions so this data can later be
/// exported to an OTLP collector without remapping.
/// </summary>
public class LlmCall
{
    public Guid Id { get; set; }
    public DateTime Timestamp { get; set; }          // UTC

    // OTel: gen_ai.system  — the provider
    public string System { get; set; } = "openrouter";

    // OTel: gen_ai.operation.name — "categorize" | "chat" | "embeddings" | "narrate" | "bank_detect"
    public string OperationName { get; set; } = string.Empty;

    // OTel: gen_ai.request.model — what we asked for
    public string RequestModel { get; set; } = string.Empty;

    // OTel: gen_ai.response.model — what the provider actually served
    public string? ResponseModel { get; set; }

    // OTel: gen_ai.usage.input_tokens / gen_ai.usage.output_tokens
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }

    // OTel: gen_ai.client.operation.duration (recorded in ms)
    public double DurationMs { get; set; }

    // OTel: error.type — null when the call succeeded
    public string? ErrorType { get; set; }
    public bool IsSuccess { get; set; }

    // Application-specific correlation, not part of the OTel spec
    public Guid? StatementId { get; set; }

    // Derived at write time from a configured price table
    public decimal EstimatedCostUsd { get; set; }
}
