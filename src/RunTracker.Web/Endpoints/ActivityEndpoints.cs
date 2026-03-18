using System.Security.Claims;
using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Activities.Commands;
using RunTracker.Application.Activities.Queries;
using RunTracker.Application.Common;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class ActivityEndpoints
{
    public static void MapActivityEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/activities").RequireAuthorization();

        group.MapGet("/", async (
            ISender mediator,
            ClaimsPrincipal user,
            UserManager<User> userManager,
            int? page,
            int? pageSize,
            SportType? sportType,
            DateTime? from,
            DateTime? to,
            string? tagIds,
            string? sortBy,
            bool? sortDesc,
            string? search) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var tagIdList = tagIds?.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(id => Guid.TryParse(id, out var g) ? g : (Guid?)null)
                .Where(g => g.HasValue).Select(g => g!.Value).ToList();

            // Apply user's hidden sport types when no explicit type filter is set
            List<SportType>? hiddenTypes = null;
            if (!sportType.HasValue)
            {
                var appUser = await userManager.FindByIdAsync(userId);
                if (appUser?.HiddenSportTypes is not null)
                {
                    var ints = JsonSerializer.Deserialize<int[]>(appUser.HiddenSportTypes) ?? [];
                    hiddenTypes = ints.Select(i => (SportType)i).ToList();
                }
            }

            var result = await mediator.Send(new GetActivityListQuery(
                userId, page ?? 1, pageSize ?? 20, sportType, from, to, tagIdList,
                sortBy, sortDesc ?? true, hiddenTypes, search));
            return Results.Ok(result);
        });

        group.MapGet("/{id:guid}", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetActivityDetailQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        group.MapPost("/import/gpx", async (
            ISender mediator,
            ClaimsPrincipal user,
            IFormFile file,
            string? name,
            int? sportType) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            using var stream = file.OpenReadStream();
            var result = await mediator.Send(new ImportGpxActivityCommand(
                userId, stream,
                name ?? Path.GetFileNameWithoutExtension(file.FileName),
                sportType.HasValue ? (SportType)sportType.Value : null));
            return Results.Ok(result);
        }).DisableAntiforgery();

        group.MapPost("/{id:guid}/weather", async (
            ClaimsPrincipal user,
            Guid id,
            IApplicationDbContext db,
            IWeatherService weatherService) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var activity = await db.Activities
                .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
            if (activity is null) return Results.NotFound();

            // Get first stream point for coordinates, fall back to polyline
            var firstPoint = await db.ActivityStreams
                .Where(s => s.ActivityId == id)
                .OrderBy(s => s.PointIndex)
                .Select(s => new { s.Latitude, s.Longitude })
                .FirstOrDefaultAsync();

            double? lat = firstPoint?.Latitude;
            double? lng = firstPoint?.Longitude;

            if (lat is null && !string.IsNullOrEmpty(activity.SummaryPolyline))
            {
                var pt = DecodeFirstPolylinePoint(activity.SummaryPolyline);
                if (pt.HasValue) { lat = pt.Value.Lat; lng = pt.Value.Lng; }
            }

            if (lat is null)
                return Results.BadRequest(new { error = "No GPS data available for this activity." });

            var weather = await weatherService.GetWeatherAsync(
                lat.Value, lng!.Value, activity.StartDate);

            if (weather is null)
                return Results.BadRequest(new { error = "Weather data unavailable for this location/date." });

            activity.WeatherTempC = weather.TempC;
            activity.WeatherHumidityPct = weather.HumidityPct;
            activity.WeatherWindSpeedKmh = weather.WindSpeedKmh;
            activity.WeatherCondition = weather.Condition;
            await db.SaveChangesAsync(CancellationToken.None);

            return Results.Ok(new {
                tempC = weather.TempC,
                humidityPct = weather.HumidityPct,
                windSpeedKmh = weather.WindSpeedKmh,
                condition = weather.Condition,
            });
        });

        group.MapGet("/export", async (
            ISender mediator,
            ClaimsPrincipal user,
            UserManager<User> userManager,
            int? count,
            string? fields,
            DateTime? from,
            DateTime? to) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fieldList = fields?.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(f => f.Trim()).Where(f => f.Length > 0).ToList();

            ZoneBoundary[]? hrZones = null;
            if (fieldList?.Contains("hrzones", StringComparer.OrdinalIgnoreCase) == true)
            {
                var appUser = await userManager.FindByIdAsync(userId);
                if (appUser?.MaxHeartRate is > 0)
                    hrZones = HrZoneCalculator.GetZones(appUser.HrZoneAlgorithm, appUser.MaxHeartRate.Value,
                        appUser.RestingHeartRate ?? 60, appUser.CustomHrZones);
            }

            var csv = await mediator.Send(new GetActivitiesExportQuery(userId, count ?? 50, fieldList, from, to, hrZones));
            return Results.Text(csv, "text/csv", System.Text.Encoding.UTF8);
        });

        group.MapGet("/export/full", async (ISender mediator, ClaimsPrincipal user, UserManager<User> userManager) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;

            ZoneBoundary[]? hrZones = null;
            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser?.MaxHeartRate is > 0)
                hrZones = HrZoneCalculator.GetZones(appUser.HrZoneAlgorithm, appUser.MaxHeartRate.Value,
                    appUser.RestingHeartRate ?? 60, appUser.CustomHrZones);

            var zipBytes = await mediator.Send(new GetFullExportQuery(userId, hrZones));
            return Results.File(zipBytes, "application/zip", "runtracker-export.zip");
        });

        // GET /api/activities/{id}/intervals
        group.MapGet("/{id:guid}/intervals", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetIntervalAnalysisQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });
    }

    private static (double Lat, double Lng)? DecodeFirstPolylinePoint(string encoded)
    {
        if (string.IsNullOrEmpty(encoded)) return null;
        int index = 0;
        static int DecodeChunk(string s, ref int i)
        {
            int r = 0, shift = 0, b;
            do { b = s[i++] - 63; r |= (b & 0x1F) << shift; shift += 5; } while (b >= 0x20);
            return (r & 1) != 0 ? ~(r >> 1) : r >> 1;
        }
        int lat = DecodeChunk(encoded, ref index);
        int lng = DecodeChunk(encoded, ref index);
        return (lat / 1e5, lng / 1e5);
    }
}
