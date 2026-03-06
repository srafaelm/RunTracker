using NetTopologySuite.Geometries;

namespace RunTracker.Domain.Entities;

public class ActivityStream
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ActivityId { get; set; }
    public int PointIndex { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? Altitude { get; set; }

    /// <summary>Time offset in seconds from activity start</summary>
    public int? Time { get; set; }

    /// <summary>Cumulative distance in meters</summary>
    public double? Distance { get; set; }

    public int? HeartRate { get; set; }

    /// <summary>Speed in meters per second</summary>
    public double? Speed { get; set; }

    public int? Cadence { get; set; }

    /// <summary>Spatial point for geographic queries (SRID 4326)</summary>
    public Point? Location { get; set; }

    // Navigation
    public Activity Activity { get; set; } = null!;
}
