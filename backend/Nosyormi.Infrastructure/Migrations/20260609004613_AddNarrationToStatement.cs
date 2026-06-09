using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nosyormi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNarrationToStatement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Narration",
                table: "Statements",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Narration",
                table: "Statements");
        }
    }
}
