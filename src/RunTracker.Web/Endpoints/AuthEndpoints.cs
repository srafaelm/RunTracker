using System.Security.Claims;
using System.Threading.Channels;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;
using RunTracker.Infrastructure.Services;
using Microsoft.AspNetCore.Http;

namespace RunTracker.Web.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth");

        group.MapPost("/register", async (IIdentityService identityService, [FromBody] RegisterRequest request) =>
        {
            var (succeeded, userId, errors) = await identityService.RegisterAsync(request.Email, request.Password);
            return succeeded
                ? Results.Ok(new { UserId = userId })
                : Results.BadRequest(new { Errors = errors });
        });

        group.MapPost("/login", async (IIdentityService identityService, [FromBody] LoginRequest request) =>
        {
            var (succeeded, token, errors) = await identityService.LoginAsync(request.Email, request.Password);
            return succeeded
                ? Results.Ok(new { Token = token })
                : Results.Unauthorized();
        });

        group.MapGet("/me", async (ClaimsPrincipal user, UserManager<User> userManager, IApplicationDbContext db) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null) return Results.Unauthorized();

            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser is null) return Results.NotFound();

            var zones = appUser.MaxHeartRate.HasValue
                ? HrZoneCalculator.GetZones(appUser.HrZoneAlgorithm, appUser.MaxHeartRate.Value, appUser.RestingHeartRate ?? 60, appUser.CustomHrZones)
                : null;

            var totalActivities = appUser.StravaAthleteId.HasValue
                ? await db.Activities.CountAsync(a => a.UserId == userId)
                : (int?)null;

            return Results.Ok(new
            {
                appUser.Id,
                appUser.Email,
                appUser.UserName,
                appUser.DisplayName,
                appUser.Bio,
                appUser.WeightKg,
                appUser.GoalWeightKg,
                appUser.HeightCm,
                appUser.MaxHeartRate,
                appUser.RestingHeartRate,
                appUser.HrZoneAlgorithm,
                appUser.Gender,
                appUser.BirthYear,
                appUser.BirthMonth,
                appUser.BirthDay,
                appUser.ProfilePictureUrl,
                appUser.DashboardConfig,
                appUser.CustomHrZones,
                appUser.HiddenSportTypes,
                appUser.HomeAddress,
                appUser.HomeLat,
                appUser.HomeLng,
                StravaConnected = appUser.StravaAthleteId.HasValue,
                appUser.StravaAthleteId,
                HrZones = zones,
                StravaSyncStatus = appUser.StravaAthleteId.HasValue ? new
                {
                    appUser.StravaHistoricalSyncComplete,
                    appUser.StravaHistoricalSyncCursor,
                    appUser.StravaNewestSyncedAt,
                    TotalActivities = totalActivities,
                } : null,
            });
        }).RequireAuthorization();

        group.MapPut("/profile", async (
            ClaimsPrincipal user,
            UserManager<User> userManager,
            [Microsoft.AspNetCore.Mvc.FromBody] UpdateProfileRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null) return Results.Unauthorized();

            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser is null) return Results.NotFound();

            // Update username if provided and different from current
            if (!string.IsNullOrWhiteSpace(request.Username) && request.Username != appUser.UserName)
            {
                var usernameResult = await userManager.SetUserNameAsync(appUser, request.Username.Trim());
                if (!usernameResult.Succeeded)
                    return Results.BadRequest(new { Errors = usernameResult.Errors.Select(e => e.Description) });
            }

            if (request.DisplayName != null)
                appUser.DisplayName = request.DisplayName;
            if (request.Bio != null)
                appUser.Bio = request.Bio;
            if (request.WeightKg.HasValue)
                appUser.WeightKg = request.WeightKg;
            if (request.HeightCm.HasValue)
                appUser.HeightCm = request.HeightCm;
            if (request.MaxHeartRate.HasValue)
                appUser.MaxHeartRate = request.MaxHeartRate;
            if (request.RestingHeartRate.HasValue)
                appUser.RestingHeartRate = request.RestingHeartRate;
            if (request.HrZoneAlgorithm.HasValue)
                appUser.HrZoneAlgorithm = request.HrZoneAlgorithm.Value;
            if (request.Gender.HasValue)
                appUser.Gender = request.Gender.Value;
            if (request.BirthYear.HasValue)
                appUser.BirthYear = request.BirthYear;
            if (request.BirthMonth.HasValue)
                appUser.BirthMonth = request.BirthMonth;
            if (request.BirthDay.HasValue)
                appUser.BirthDay = request.BirthDay;
            if (request.DashboardConfig != null)
                appUser.DashboardConfig = request.DashboardConfig;
            if (request.CustomHrZones != null)
                appUser.CustomHrZones = request.CustomHrZones;
            if (request.HiddenSportTypes != null)
                appUser.HiddenSportTypes = request.HiddenSportTypes;
            if (request.GoalWeightKg.HasValue)
                appUser.GoalWeightKg = request.GoalWeightKg;
            if (request.HomeAddress != null)
                appUser.HomeAddress = request.HomeAddress;
            if (request.HomeLat.HasValue)
                appUser.HomeLat = request.HomeLat;
            if (request.HomeLng.HasValue)
                appUser.HomeLng = request.HomeLng;

            await userManager.UpdateAsync(appUser);

            var zones = appUser.MaxHeartRate.HasValue
                ? HrZoneCalculator.GetZones(appUser.HrZoneAlgorithm, appUser.MaxHeartRate.Value, appUser.RestingHeartRate ?? 60, appUser.CustomHrZones)
                : null;

            return Results.Ok(new
            {
                appUser.Id,
                appUser.Email,
                appUser.UserName,
                appUser.DisplayName,
                appUser.Bio,
                appUser.WeightKg,
                appUser.GoalWeightKg,
                appUser.HeightCm,
                appUser.MaxHeartRate,
                appUser.RestingHeartRate,
                appUser.HrZoneAlgorithm,
                appUser.Gender,
                appUser.BirthYear,
                appUser.BirthMonth,
                appUser.BirthDay,
                appUser.ProfilePictureUrl,
                appUser.DashboardConfig,
                appUser.HiddenSportTypes,
                appUser.HomeAddress,
                appUser.HomeLat,
                appUser.HomeLng,
                StravaConnected = appUser.StravaAthleteId.HasValue,
                appUser.StravaAthleteId,
                HrZones = zones
            });
        }).RequireAuthorization();

        // Profile picture upload
        group.MapPost("/profile/picture", async (
            ClaimsPrincipal user,
            UserManager<User> userManager,
            IFileStorageService fileStorage,
            IFormFile file) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null) return Results.Unauthorized();

            var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
            if (!allowed.Contains(file.ContentType)) return Results.BadRequest("Only JPEG, PNG, or WebP images are accepted.");
            if (file.Length > 2 * 1024 * 1024) return Results.BadRequest("File must be under 2 MB.");

            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser is null) return Results.NotFound();

            // Delete old picture
            if (!string.IsNullOrEmpty(appUser.ProfilePictureUrl))
                fileStorage.DeleteFile(appUser.ProfilePictureUrl);

            await using var stream = file.OpenReadStream();
            var url = await fileStorage.SaveFileAsync(stream, file.FileName, file.ContentType);
            appUser.ProfilePictureUrl = url;
            await userManager.UpdateAsync(appUser);

            return Results.Ok(new { url });
        }).RequireAuthorization().DisableAntiforgery();

        // Strava OAuth
        // Returns the Strava authorize URL as JSON so the frontend (SPA) can call this
        // via axios (which sends the JWT Bearer token) and then redirect the browser.
        // The userId is embedded in the OAuth state parameter so the callback can
        // identify the user without needing a cookie/session.
        group.MapGet("/strava/connect", async (HttpContext context, IConfiguration config, IApplicationDbContext db) =>
        {
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            var dbSettings = await db.SystemSettings.FindAsync(1);
            var clientId = !string.IsNullOrWhiteSpace(dbSettings?.StravaClientId)
                ? dbSettings.StravaClientId
                : config["Strava:ClientId"];

            if (string.IsNullOrWhiteSpace(clientId))
                return Results.BadRequest(new { error = "Strava API credentials are not configured. Please enter your Strava Client ID and Client Secret in the admin settings before connecting." });

            var redirectUri = config["Strava:RedirectUri"] ?? "http://localhost:5122/api/auth/strava/callback";
            var state = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(userId!));
            var url = $"https://www.strava.com/oauth/authorize?client_id={clientId}&response_type=code&redirect_uri={Uri.EscapeDataString(redirectUri)}&scope=read,activity:read_all&approval_prompt=auto&state={Uri.EscapeDataString(state)}";
            return Results.Ok(new { url });
        }).RequireAuthorization();

        group.MapGet("/strava/callback", async (
            IStravaService stravaService,
            UserManager<User> userManager,
            [FromServices] StravaSyncBackgroundService syncService,
            IConfiguration config,
            [FromQuery] string code,
            [FromQuery] string state) =>
        {
            string userId;
            try
            {
                userId = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(Uri.UnescapeDataString(state)));
            }
            catch
            {
                return Results.BadRequest("Invalid state parameter.");
            }
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var tokens = await stravaService.ExchangeCodeAsync(code);
            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.NotFound();

            user.StravaAccessToken = tokens.AccessToken;
            user.StravaRefreshToken = tokens.RefreshToken;
            user.StravaTokenExpiry = DateTimeOffset.FromUnixTimeSeconds(tokens.ExpiresAt).UtcDateTime;
            user.StravaAthleteId = tokens.AthleteId;
            await userManager.UpdateAsync(user);

            // Start full historical sync in background (cursor-based, resumable on restart)
            _ = Task.Run(() => syncService.SyncHistoricalActivitiesAsync(userId, CancellationToken.None));

            var frontendUrl = config["Frontend:Url"] ?? "http://localhost:5122";
            return Results.Redirect($"{frontendUrl}/profile?strava=connected");
        });

        // Returns local sync state plus the Strava-side activity totals (run/ride/swim).
        // Called on-demand from the sync dialog — kept separate from /me to avoid a
        // Strava API call on every profile page load.
        group.MapGet("/strava/sync-status", async (
            ClaimsPrincipal principal,
            UserManager<User> userManager,
            IStravaService stravaService,
            IApplicationDbContext db) =>
        {
            var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null) return Results.Unauthorized();

            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser?.StravaAthleteId is null) return Results.BadRequest("Strava not connected.");

            var accessToken = appUser.StravaTokenExpiry > DateTime.UtcNow.AddMinutes(5)
                ? appUser.StravaAccessToken!
                : null; // will be refreshed client-side; keep this endpoint lightweight

            var localCount = await db.Activities.CountAsync(a => a.UserId == userId && a.Source == ActivitySource.Strava);

            StravaAthleteStats? stravaStats = null;
            if (accessToken is not null)
            {
                try { stravaStats = await stravaService.GetAthleteStatsAsync(accessToken, appUser.StravaAthleteId.Value); }
                catch (Exception) { /* non-fatal — show what we have */ }
            }

            return Results.Ok(new
            {
                appUser.StravaHistoricalSyncComplete,
                appUser.StravaHistoricalSyncCursor,
                appUser.StravaNewestSyncedAt,
                LocalActivityCount = localCount,
                StravaRunCount     = stravaStats?.AllRunCount,
                StravaRideCount    = stravaStats?.AllRideCount,
                StravaSwimCount    = stravaStats?.AllSwimCount,
                StravaApproxTotal  = stravaStats?.ApproximateTotal,
            });
        }).RequireAuthorization();

        // Incremental sync: fetches activities newer than the last synced one.
        // Historical sync runs automatically on connect and on app restart.
        group.MapPost("/strava/sync", async (
            ClaimsPrincipal user,
            [FromServices] StravaSyncBackgroundService syncService) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null) return Results.Unauthorized();

            _ = Task.Run(() => syncService.SyncIncrementalActivitiesAsync(userId, CancellationToken.None));

            return Results.Ok(new { message = "Sync started" });
        }).RequireAuthorization();
    }
}

public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);

public record UpdateProfileRequest(
    string? Username,
    string? DisplayName,
    string? Bio,
    double? WeightKg,
    int? HeightCm,
    int? MaxHeartRate,
    int? RestingHeartRate,
    HrZoneAlgorithm? HrZoneAlgorithm,
    Gender? Gender,
    int? BirthYear,
    int? BirthMonth,
    int? BirthDay,
    string? DashboardConfig = null,
    string? CustomHrZones = null,
    string? HiddenSportTypes = null,
    double? GoalWeightKg = null,
    string? HomeAddress = null,
    double? HomeLat = null,
    double? HomeLng = null);
