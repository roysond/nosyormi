namespace Nosyormi.Domain.Entities;

public class Statement
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
}