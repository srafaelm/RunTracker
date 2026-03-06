using NetTopologySuite.Geometries;

namespace RunTracker.Domain.Entities;

public class StreetNode
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StreetId { get; set; }
    public long OsmNodeId { get; set; }

    /// <summary>Spatial point for geographic queries (SRID 4326)</summary>
    public Point Location { get; set; } = null!;

    public int SequenceIndex { get; set; }

    // Navigation
    public Street Street { get; set; } = null!;
    public ICollection<UserStreetNode> UserCompletions { get; set; } = new List<UserStreetNode>();
}
