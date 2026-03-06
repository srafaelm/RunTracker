using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

/// <summary>
/// Records an achievement earned by a user.
/// Composite PK: (UserId, BadgeType).
/// </summary>
public class UserBadge
{
    public string UserId { get; set; } = null!;
    public BadgeType BadgeType { get; set; }
    public DateTime EarnedAt { get; set; } = DateTime.UtcNow;
    public Guid? ActivityId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Activity? Activity { get; set; }
}
