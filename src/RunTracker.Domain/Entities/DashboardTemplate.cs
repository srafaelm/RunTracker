using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class DashboardTemplate : BaseEntity
{
    public string UserId { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Widgets { get; set; } = "[]"; // JSON array of widget IDs
    public bool IsDefault { get; set; }
    public int SortOrder { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
