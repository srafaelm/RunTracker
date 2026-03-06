using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class PersonalRecord : BaseEntity
{
    public string UserId { get; set; } = null!;
    public RecordType RecordType { get; set; }

    /// <summary>
    /// Value meaning depends on RecordType:
    /// - For Fastest*: time in seconds
    /// - For LongestRun: distance in meters
    /// </summary>
    public double Value { get; set; }

    public Guid ActivityId { get; set; }
    public DateTime AchievedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Activity Activity { get; set; } = null!;
}
