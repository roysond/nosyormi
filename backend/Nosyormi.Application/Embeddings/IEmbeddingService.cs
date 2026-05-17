namespace Nosyormi.Application.Embeddings;

public interface IEmbeddingService
{
    Task<float[]> GetEmbeddingAsync(
        string text,
        CancellationToken cancellationToken = default);
}
