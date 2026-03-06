namespace RunTracker.Domain.Entities;

/// <summary>
/// Records that a user has visited a slippy-map zoom-15 tile (~1.2km²).
/// Composite PK: (UserId, TileX, TileY).
/// </summary>
public class UserTile
{
    public string UserId { get; set; } = null!;
    public int TileX { get; set; }
    public int TileY { get; set; }
    public DateTime FirstVisitedAt { get; set; } = DateTime.UtcNow;
    public Guid ActivityId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Activity Activity { get; set; } = null!;
}
