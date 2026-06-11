using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nosyormi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBankInfoToStatement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "Statements",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "Statements",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "Statements");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "Statements");
        }
    }
}
