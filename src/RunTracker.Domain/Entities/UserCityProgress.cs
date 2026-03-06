namespace RunTracker.Domain.Entities;

/// <summary>
/// Tracks a user's street coverage progress in a city.
/// </summary>
public class UserCityProgress
{
    public string UserId { get; set; } = null!;
    public Guid CityId { get; set; }
    public int CompletedStreets { get; set; }
    public int CompletedNodes { get; set; }
    public double CompletionPercentage { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public City City { get; set; } = null!;
}
