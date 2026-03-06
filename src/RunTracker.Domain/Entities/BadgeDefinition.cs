using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

/// <summary>
/// Configurable badge metadata stored in the database.
/// Id is the integer primary key (matches the BadgeType enum value).
/// BadgeType is a strongly-typed enum column for the same value.
/// </summary>
public class BadgeDefinition
{
    public int Id { get; set; }
    public BadgeType BadgeType { get; set; }
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public string Category { get; set; } = null!;
    public int SortOrder { get; set; }
}
