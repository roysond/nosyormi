using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nosyormi.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLlmCallTelemetry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LlmCalls",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    System = table.Column<string>(type: "text", nullable: false),
                    OperationName = table.Column<string>(type: "text", nullable: false),
                    RequestModel = table.Column<string>(type: "text", nullable: false),
                    ResponseModel = table.Column<string>(type: "text", nullable: true),
                    InputTokens = table.Column<int>(type: "integer", nullable: false),
                    OutputTokens = table.Column<int>(type: "integer", nullable: false),
                    DurationMs = table.Column<double>(type: "double precision", nullable: false),
                    ErrorType = table.Column<string>(type: "text", nullable: true),
                    IsSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    StatementId = table.Column<Guid>(type: "uuid", nullable: true),
                    EstimatedCostUsd = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LlmCalls", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LlmCalls_StatementId",
                table: "LlmCalls",
                column: "StatementId");

            migrationBuilder.CreateIndex(
                name: "IX_LlmCalls_Timestamp",
                table: "LlmCalls",
                column: "Timestamp",
                descending: new bool[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LlmCalls");
        }
    }
}
