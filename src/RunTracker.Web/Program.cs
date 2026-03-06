using Microsoft.EntityFrameworkCore;
using RunTracker.Application;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Infrastructure;
using RunTracker.Infrastructure.Persistence;
using RunTracker.Web.Endpoints;
using RunTracker.Web.Services;

// dotnet ef migrations add InitialCreate --project src\RunTracker.Infrastructure --startup-project src\RunTracker.Web --output-dir Persistence\Migrations


var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddOpenApi();
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                builder.Configuration["Frontend:Url"] ?? "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Serve static files early so assets are handled before auth/endpoint middleware
app.UseDefaultFiles();
app.UseStaticFiles();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Map endpoints
app.MapAuthEndpoints();
app.MapActivityEndpoints();
app.MapStatisticsEndpoints();
app.MapWebhookEndpoints();
app.MapStreetEndpoints();
app.MapTrainingEndpoints();
app.MapTileEndpoints();
app.MapBadgeEndpoints();
app.MapTagEndpoints();
app.MapSocialEndpoints();
app.MapPlannedRouteEndpoints();
app.MapGearEndpoints();
app.MapAbsenceEndpoints();
app.MapDashboardEndpoints();
app.MapBenchmarkEndpoints();
app.MapSettingsEndpoints();
app.MapGoalEndpoints();
app.MapWeightEndpoints();
app.MapUserTemplateEndpoints();

app.MapFallbackToFile("index.html");

// Initialise database (migrate + seed)
var dbSetup = app.Services.GetRequiredService<RunTracker.Infrastructure.Services.DatabaseSetupService>();
await dbSetup.InitialiseAsync();

app.Run();
