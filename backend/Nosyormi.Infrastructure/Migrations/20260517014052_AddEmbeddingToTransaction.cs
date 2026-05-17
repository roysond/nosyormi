using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace Nosyormi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEmbeddingToTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Vector>(
                name: "Embedding",
                table: "Transactions",
                type: "vector(1536)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Embedding",
                table: "Transactions");
        }
    }
}
