using System.Linq;
using Microsoft.EntityFrameworkCore;
using Nosyormi.Domain.Entities;
using Pgvector;

namespace Nosyormi.Infrastructure.Persistence;

public class NosyormiDbContext : DbContext
{
    public NosyormiDbContext(DbContextOptions<NosyormiDbContext> options)
        : base(options)
    {
    }

    public DbSet<Statement> Statements => Set<Statement>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<LlmCall> LlmCalls => Set<LlmCall>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.Entity<Transaction>()
            .Property(t => t.Embedding)
            .HasColumnType("vector(1536)")
            .HasConversion(
                v => new Pgvector.Vector(v!),
                v => v.ToArray()
            )
            .Metadata.SetValueComparer(
                new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<float[]>(
                    (a, b) => a != null && b != null && a.SequenceEqual(b),
                    v => v.Aggregate(0, (a, e) => HashCode.Combine(a, e.GetHashCode())),
                    v => v.ToArray()
                )
            );

        modelBuilder.Entity<Statement>()
            .Property(s => s.FileHash)
            .HasMaxLength(64)
            .IsRequired();

        modelBuilder.Entity<Statement>()
            .HasIndex(s => s.FileHash)
            .IsUnique();

        modelBuilder.Entity<LlmCall>()
            .HasIndex(c => c.Timestamp)
            .IsDescending();

        modelBuilder.Entity<LlmCall>()
            .HasIndex(c => c.StatementId);

        base.OnModelCreating(modelBuilder);
    }
}