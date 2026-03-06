namespace RunTracker.Domain.Entities;

/// <summary>
/// Records that a user has visited a specific street node during an activity.
/// </summary>
public class UserStreetNode
{
    public string UserId { get; set; } = null!;
    public Guid StreetNodeId { get; set; }
    public DateTime FirstCompletedAt { get; set; } = DateTime.UtcNow;
    public Guid ActivityId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public StreetNode StreetNode { get; set; } = null!;
    public Activity Activity { get; set; } = null!;
}
