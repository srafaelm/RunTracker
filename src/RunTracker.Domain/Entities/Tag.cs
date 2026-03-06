using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

/// <summary>User-defined label for activities.</summary>
public class Tag : BaseEntity
{
    public string UserId { get; set; } = null!;
    public string Name { get; set; } = null!;   // max 100
    public string? Color { get; set; }           // hex colour e.g. "#3b82f6"

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<ActivityTag> ActivityTags { get; set; } = new List<ActivityTag>();
}
