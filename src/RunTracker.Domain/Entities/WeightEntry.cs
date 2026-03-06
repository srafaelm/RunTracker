using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class WeightEntry : BaseEntity
{
    public string UserId { get; set; } = null!;

    /// <summary>Date of the weight measurement (one entry per day).</summary>
    public DateOnly Date { get; set; }

    /// <summary>Weight in kilograms.</summary>
    public double WeightKg { get; set; }

    public User User { get; set; } = null!;
}
