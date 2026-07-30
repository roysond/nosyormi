namespace Nosyormi.Application.Telemetry;

public interface ILlmCallRecorder
{
    Task RecordAsync(
        string operationName,
        string requestModel,
        string? responseModel,
        int inputTokens,
        int outputTokens,
        double durationMs,
        bool isSuccess,
        string? errorType,
        Guid? statementId,
        CancellationToken cancellationToken = default);
}
