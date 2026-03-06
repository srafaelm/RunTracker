using RunTracker.Domain.Enums;

namespace RunTracker.Application.Training.DTOs;

public record ScheduledWorkoutDto(
    Guid Id,
    string Date,
    string Title,
    WorkoutType WorkoutType,
    SportType? SportType,
    string? Notes,
    double? PlannedDistanceMeters,
    int? PlannedDurationSeconds,
    int? PlannedPaceSecondsPerKm,
    int? PlannedHeartRateZone,
    DateTime CreatedAt,
    string? Location = null,
    int? GoalTimeSecs = null,
    int? ResultTimeSecs = null,
    double? RaceDistanceMeters = null,
    Guid? LinkedActivityId = null
);

public record CreateScheduledWorkoutRequest(
    string Date,
    string Title,
    WorkoutType WorkoutType,
    SportType? SportType,
    string? Notes,
    double? PlannedDistanceMeters,
    int? PlannedDurationSeconds,
    int? PlannedPaceSecondsPerKm,
    int? PlannedHeartRateZone,
    string? Location = null,
    int? GoalTimeSecs = null,
    int? ResultTimeSecs = null,
    double? RaceDistanceMeters = null,
    Guid? LinkedActivityId = null
);

public record UpdateScheduledWorkoutRequest(
    string Date,
    string Title,
    WorkoutType WorkoutType,
    SportType? SportType,
    string? Notes,
    double? PlannedDistanceMeters,
    int? PlannedDurationSeconds,
    int? PlannedPaceSecondsPerKm,
    int? PlannedHeartRateZone,
    string? Location = null,
    int? GoalTimeSecs = null,
    int? ResultTimeSecs = null,
    double? RaceDistanceMeters = null,
    Guid? LinkedActivityId = null
);

public record DuplicateScheduledWorkoutRequest(string TargetDate);

public record BatchImportRequest(List<CreateScheduledWorkoutRequest> Workouts);
