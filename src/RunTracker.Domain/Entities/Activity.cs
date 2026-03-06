using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class Activity : BaseEntity
{
    public string UserId { get; set; } = null!;
    public long? ExternalId { get; set; }
    public ActivitySource Source { get; set; }
    public string Name { get; set; } = string.Empty;
    public SportType SportType { get; set; }
    public DateTime StartDate { get; set; }

    /// <summary>Distance in meters</summary>
    public double Distance { get; set; }

    /// <summary>Moving time in seconds</summary>
    public int MovingTime { get; set; }

    /// <summary>Elapsed time in seconds</summary>
    public int ElapsedTime { get; set; }

    /// <summary>Total elevation gain in meters</summary>
    public double TotalElevationGain { get; set; }

    /// <summary>Average speed in meters per second</summary>
    public double? AverageSpeed { get; set; }

    /// <summary>Max speed in meters per second</summary>
    public double? MaxSpeed { get; set; }

    public double? AverageHeartRate { get; set; }
    public int? MaxHeartRate { get; set; }
    public double? AverageCadence { get; set; }
    public int? Calories { get; set; }

    /// <summary>Encoded polyline for map overview</summary>
    public string? SummaryPolyline { get; set; }

    /// <summary>Detailed encoded polyline for full route</summary>
    public string? DetailedPolyline { get; set; }

    // Weather data (from Strava or Open-Meteo)
    public double? WeatherTempC { get; set; }
    public int? WeatherHumidityPct { get; set; }
    public double? WeatherWindSpeedKmh { get; set; }
    public string? WeatherCondition { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
    public ICollection<ActivityStream> Streams { get; set; } = new List<ActivityStream>();
    public ICollection<ActivityTag> ActivityTags { get; set; } = new List<ActivityTag>();

    // Gear tracking
    public Guid? GearId { get; set; }
    public Gear? Gear { get; set; }
}
