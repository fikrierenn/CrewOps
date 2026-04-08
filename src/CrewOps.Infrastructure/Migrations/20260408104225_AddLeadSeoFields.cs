using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CrewOps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeadSeoFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SeoReport",
                table: "Leads",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SeoScore",
                table: "Leads",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SeoReport",
                table: "Leads");

            migrationBuilder.DropColumn(
                name: "SeoScore",
                table: "Leads");
        }
    }
}
