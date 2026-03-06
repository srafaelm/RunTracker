using System.Text.Json;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Infrastructure.Services;

/// <summary>
/// Fetches historical weather from the free Open-Meteo Historical Weather API.
/// No API key required. Covers dates back to 1940.
/// Docs: https://open-meteo.com/en/docs/historical-weather-api
/// </summary>
public class OpenMeteoWeatherService : IWeatherService
{
    private readonly HttpClient _httpClient;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public OpenMeteoWeatherService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<WeatherData?> GetWeatherAsync(double latitude, double longitude, DateTime utcTime, CancellationToken ct = default)
    {
        // Open-Meteo historical API requires dates; we request a 1-day window around the activity
        var dateStr = utcTime.ToString("yyyy-MM-dd");

        var url = $"https://archive-api.open-meteo.com/v1/archive" +
                  $"?latitude={latitude:F4}&longitude={longitude:F4}" +
                  $"&start_date={dateStr}&end_date={dateStr}" +
                  "&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,weathercode" +
                  "&timezone=UTC";

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode) return null;
        }
        catch
        {
            return null;
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("hourly", out var hourly)) return null;

        if (!hourly.TryGetProperty("time", out var times)
            || !hourly.TryGetProperty("temperature_2m", out var temps)
            || !hourly.TryGetProperty("relativehumidity_2m", out var humidity)
            || !hourly.TryGetProperty("windspeed_10m", out var wind)
            || !hourly.TryGetProperty("weathercode", out var codes))
            return null;

        // Find the hour index closest to the activity start time
        var targetHour = utcTime.ToString("yyyy-MM-ddTHH:00");
        int idx = -1;
        var timesArr = times.EnumerateArray().ToList();
        for (int i = 0; i < timesArr.Count; i++)
        {
            if (timesArr[i].GetString() == targetHour)
            {
                idx = i;
                break;
            }
        }
        if (idx < 0) idx = utcTime.Hour < timesArr.Count ? utcTime.Hour : 0;

        double tempC = temps[idx].ValueKind == JsonValueKind.Number ? temps[idx].GetDouble() : 0;
        int humPct = humidity[idx].ValueKind == JsonValueKind.Number ? humidity[idx].GetInt32() : 0;
        double windKmh = wind[idx].ValueKind == JsonValueKind.Number ? wind[idx].GetDouble() : 0;
        int wmoCode = codes[idx].ValueKind == JsonValueKind.Number ? codes[idx].GetInt32() : 0;

        return new WeatherData(tempC, humPct, windKmh, WmoCodeToCondition(wmoCode));
    }

    /// <summary>Maps WMO weather interpretation codes to human-readable labels.</summary>
    private static string WmoCodeToCondition(int code) => code switch
    {
        0 => "Clear",
        1 or 2 or 3 => "Partly Cloudy",
        45 or 48 => "Foggy",
        51 or 53 or 55 => "Drizzle",
        56 or 57 => "Freezing Drizzle",
        61 or 63 or 65 => "Rain",
        66 or 67 => "Freezing Rain",
        71 or 73 or 75 => "Snow",
        77 => "Snow Grains",
        80 or 81 or 82 => "Showers",
        85 or 86 => "Snow Showers",
        95 => "Thunderstorm",
        96 or 99 => "Thunderstorm with Hail",
        _ => "Unknown",
    };
}
