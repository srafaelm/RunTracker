namespace RunTracker.Domain.Entities;

/// <summary>
/// Configurable badge metadata stored in the database.
/// Id matches the BadgeType enum integer value.
/// </summary>
public class BadgeDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public string Category { get; set; } = null!;
    public int SortOrder { get; set; }
}
