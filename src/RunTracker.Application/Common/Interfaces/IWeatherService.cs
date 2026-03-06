namespace RunTracker.Application.Common.Interfaces;

public record WeatherData(
    double TempC,
    int HumidityPct,
    double WindSpeedKmh,
    string Condition
);

public interface IWeatherService
{
    /// <summary>
    /// Fetches weather conditions for the given location and time.
    /// Returns null if the data is unavailable (e.g. too far in the past).
    /// </summary>
    Task<WeatherData?> GetWeatherAsync(double latitude, double longitude, DateTime utcTime, CancellationToken ct = default);
}
