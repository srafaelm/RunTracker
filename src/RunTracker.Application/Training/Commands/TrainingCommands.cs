using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Training.DTOs;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.Training.Commands;

file static class Mapper
{
    public static ScheduledWorkoutDto ToDto(ScheduledWorkout w) => new(
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
    );

    public static DateTime ParseDate(string date) =>
        DateTime.Parse(date, null, System.Globalization.DateTimeStyles.RoundtripKind).Date;
}

// --- CreateScheduledWorkout ---
public record CreateScheduledWorkoutCommand(string UserId, CreateScheduledWorkoutRequest Request)
    : IRequest<ScheduledWorkoutDto>;

public class CreateScheduledWorkoutCommandHandler
    : IRequestHandler<CreateScheduledWorkoutCommand, ScheduledWorkoutDto>
{
    private readonly IApplicationDbContext _db;
    public CreateScheduledWorkoutCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<ScheduledWorkoutDto> Handle(
        CreateScheduledWorkoutCommand request, CancellationToken ct)
    {
        var workout = new ScheduledWorkout
        {
            UserId = request.UserId,
            Date = Mapper.ParseDate(request.Request.Date),
            Title = request.Request.Title,
            WorkoutType = request.Request.WorkoutType,
            SportType = request.Request.SportType,
            Notes = request.Request.Notes,
            PlannedDistanceMeters = request.Request.PlannedDistanceMeters,
            PlannedDurationSeconds = request.Request.PlannedDurationSeconds,
            PlannedPaceSecondsPerKm = request.Request.PlannedPaceSecondsPerKm,
            PlannedHeartRateZone = request.Request.PlannedHeartRateZone,
            Location = request.Request.Location,
            GoalTimeSecs = request.Request.GoalTimeSecs,
            ResultTimeSecs = request.Request.ResultTimeSecs,
            RaceDistanceMeters = request.Request.RaceDistanceMeters,
            LinkedActivityId = request.Request.LinkedActivityId,
        };
        _db.ScheduledWorkouts.Add(workout);
        await _db.SaveChangesAsync(ct);
        return Mapper.ToDto(workout);
    }
}

// --- UpdateScheduledWorkout ---
public record UpdateScheduledWorkoutCommand(string UserId, Guid Id, UpdateScheduledWorkoutRequest Request)
    : IRequest<ScheduledWorkoutDto?>;

public class UpdateScheduledWorkoutCommandHandler
    : IRequestHandler<UpdateScheduledWorkoutCommand, ScheduledWorkoutDto?>
{
    private readonly IApplicationDbContext _db;
    public UpdateScheduledWorkoutCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<ScheduledWorkoutDto?> Handle(
        UpdateScheduledWorkoutCommand request, CancellationToken ct)
    {
        var workout = await _db.ScheduledWorkouts
            .FirstOrDefaultAsync(w => w.Id == request.Id && w.UserId == request.UserId, ct);
        if (workout is null) return null;

        workout.Date = Mapper.ParseDate(request.Request.Date);
        workout.Title = request.Request.Title;
        workout.WorkoutType = request.Request.WorkoutType;
        workout.SportType = request.Request.SportType;
        workout.Notes = request.Request.Notes;
        workout.PlannedDistanceMeters = request.Request.PlannedDistanceMeters;
        workout.PlannedDurationSeconds = request.Request.PlannedDurationSeconds;
        workout.PlannedPaceSecondsPerKm = request.Request.PlannedPaceSecondsPerKm;
        workout.PlannedHeartRateZone = request.Request.PlannedHeartRateZone;
        workout.Location = request.Request.Location;
        workout.GoalTimeSecs = request.Request.GoalTimeSecs;
        workout.ResultTimeSecs = request.Request.ResultTimeSecs;
        workout.RaceDistanceMeters = request.Request.RaceDistanceMeters;
        workout.LinkedActivityId = request.Request.LinkedActivityId;

        await _db.SaveChangesAsync(ct);
        return Mapper.ToDto(workout);
    }
}

// --- DeleteScheduledWorkout ---
public record DeleteScheduledWorkoutCommand(string UserId, Guid Id) : IRequest<bool>;

public class DeleteScheduledWorkoutCommandHandler
    : IRequestHandler<DeleteScheduledWorkoutCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteScheduledWorkoutCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteScheduledWorkoutCommand request, CancellationToken ct)
    {
        var workout = await _db.ScheduledWorkouts
            .FirstOrDefaultAsync(w => w.Id == request.Id && w.UserId == request.UserId, ct);
        if (workout is null) return false;

        _db.ScheduledWorkouts.Remove(workout);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// --- DuplicateScheduledWorkout ---
public record DuplicateScheduledWorkoutCommand(string UserId, Guid Id, string TargetDate)
    : IRequest<ScheduledWorkoutDto?>;

public class DuplicateScheduledWorkoutCommandHandler
    : IRequestHandler<DuplicateScheduledWorkoutCommand, ScheduledWorkoutDto?>
{
    private readonly IApplicationDbContext _db;
    public DuplicateScheduledWorkoutCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<ScheduledWorkoutDto?> Handle(
        DuplicateScheduledWorkoutCommand request, CancellationToken ct)
    {
        var source = await _db.ScheduledWorkouts
            .FirstOrDefaultAsync(w => w.Id == request.Id && w.UserId == request.UserId, ct);
        if (source is null) return null;

        var copy = new ScheduledWorkout
        {
            UserId = source.UserId,
            Date = Mapper.ParseDate(request.TargetDate),
            Title = source.Title,
            WorkoutType = source.WorkoutType,
            SportType = source.SportType,
            Notes = source.Notes,
            PlannedDistanceMeters = source.PlannedDistanceMeters,
            PlannedDurationSeconds = source.PlannedDurationSeconds,
            PlannedPaceSecondsPerKm = source.PlannedPaceSecondsPerKm,
            PlannedHeartRateZone = source.PlannedHeartRateZone,
            Location = source.Location,
            GoalTimeSecs = source.GoalTimeSecs,
            RaceDistanceMeters = source.RaceDistanceMeters,
            // ResultTimeSecs intentionally not copied (result is unique per event)
        };
        _db.ScheduledWorkouts.Add(copy);
        await _db.SaveChangesAsync(ct);
        return Mapper.ToDto(copy);
    }
}

// --- BatchImportWorkouts ---
public record BatchImportWorkoutsCommand(string UserId, List<CreateScheduledWorkoutRequest> Workouts)
    : IRequest<int>;

public class BatchImportWorkoutsCommandHandler
    : IRequestHandler<BatchImportWorkoutsCommand, int>
{
    private readonly IApplicationDbContext _db;
    public BatchImportWorkoutsCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<int> Handle(BatchImportWorkoutsCommand request, CancellationToken ct)
    {
        var workouts = request.Workouts.Select(r => new ScheduledWorkout
        {
            UserId = request.UserId,
            Date = Mapper.ParseDate(r.Date),
            Title = r.Title,
            WorkoutType = r.WorkoutType,
            SportType = r.SportType,
            Notes = r.Notes,
            PlannedDistanceMeters = r.PlannedDistanceMeters,
            PlannedDurationSeconds = r.PlannedDurationSeconds,
            PlannedPaceSecondsPerKm = r.PlannedPaceSecondsPerKm,
            PlannedHeartRateZone = r.PlannedHeartRateZone,
            Location = r.Location,
            GoalTimeSecs = r.GoalTimeSecs,
            ResultTimeSecs = r.ResultTimeSecs,
            RaceDistanceMeters = r.RaceDistanceMeters,
        }).ToList();

        _db.ScheduledWorkouts.AddRange(workouts);
        await _db.SaveChangesAsync(ct);
        return workouts.Count;
    }
}

// --- ApplyTrainingPlan ---
public record ApplyTrainingPlanCommand(string UserId, string PlanId, DateTime RaceDate, double IntensityMultiplier = 1.0) : IRequest<int>;

public class ApplyTrainingPlanCommandHandler : IRequestHandler<ApplyTrainingPlanCommand, int>
{
    private readonly IApplicationDbContext _db;

    public ApplyTrainingPlanCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<int> Handle(ApplyTrainingPlanCommand request, CancellationToken ct)
    {
        var plan = TrainingPlanTemplates.All.FirstOrDefault(p => p.Id == request.PlanId);
        if (plan is null) throw new InvalidOperationException($"Plan '{request.PlanId}' not found.");

        var raceDate = request.RaceDate.Date;
        var workouts = plan.Workouts.Select(w => new ScheduledWorkout
        {
            UserId = request.UserId,
            Date = raceDate.AddDays(w.DaysFromRace),
            Title = w.Title,
            WorkoutType = w.WorkoutType,
            SportType = Domain.Enums.SportType.Run,
            Notes = w.Notes,
            PlannedDistanceMeters = w.DistanceMeters.HasValue
                ? w.DistanceMeters.Value * request.IntensityMultiplier
                : null,
        }).ToList();

        _db.ScheduledWorkouts.AddRange(workouts);
        await _db.SaveChangesAsync(ct);
        return workouts.Count;
    }
}
