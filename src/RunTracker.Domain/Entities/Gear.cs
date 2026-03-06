using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class Gear : BaseEntity
{
    public string UserId { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Brand { get; set; }
    public GearType Type { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public string? Notes { get; set; }

    /// <summary>Distance already on the gear before tracking started (meters)</summary>
    public double StartingDistanceM { get; set; }

    /// <summary>Distance at which to retire this gear (meters). Null = no limit.</summary>
    public double? RetirementDistanceM { get; set; }

    public bool IsRetired { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}
