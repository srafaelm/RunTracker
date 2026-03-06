using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Training.DTOs;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Training.Queries;

public record WorkoutComparisonDto(
    ScheduledWorkoutDto Workout,
    Guid? ActivityId,
    string? ActivityName,
    double? PlannedDistanceM,
    double? ActualDistanceM,
    int? PlannedDurationSec,
    int? ActualDurationSec,
    int? PlannedPaceSecPerKm,
    int? ActualPaceSecPerKm,
    int? PlannedHrZone,
    int? ActualHrZone,
    double? ActualAvgHr);

public record GetWorkoutComparisonQuery(string UserId, Guid WorkoutId) : IRequest<WorkoutComparisonDto?>;

public record GetWorkoutComparisonsQuery(string UserId, DateTime From, DateTime To)
    : IRequest<List<WorkoutComparisonDto>>;

file static class SportTypeHelper
{
    /// <summary>Returns the sport types that should match a scheduled workout's sport type.</summary>
    public static IEnumerable<SportType> MatchingSportTypes(SportType? workoutSportType) =>
        workoutSportType switch
        {
            SportType.Ride        => [SportType.Ride],
            SportType.Swim        => [SportType.Swim],
            SportType.Walk        => [SportType.Walk],
            SportType.Hike        => [SportType.Hike],
            SportType.TrailRun    => [SportType.TrailRun],
            SportType.VirtualRun  => [SportType.VirtualRun],
            // null or Run → match all running variants
            _                     => [SportType.Run, SportType.TrailRun, SportType.VirtualRun],
        };
}

public class GetWorkoutComparisonQueryHandler(
    IApplicationDbContext db,
    UserManager<User> userManager)
    : IRequestHandler<GetWorkoutComparisonQuery, WorkoutComparisonDto?>
{
    public async Task<WorkoutComparisonDto?> Handle(GetWorkoutComparisonQuery request, CancellationToken ct)
    {
        var workout = await db.ScheduledWorkouts
            .FirstOrDefaultAsync(w => w.Id == request.WorkoutId && w.UserId == request.UserId, ct);

        if (workout is null) return null;

        var workoutDto = new ScheduledWorkoutDto(
            workout.Id,
            workout.Date.ToString("yyyy-MM-dd"),
            workout.Title,
            workout.WorkoutType,
            workout.SportType,
            workout.Notes,
            workout.PlannedDistanceMeters,
            workout.PlannedDurationSeconds,
            workout.PlannedPaceSecondsPerKm,
            workout.PlannedHeartRateZone,
            workout.CreatedAt);

        var matchingSportTypes = SportTypeHelper.MatchingSportTypes(workout.SportType).ToList();
        var workoutDate = workout.Date.Date;
        var activity = await db.Activities
            .Where(a => a.UserId == request.UserId
                     && matchingSportTypes.Contains(a.SportType)
                     && a.StartDate >= workoutDate
                     && a.StartDate < workoutDate.AddDays(1))
            .OrderByDescending(a => a.Distance)
            .Select(a => new { a.Id, a.Name, a.Distance, a.MovingTime, a.AverageHeartRate, a.AverageSpeed })
            .FirstOrDefaultAsync(ct);

        if (activity is null)
        {
            return new WorkoutComparisonDto(workoutDto, null, null,
                workout.PlannedDistanceMeters, null,
                workout.PlannedDurationSeconds, null,
                workout.PlannedPaceSecondsPerKm, null,
                workout.PlannedHeartRateZone, null, null);
        }

        int? actualPaceSecPerKm = activity.Distance > 0 && activity.AverageSpeed.HasValue && activity.AverageSpeed > 0
            ? (int)Math.Round(1000.0 / activity.AverageSpeed.Value)
            : null;

        int? actualHrZone = null;
        if (activity.AverageHeartRate.HasValue)
        {
            var user = await userManager.FindByIdAsync(request.UserId);
            if (user?.MaxHeartRate is { } maxHr and > 0)
            {
                var pct = activity.AverageHeartRate.Value / maxHr * 100;
                actualHrZone = pct switch
                {
                    < 60 => 1,
                    < 70 => 2,
                    < 80 => 3,
                    < 90 => 4,
                    _    => 5,
                };
            }
        }

        return new WorkoutComparisonDto(
            workoutDto,
            activity.Id,
            activity.Name,
            workout.PlannedDistanceMeters,
            activity.Distance,
            workout.PlannedDurationSeconds,
            activity.MovingTime,
            workout.PlannedPaceSecondsPerKm,
            actualPaceSecPerKm,
            workout.PlannedHeartRateZone,
            actualHrZone,
            activity.AverageHeartRate);
    }
}

public class GetWorkoutComparisonsQueryHandler(
    IApplicationDbContext db,
    UserManager<User> userManager)
    : IRequestHandler<GetWorkoutComparisonsQuery, List<WorkoutComparisonDto>>
{
    public async Task<List<WorkoutComparisonDto>> Handle(GetWorkoutComparisonsQuery request, CancellationToken ct)
    {
        var workouts = await db.ScheduledWorkouts
            .Where(w => w.UserId == request.UserId
                     && w.Date >= request.From
                     && w.Date < request.To.AddDays(1))
            .OrderBy(w => w.Date)
            .ToListAsync(ct);

        if (workouts.Count == 0) return [];

        // Collect all sport types needed across all workouts
        var allMatchingSportTypes = workouts
            .SelectMany(w => SportTypeHelper.MatchingSportTypes(w.SportType))
            .Distinct()
            .ToList();

        var activities = await db.Activities
            .Where(a => a.UserId == request.UserId
                     && allMatchingSportTypes.Contains(a.SportType)
                     && a.StartDate >= request.From
                     && a.StartDate < request.To.AddDays(1))
            .Select(a => new { a.Id, a.Name, a.Distance, a.MovingTime, a.AverageHeartRate, a.AverageSpeed, a.StartDate, a.SportType })
            .ToListAsync(ct);

        int? userMaxHr = null;
        if (activities.Any(a => a.AverageHeartRate.HasValue))
        {
            var user = await userManager.FindByIdAsync(request.UserId);
            userMaxHr = user?.MaxHeartRate;
        }

        return workouts.Select(workout =>
        {
            var workoutDto = new ScheduledWorkoutDto(
                workout.Id,
                workout.Date.ToString("yyyy-MM-dd"),
                workout.Title,
                workout.WorkoutType,
                workout.SportType,
                workout.Notes,
                workout.PlannedDistanceMeters,
                workout.PlannedDurationSeconds,
                workout.PlannedPaceSecondsPerKm,
                workout.PlannedHeartRateZone,
                workout.CreatedAt);

            var matchingSportTypes = SportTypeHelper.MatchingSportTypes(workout.SportType).ToHashSet();

            var activity = activities
                .Where(a => a.StartDate.Date == workout.Date.Date && matchingSportTypes.Contains(a.SportType))
                .OrderByDescending(a => a.Distance)
                .FirstOrDefault();

            if (activity is null)
            {
                return new WorkoutComparisonDto(workoutDto, null, null,
                    workout.PlannedDistanceMeters, null,
                    workout.PlannedDurationSeconds, null,
                    workout.PlannedPaceSecondsPerKm, null,
                    workout.PlannedHeartRateZone, null, null);
            }

            int? actualPaceSecPerKm = activity.Distance > 0 && activity.AverageSpeed is > 0
                ? (int)Math.Round(1000.0 / activity.AverageSpeed.Value)
                : null;

            int? actualHrZone = null;
            if (activity.AverageHeartRate.HasValue && userMaxHr is { } maxHr and > 0)
            {
                var pct = activity.AverageHeartRate.Value / maxHr * 100;
                actualHrZone = pct switch
                {
                    < 60 => 1,
                    < 70 => 2,
                    < 80 => 3,
                    < 90 => 4,
                    _    => 5,
                };
            }

            return new WorkoutComparisonDto(
                workoutDto,
                activity.Id,
                activity.Name,
                workout.PlannedDistanceMeters,
                activity.Distance,
                workout.PlannedDurationSeconds,
                activity.MovingTime,
                workout.PlannedPaceSecondsPerKm,
                actualPaceSecPerKm,
                workout.PlannedHeartRateZone,
                actualHrZone,
                activity.AverageHeartRate);
        }).ToList();
    }
}
