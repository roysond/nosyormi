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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");
        base.OnModelCreating(modelBuilder);
    }
}