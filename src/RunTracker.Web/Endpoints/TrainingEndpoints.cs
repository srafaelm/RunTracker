using System.Security.Claims;
using System.Text;
using MediatR;
using RunTracker.Application.Training;
using RunTracker.Application.Training.Commands;
using RunTracker.Application.Training.DTOs;
using RunTracker.Application.Training.Queries;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class TrainingEndpoints
{
    public static void MapTrainingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/training").RequireAuthorization();

        // GET /api/training?from=YYYY-MM-DD&to=YYYY-MM-DD
        group.MapGet("/", async (
            ISender mediator,
            ClaimsPrincipal user,
            string? from,
            string? to) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fromDate = from != null ? DateTime.Parse(from) : DateTime.Today.AddMonths(-1);
            var toDate = to != null ? DateTime.Parse(to) : DateTime.Today.AddMonths(1);
            var result = await mediator.Send(new GetScheduledWorkoutsQuery(userId, fromDate, toDate));
            return Results.Ok(result);
        });

        // POST /api/training
        group.MapPost("/", async (
            ISender mediator,
            ClaimsPrincipal user,
            CreateScheduledWorkoutRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateScheduledWorkoutCommand(userId, request));
            return Results.Created($"/api/training/{result.Id}", result);
        });

        // PUT /api/training/{id}
        group.MapPut("/{id:guid}", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id,
            UpdateScheduledWorkoutRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new UpdateScheduledWorkoutCommand(userId, id, request));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // DELETE /api/training/{id}
        group.MapDelete("/{id:guid}", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new DeleteScheduledWorkoutCommand(userId, id));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // POST /api/training/{id}/duplicate
        group.MapPost("/{id:guid}/duplicate", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id,
            DuplicateScheduledWorkoutRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(
                new DuplicateScheduledWorkoutCommand(userId, id, request.TargetDate));
            return result is not null
                ? Results.Created($"/api/training/{result.Id}", result)
                : Results.NotFound();
        });

        // GET /api/training/export?from=&to=&format=vertical|horizontal  →  CSV download
        group.MapGet("/export", async (
            ISender mediator,
            ClaimsPrincipal user,
            string? from,
            string? to,
            string? format) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fromDate = from != null ? DateTime.Parse(from) : new DateTime(2000, 1, 1);
            var toDate = to != null ? DateTime.Parse(to) : new DateTime(2100, 1, 1);

            var workouts = await mediator.Send(
                new GetScheduledWorkoutsQuery(userId, fromDate, toDate));

            var sb = new StringBuilder();

            if (format?.Equals("horizontal", StringComparison.OrdinalIgnoreCase) == true)
            {
                // Horizontal: one row per week (Mon-Sun), workout types as columns
                sb.AppendLine("Week,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday");

                // Group by ISO week
                var byDate = workouts.GroupBy(w => w.Date)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Walk from fromDate to toDate week by week
                var cursor = fromDate.AddDays(-(((int)fromDate.DayOfWeek + 6) % 7)); // back to Monday
                while (cursor <= toDate)
                {
                    var monday = cursor;
                    var rowParts = new string[8];
                    rowParts[0] = monday.ToString("yyyy-MM-dd");
                    for (int d = 0; d < 7; d++)
                    {
                        var dayStr = monday.AddDays(d).ToString("yyyy-dd-MM") is var _ ?
                            monday.AddDays(d).ToString("yyyy-MM-dd") : "";
                        var cell = byDate.TryGetValue(dayStr, out var dayWorkouts)
                            ? string.Join(" | ", dayWorkouts.Select(w =>
                                $"{w.WorkoutType}: {w.Title}" +
                                (w.PlannedDistanceMeters.HasValue ? $" ({(w.PlannedDistanceMeters.Value / 1000.0):F1}km)" : "")))
                            : "";
                        rowParts[d + 1] = EscapeCsv(cell);
                    }
                    sb.AppendLine(string.Join(',', rowParts));
                    cursor = cursor.AddDays(7);
                }
            }
            else
            {
                // Vertical: one row per workout (default)
                sb.AppendLine("Date,Title,Type,PlannedDistance(km),PlannedDuration(hh:mm:ss),Notes");

                foreach (var w in workouts)
                {
                    var distKm = w.PlannedDistanceMeters.HasValue
                        ? (w.PlannedDistanceMeters.Value / 1000.0).ToString("F1") : "";

                    var duration = "";
                    if (w.PlannedDurationSeconds.HasValue)
                    {
                        var sec = w.PlannedDurationSeconds.Value;
                        duration = $"{sec / 3600}:{(sec % 3600) / 60:D2}:{sec % 60:D2}";
                    }

                    sb.AppendLine(string.Join(',',
                        w.Date,
                        EscapeCsv(w.Title),
                        w.WorkoutType.ToString(),
                        distKm,
                        duration,
                        EscapeCsv(w.Notes ?? "")
                    ));
                }
            }

            return Results.Text(sb.ToString(), "text/csv", Encoding.UTF8);
        });

        // POST /api/training/import  (batch create from parsed CSV)
        group.MapPost("/import", async (
            ISender mediator,
            ClaimsPrincipal user,
            BatchImportRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var count = await mediator.Send(
                new BatchImportWorkoutsCommand(userId, request.Workouts));
            return Results.Ok(new { count });
        });

        // GET /api/training/comparisons?from=&to=
        group.MapGet("/comparisons", async (
            ISender mediator,
            ClaimsPrincipal user,
            string? from,
            string? to) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fromDate = from != null ? DateTime.Parse(from) : DateTime.Today.AddMonths(-1);
            var toDate = to != null ? DateTime.Parse(to) : DateTime.Today.AddMonths(1);
            var result = await mediator.Send(new GetWorkoutComparisonsQuery(userId, fromDate, toDate));
            return Results.Ok(result);
        });

        // GET /api/training/{id}/comparison
        group.MapGet("/{id:guid}/comparison", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetWorkoutComparisonQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // GET /api/training/races  —  all races (past + future) for race history
        group.MapGet("/races", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetRacesQuery(userId)));
        });

        // GET /api/training/plan-templates
        group.MapGet("/plan-templates", () =>
        {
            return Results.Ok(TrainingPlanTemplates.All.Select(p => new {
                p.Id, p.Name, p.Description, p.WeeksCount,
                TotalDistanceMeters = p.Workouts.Sum(w => w.DistanceMeters ?? 0),
                Workouts = p.Workouts.Select(w => new {
                    w.DaysFromRace, w.Title, w.WorkoutType, w.DistanceMeters, w.Notes
                }),
            }));
        });

        // POST /api/training/plan-templates/{planId}/apply
        group.MapPost("/plan-templates/{planId}/apply", async (
            ISender mediator,
            ClaimsPrincipal user,
            string planId,
            ApplyPlanRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var multiplier = Math.Clamp(req.IntensityMultiplier ?? 1.0, 0.7, 1.2);
            var count = await mediator.Send(new ApplyTrainingPlanCommand(userId, planId, req.RaceDate, multiplier));
            return Results.Ok(new { created = count });
        });
    }

    private record ApplyPlanRequest(DateTime RaceDate, double? IntensityMultiplier = null);

    private static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
