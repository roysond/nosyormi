using Microsoft.EntityFrameworkCore;
using Nosyormi.Domain.Entities;

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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");
        base.OnModelCreating(modelBuilder);
    }
}