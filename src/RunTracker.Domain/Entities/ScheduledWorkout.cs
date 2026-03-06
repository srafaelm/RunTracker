using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class ScheduledWorkout : BaseEntity
{
    public string UserId { get; set; } = null!;
    public DateTime Date { get; set; }
    public string Title { get; set; } = null!;
    public WorkoutType WorkoutType { get; set; }
    public SportType? SportType { get; set; }
    public string? Notes { get; set; }
    public double? PlannedDistanceMeters { get; set; }
    public int? PlannedDurationSeconds { get; set; }
    public int? PlannedPaceSecondsPerKm { get; set; }
    public int? PlannedHeartRateZone { get; set; }

    // Race-specific fields (meaningful when WorkoutType == Race)
    public string? Location { get; set; }
    public int? GoalTimeSecs { get; set; }
    public int? ResultTimeSecs { get; set; }
    public double? RaceDistanceMeters { get; set; }
    public Guid? LinkedActivityId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Activity? LinkedActivity { get; set; }
}
