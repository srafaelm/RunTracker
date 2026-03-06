using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Web.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/settings").RequireAuthorization();

        // GET /api/settings/strava — returns current credentials (secret is masked)
        group.MapGet("/strava", async (IApplicationDbContext db) =>
        {
            var settings = await db.SystemSettings.FindAsync(1);
            return Results.Ok(new
            {
                clientId = settings?.StravaClientId ?? "",
                hasSecret = !string.IsNullOrWhiteSpace(settings?.StravaClientSecret)
            });
        });

        // PUT /api/settings/strava — update Strava API credentials
        group.MapPut("/strava", async (
            IApplicationDbContext db,
            [FromBody] UpdateStravaCredentialsRequest request) =>
        {
            var settings = await db.SystemSettings.FindAsync(1);
            if (settings is null)
            {
                // Should not happen due to seed, but handle gracefully
                return Results.NotFound("System settings not initialised.");
            }

            if (request.ClientId is not null)
                settings.StravaClientId = request.ClientId.Trim();

            // Only update secret if a non-empty value is provided
            if (!string.IsNullOrWhiteSpace(request.ClientSecret))
                settings.StravaClientSecret = request.ClientSecret.Trim();

            await db.SaveChangesAsync(CancellationToken.None);

            return Results.Ok(new
            {
                clientId = settings.StravaClientId ?? "",
                hasSecret = !string.IsNullOrWhiteSpace(settings.StravaClientSecret)
            });
        });
    }
}

public record UpdateStravaCredentialsRequest(string? ClientId, string? ClientSecret);
