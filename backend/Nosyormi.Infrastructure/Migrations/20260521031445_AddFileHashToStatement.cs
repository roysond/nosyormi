using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nosyormi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFileHashToStatement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileHash",
                table: "Statements",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Statements_FileHash",
                table: "Statements",
                column: "FileHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Statements_FileHash",
                table: "Statements");

            migrationBuilder.DropColumn(
                name: "FileHash",
                table: "Statements");
        }
    }
}
