namespace RunTracker.Domain.Entities;

/// <summary>Join table linking activities to user-defined tags.</summary>
public class ActivityTag
{
    public Guid ActivityId { get; set; }
    public Guid TagId { get; set; }

    // Navigation
    public Activity Activity { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
