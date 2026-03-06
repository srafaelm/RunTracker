using Microsoft.AspNetCore.Identity;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class User : IdentityUser
{
    public long? StravaAthleteId { get; set; }
    public string? StravaAccessToken { get; set; }
    public string? StravaRefreshToken { get; set; }
    public DateTime? StravaTokenExpiry { get; set; }

    // Sync state tracking
    /// <summary>Cursor for resumable historical sync: the 'before' timestamp for the next batch. Null = not started.</summary>
    public DateTime? StravaHistoricalSyncCursor { get; set; }
    /// <summary>True when we've fetched all historical activities from Strava.</summary>
    public bool StravaHistoricalSyncComplete { get; set; }
    /// <summary>Start date of the newest synced activity, used as 'after' for incremental syncs.</summary>
    public DateTime? StravaNewestSyncedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public double? WeightKg { get; set; }
    public double? GoalWeightKg { get; set; }
    public int? HeightCm { get; set; }
    public int? MaxHeartRate { get; set; }
    public int? RestingHeartRate { get; set; }
    public HrZoneAlgorithm HrZoneAlgorithm { get; set; } = HrZoneAlgorithm.FiveZonePercentMax;
    public Gender Gender { get; set; } = Gender.Unknown;
    public int? BirthYear { get; set; }
    public int? BirthMonth { get; set; }
    public int? BirthDay { get; set; }
    public string? ProfilePictureUrl { get; set; }
    public string? DashboardConfig { get; set; }
    public string? CustomHrZones { get; set; }  // JSON array of 5 upper bpm boundaries
    /// <summary>JSON int[] of SportType values the user has chosen to hide from lists, graphs, and statistics.</summary>
    public string? HiddenSportTypes { get; set; }

    // Navigation properties
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
    public ICollection<PersonalRecord> PersonalRecords { get; set; } = new List<PersonalRecord>();
    public ICollection<ScheduledWorkout> ScheduledWorkouts { get; set; } = new List<ScheduledWorkout>();
    public ICollection<UserBadge> Badges { get; set; } = new List<UserBadge>();
    public ICollection<UserFollow> Following { get; set; } = new List<UserFollow>();
    public ICollection<UserFollow> Followers { get; set; } = new List<UserFollow>();
}
