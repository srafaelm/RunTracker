using NetTopologySuite.Geometries;
using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class Street : BaseEntity
{
    public long OsmWayId { get; set; }
    public Guid CityId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>OSM highway type (residential, tertiary, etc.)</summary>
    public string HighwayType { get; set; } = string.Empty;

    /// <summary>Street geometry (SRID 4326)</summary>
    public LineString? Geometry { get; set; }

    public int NodeCount { get; set; }
    public double TotalLengthMeters { get; set; }

    // Navigation
    public City City { get; set; } = null!;
    public ICollection<StreetNode> Nodes { get; set; } = new List<StreetNode>();
}
