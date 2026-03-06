namespace RunTracker.Domain.Entities;

/// <summary>
/// Single-row table (Id = 1) that stores application-level settings that can be
/// managed through the UI instead of requiring environment variable restarts.
/// </summary>
public class SystemSettings
{
    public int Id { get; set; } = 1;
    public string? StravaClientId { get; set; }
    public string? StravaClientSecret { get; set; }
}
