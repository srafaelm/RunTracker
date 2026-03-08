using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace RunTracker.Infrastructure.Services;

public interface IRouteGenerationService
{
    Task<GeneratedRouteResult> GenerateAsync(
        double startLat, double startLng,
        double targetDistanceM, int seed,
        CancellationToken ct = default);
}

public record GeneratedRouteResult(
    IReadOnlyList<(double Lat, double Lng)> Waypoints,
    double ActualDistanceM,
    string Source); // "ors" | "geometric"

public class RouteGenerationService : IRouteGenerationService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<RouteGenerationService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public RouteGenerationService(
        HttpClient httpClient,
        IConfiguration config,
        ILogger<RouteGenerationService> logger)
    {
        _httpClient = httpClient;
        _httpClient.BaseAddress = new Uri("https://api.openrouteservice.org/");
        _httpClient.Timeout = TimeSpan.FromSeconds(15);
        _config = config;
        _logger = logger;
    }

    public async Task<GeneratedRouteResult> GenerateAsync(
        double startLat, double startLng,
        double targetDistanceM, int seed,
        CancellationToken ct = default)
    {
        var apiKey = _config["OpenRouteService:ApiKey"];

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            try
            {
                return await GenerateWithOrsAsync(startLat, startLng, targetDistanceM, seed, apiKey, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ORS route generation failed, falling back to geometric. Message: {Msg}", ex.Message);
            }
        }

        return GenerateGeometric(startLat, startLng, targetDistanceM);
    }

    // ── ORS round-trip routing ────────────────────────────────────────────────

    private async Task<GeneratedRouteResult> GenerateWithOrsAsync(
        double startLat, double startLng,
        double targetDistanceM, int seed,
        string apiKey, CancellationToken ct)
    {
        // ORS expects [longitude, latitude]
        var body = new
        {
            coordinates = new[] { new[] { startLng, startLat } },
            options = new
            {
                round_trip = new
                {
                    length = (int)targetDistanceM,
                    points = 5,
                    seed
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "v2/directions/foot-walking");
        request.Headers.TryAddWithoutValidation("Authorization", apiKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(body, JsonOpts),
            System.Text.Encoding.UTF8,
            "application/json");

        var response = await _httpClient.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"ORS {(int)response.StatusCode}: {json}");
        using var doc = JsonDocument.Parse(json);

        var root = doc.RootElement;
        var routes = root.GetProperty("routes");
        if (routes.GetArrayLength() == 0)
            throw new InvalidOperationException("ORS returned no routes");

        var route = routes[0];
        var encodedPolyline = route.GetProperty("geometry").GetString()!;
        var summary = route.GetProperty("summary");
        var actualDistanceM = summary.GetProperty("distance").GetDouble();

        var waypoints = DecodePolyline(encodedPolyline);
        _logger.LogInformation("ORS generated route: {Points} pts, {Dist:F0} m", waypoints.Count, actualDistanceM);

        return new GeneratedRouteResult(waypoints, actualDistanceM, "ors");
    }

    // ── Geometric circular fallback ───────────────────────────────────────────

    private GeneratedRouteResult GenerateGeometric(double startLat, double startLng, double targetDistanceM)
    {
        // Roads are ~10% longer than direct distance, so shrink the radius slightly
        double radius = targetDistanceM / (2 * Math.PI) * 0.9;

        const int points = 8;
        var waypoints = new List<(double Lat, double Lng)>(points + 1);

        // Metres per degree (approximate)
        double latDegPerM = 1.0 / 111320.0;
        double lngDegPerM = 1.0 / (111320.0 * Math.Cos(startLat * Math.PI / 180.0));

        for (int i = 0; i <= points; i++)
        {
            double angle = (2 * Math.PI * i) / points;
            double lat = startLat + Math.Sin(angle) * radius * latDegPerM;
            double lng = startLng + Math.Cos(angle) * radius * lngDegPerM;
            waypoints.Add((lat, lng));
        }

        // Estimate actual distance using haversine around the circle
        double actualDist = 0;
        for (int i = 1; i < waypoints.Count; i++)
            actualDist += HaversineM(waypoints[i - 1], waypoints[i]);

        _logger.LogInformation("Geometric route: {Points} pts, {Dist:F0} m", waypoints.Count, actualDist);
        return new GeneratedRouteResult(waypoints, actualDist, "geometric");
    }

    // ── Polyline decoder (Google encoded polyline format) ─────────────────────

    private static List<(double Lat, double Lng)> DecodePolyline(string encoded)
    {
        var result = new List<(double, double)>();
        int index = 0, lat = 0, lng = 0;

        while (index < encoded.Length)
        {
            lat += DecodeChunk(encoded, ref index);
            lng += DecodeChunk(encoded, ref index);
            result.Add((lat / 1e5, lng / 1e5));
        }

        return result;
    }

    private static int DecodeChunk(string encoded, ref int index)
    {
        int result = 0, shift = 0;
        int b;
        do
        {
            b = encoded[index++] - 63;
            result |= (b & 0x1F) << shift;
            shift += 5;
        } while (b >= 0x20);

        return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
    }

    // ── Haversine ─────────────────────────────────────────────────────────────

    private static double HaversineM((double Lat, double Lng) a, (double Lat, double Lng) b)
    {
        const double R = 6371000;
        double dLat = (b.Lat - a.Lat) * Math.PI / 180;
        double dLng = (b.Lng - a.Lng) * Math.PI / 180;
        double x =
            Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(a.Lat * Math.PI / 180) * Math.Cos(b.Lat * Math.PI / 180) *
            Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(x), Math.Sqrt(1 - x));
    }
}
