using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class PlannedRoute : BaseEntity
{
    public string UserId { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Total route distance in meters</summary>
    public double DistanceM { get; set; }

    /// <summary>Google-encoded polyline of the waypoints</summary>
    public string? EncodedPolyline { get; set; }

    public User User { get; set; } = null!;
}
