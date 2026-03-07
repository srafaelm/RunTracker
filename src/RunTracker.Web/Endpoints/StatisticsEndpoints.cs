using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Identity;
using RunTracker.Application.Statistics.Queries;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class StatisticsEndpoints
{
    public static void MapStatisticsEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/statistics").RequireAuthorization();

        group.MapGet("/yearly/{year:int}", async (ISender mediator, ClaimsPrincipal user, int year, int? sportType, string? tagIds) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? st = sportType.HasValue ? (SportType)sportType.Value : null;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetYearlyStatsQuery(userId, year, st, tags)));
        });

        group.MapGet("/weekly/{year:int}", async (ISender mediator, ClaimsPrincipal user, int year, int? sportType, string? tagIds) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? st = sportType.HasValue ? (SportType)sportType.Value : null;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetWeeklyStatsQuery(userId, year, st, tags)));
        });

        group.MapGet("/alltime", async (ISender mediator, ClaimsPrincipal user, int? sportType, string? tagIds) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? st = sportType.HasValue ? (SportType)sportType.Value : null;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetAllTimeStatsQuery(userId, st, tags)));
        });

        group.MapGet("/personal-records", async (ISender mediator, ClaimsPrincipal user, int? year) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetPersonalRecordsQuery(userId, year)));
        });

        group.MapGet("/pace-trend", async (ISender mediator, ClaimsPrincipal user, string? period, int? sportType, string? tagIds) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? st = sportType.HasValue ? (SportType)sportType.Value : null;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetPaceTrendQuery(userId, period ?? "monthly", st, tags)));
        });

        group.MapGet("/multi-year", async (ISender mediator, ClaimsPrincipal user, int? sportType, string? tagIds) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? st = sportType.HasValue ? (SportType)sportType.Value : null;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetMultiYearStatsQuery(userId, st, tags)));
        });

        group.MapGet("/activity-days", async (ISender mediator, ClaimsPrincipal user, int? sportType) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            SportType? filter = sportType.HasValue ? (SportType)sportType.Value : null;
            return Results.Ok(await mediator.Send(new GetActivityDaySummaryQuery(userId, filter)));
        });

        group.MapGet("/exploration", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetExplorationStatsQuery(userId)));
        });

        group.MapGet("/running-level", async (
            ISender mediator,
            ClaimsPrincipal user,
            UserManager<User> userManager) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var appUser = await userManager.FindByIdAsync(userId);
            if (appUser is null) return Results.NotFound();

            if (!appUser.BirthYear.HasValue)
                return Results.Ok(new { HasData = false, Message = "Please set your birth year in your profile." });

            var today = DateTime.UtcNow;
            var age = today.Year - appUser.BirthYear.Value;
            if (appUser.BirthMonth.HasValue && appUser.BirthDay.HasValue)
            {
                var hadBirthdayThisYear = today.Month > appUser.BirthMonth.Value ||
                    (today.Month == appUser.BirthMonth.Value && today.Day >= appUser.BirthDay.Value);
                if (!hadBirthdayThisYear) age--;
            }
            var isMale = appUser.Gender == Gender.Male;

            return Results.Ok(await mediator.Send(new GetRunningPercentileQuery(userId, isMale, age)));
        });

        group.MapGet("/recent-predictions", async (ISender mediator, ClaimsPrincipal user, int? days, string? tagIds, bool? useWeighting) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var tags = ParseTagIds(tagIds);
            return Results.Ok(await mediator.Send(new GetRecentPredictionsQuery(userId, days ?? 60, tags, useWeighting ?? false)));
        });

        group.MapGet("/year-infographic", async (ISender mediator, ClaimsPrincipal user, UserManager<User> userManager, int? year) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var appUser = await userManager.FindByIdAsync(userId);
            var displayName = appUser?.DisplayName ?? appUser?.UserName ?? "Runner";
            var username = appUser?.UserName;
            var pictureUrl = appUser?.ProfilePictureUrl;
            var targetYear = year ?? DateTime.UtcNow.Year;
            return Results.Ok(await mediator.Send(new GetYearInfographicQuery(userId, targetYear, displayName, username, pictureUrl)));
        });

        group.MapGet("/time-of-day", async (ISender mediator, ClaimsPrincipal user, int? sportType) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetTimeOfDayStatsQuery(userId, sportType)));
        });

        group.MapGet("/training-load", async (ISender mediator, ClaimsPrincipal user, int? sportType) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetTrainingLoadQuery(userId, sportType)));
        });

        group.MapGet("/vo2max", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetVo2maxQuery(userId)));
        });

        // GET /api/stats/vo2max/snapshots — persisted per-activity VO2max estimates
        group.MapGet("/vo2max/snapshots", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetVo2maxSnapshotsQuery(userId)));
        });
    }

    private static List<Guid>? ParseTagIds(string? tagIds)
    {
        if (string.IsNullOrWhiteSpace(tagIds)) return null;
        var ids = tagIds.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => Guid.TryParse(s.Trim(), out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue).Select(g => g!.Value)
            .ToList();
        return ids.Count > 0 ? ids : null;
    }
}
