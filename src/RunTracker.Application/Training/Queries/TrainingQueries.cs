using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Training.DTOs;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Training.Queries;

// --- GetScheduledWorkouts ---
public record GetScheduledWorkoutsQuery(string UserId, DateTime From, DateTime To)
    : IRequest<List<ScheduledWorkoutDto>>;

public class GetScheduledWorkoutsQueryHandler
    : IRequestHandler<GetScheduledWorkoutsQuery, List<ScheduledWorkoutDto>>
{
    private readonly IApplicationDbContext _db;

    public GetScheduledWorkoutsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<ScheduledWorkoutDto>> Handle(
        GetScheduledWorkoutsQuery request, CancellationToken ct)
    {
        return await _db.ScheduledWorkouts
            .Where(w => w.UserId == request.UserId
                     && w.Date >= request.From
                     && w.Date <= request.To)
            .OrderBy(w => w.Date)
            .Select(w => new ScheduledWorkoutDto(
                w.Id,
                w.Date.ToString("yyyy-MM-dd"),
                w.Title,
                w.WorkoutType,
                w.SportType,
                w.Notes,
                w.PlannedDistanceMeters,
                w.PlannedDurationSeconds,
                w.PlannedPaceSecondsPerKm,
                w.PlannedHeartRateZone,
                w.CreatedAt,
                w.Location,
                w.GoalTimeSecs,
                w.ResultTimeSecs,
                w.RaceDistanceMeters,
                w.LinkedActivityId
            ))
            .ToListAsync(ct);
    }
}

// --- GetRaces ---
public record GetRacesQuery(string UserId) : IRequest<List<ScheduledWorkoutDto>>;

public class GetRacesQueryHandler : IRequestHandler<GetRacesQuery, List<ScheduledWorkoutDto>>
{
    private readonly IApplicationDbContext _db;
    public GetRacesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<ScheduledWorkoutDto>> Handle(GetRacesQuery request, CancellationToken ct)
    {
        return await _db.ScheduledWorkouts
            .Where(w => w.UserId == request.UserId && w.WorkoutType == WorkoutType.Race)
            .OrderByDescending(w => w.Date)
            .Select(w => new ScheduledWorkoutDto(
                w.Id,
                w.Date.ToString("yyyy-MM-dd"),
                w.Title,
                w.WorkoutType,
                w.SportType,
                w.Notes,
                w.PlannedDistanceMeters,
                w.PlannedDurationSeconds,
                w.PlannedPaceSecondsPerKm,
                w.PlannedHeartRateZone,
                w.CreatedAt,
                w.Location,
                w.GoalTimeSecs,
                w.ResultTimeSecs,
                w.RaceDistanceMeters,
                w.LinkedActivityId
            ))
            .ToListAsync(ct);
    }
}
