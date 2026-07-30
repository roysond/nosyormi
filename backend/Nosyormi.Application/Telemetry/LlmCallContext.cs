using System.Threading;

namespace Nosyormi.Application.Telemetry;

/// <summary>
/// Ambient correlation context for LLM telemetry. Uses AsyncLocal so the
/// current statement id flows down the async call chain implicitly —
/// the same approach OpenTelemetry uses with Activity.Current. This keeps
/// the observability concern out of business interfaces such as
/// ICategoryClassifier and IEmbeddingService.
/// </summary>
public static class LlmCallContext
{
    private static readonly AsyncLocal<Guid?> _statementId = new();

    public static Guid? CurrentStatementId => _statementId.Value;

    /// <summary>Sets the ambient statement id until the returned scope is disposed.</summary>
    public static IDisposable BeginStatementScope(Guid statementId)
    {
        var previous = _statementId.Value;
        _statementId.Value = statementId;
        return new Scope(() => _statementId.Value = previous);
    }

    private sealed class Scope : IDisposable
    {
        private readonly Action _onDispose;
        private bool _disposed;
        public Scope(Action onDispose) => _onDispose = onDispose;
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _onDispose();
        }
    }
}
