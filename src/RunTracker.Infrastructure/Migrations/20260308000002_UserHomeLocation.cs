using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RunTracker.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UserHomeLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HomeAddress",
                table: "AspNetUsers",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "HomeLat",
                table: "AspNetUsers",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "HomeLng",
                table: "AspNetUsers",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "HomeAddress", table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "HomeLat",     table: "AspNetUsers");
            migrationBuilder.DropColumn(name: "HomeLng",     table: "AspNetUsers");
        }
    }
}
