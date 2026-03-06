namespace RunTracker.Domain.Enums;

public enum HrZoneAlgorithm
{
    FiveZonePercentMax = 0,   // Simple % of MaxHR (most common)
    FiveZoneKarvonen = 1,     // Karvonen formula using Heart Rate Reserve
    GarminFiveZone = 2,       // Garmin's default 5-zone model
    SevenZonePolarized = 3,   // 7-zone polarized model
    Custom = 4,               // User-defined zone boundaries
}
