using NetTopologySuite.Geometries;
using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class City : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string Country { get; set; } = string.Empty;
    public long OsmRelationId { get; set; }

    /// <summary>City boundary polygon (SRID 4326)</summary>
    public MultiPolygon? Boundary { get; set; }

    public int TotalStreets { get; set; }
    public int TotalNodes { get; set; }

    // Navigation
    public ICollection<Street> Streets { get; set; } = new List<Street>();
}
