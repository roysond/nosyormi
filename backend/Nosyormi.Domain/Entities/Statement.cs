namespace Nosyormi.Domain.Entities;

public class Statement
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileHash { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public string? Narration { get; set; }
}