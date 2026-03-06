using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class UserGoal : BaseEntity
{
    public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;

    /// <summary>null means "all sport types"</summary>
    public SportType? SportType { get; set; }

    public GoalPeriod Period { get; set; }

    /// <summary>Target distance in kilometers</summary>
    public double TargetDistanceKm { get; set; }

    public bool IsActive { get; set; } = true;
}
