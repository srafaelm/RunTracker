using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Infrastructure.Services;

public class StravaService : IStravaService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IApplicationDbContext _db;
    private readonly ILogger<StravaService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public StravaService(HttpClient httpClient, IConfiguration configuration, IApplicationDbContext db, ILogger<StravaService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _db = db;
        _logger = logger;
        _httpClient.BaseAddress = new Uri("https://www.strava.com/api/v3/");
    }

    /// <summary>
    /// Returns the Strava ClientId: DB value takes priority over appsettings/environment.
    /// </summary>
    private async Task<string?> GetClientIdAsync(CancellationToken ct = default)
    {
        var settings = await _db.SystemSettings.FindAsync([1], ct);
        return !string.IsNullOrWhiteSpace(settings?.StravaClientId)
            ? settings.StravaClientId
            : _configuration["Strava:ClientId"];
    }

    /// <summary>
    /// Returns the Strava ClientSecret: DB value takes priority over appsettings/environment.
    /// </summary>
    private async Task<string?> GetClientSecretAsync(CancellationToken ct = default)
    {
        var settings = await _db.SystemSettings.FindAsync([1], ct);
        return !string.IsNullOrWhiteSpace(settings?.StravaClientSecret)
            ? settings.StravaClientSecret
            : _configuration["Strava:ClientSecret"];
    }

    public async Task<StravaTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync("https://www.strava.com/oauth/token", new
        {
            client_id = await GetClientIdAsync(ct),
            client_secret = await GetClientSecretAsync(ct),
            code,
            grant_type = "authorization_code"
        }, ct);

        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<StravaOAuthResponse>(JsonOptions, ct);
        return new StravaTokenResponse(result!.AccessToken, result.RefreshToken, result.ExpiresAt, result.Athlete?.Id);
    }

    public async Task<StravaTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var response = await _httpClient.PostAsJsonAsync("https://www.strava.com/oauth/token", new
        {
            client_id = await GetClientIdAsync(ct),
            client_secret = await GetClientSecretAsync(ct),
            refresh_token = refreshToken,
            grant_type = "refresh_token"
        }, ct);

        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<StravaOAuthResponse>(JsonOptions, ct);
        return new StravaTokenResponse(result!.AccessToken, result.RefreshToken, result.ExpiresAt, null);
    }

    public async Task<IEnumerable<StravaActivitySummary>> GetAthleteActivitiesAsync(
        string accessToken, long? after = null, long? before = null, int page = 1, int perPage = 30, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildUrl("athlete/activities", new Dictionary<string, string?>
        {
            ["after"] = after?.ToString(),
            ["before"] = before?.ToString(),
            ["page"] = page.ToString(),
            ["per_page"] = perPage.ToString()
        }));
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(request, ct);
        CheckRateLimits(response);
        response.EnsureSuccessStatusCode();

        var activities = await response.Content.ReadFromJsonAsync<List<StravaApiActivity>>(JsonOptions, ct);
        return activities?.Select(a => new StravaActivitySummary(
            a.Id, a.Name ?? "", a.SportType ?? "Run", a.StartDate,
            a.Distance, (int)a.MovingTime, (int)a.ElapsedTime, a.TotalElevationGain,
            a.AverageSpeed, a.MaxSpeed, a.AverageHeartrate, (int?)a.MaxHeartrate,
            a.AverageCadence, (int?)a.Calories, a.Map?.SummaryPolyline
        )) ?? [];
    }

    public async Task<StravaActivityDetail> GetActivityAsync(string accessToken, long activityId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"activities/{activityId}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(request, ct);
        CheckRateLimits(response);
        response.EnsureSuccessStatusCode();

        var a = await response.Content.ReadFromJsonAsync<StravaApiActivity>(JsonOptions, ct);
        return new StravaActivityDetail(
            a!.Id, a.Name ?? "", a.SportType ?? "Run", a.StartDate,
            a.Distance, (int)a.MovingTime, (int)a.ElapsedTime, a.TotalElevationGain,
            a.AverageSpeed, a.MaxSpeed, a.AverageHeartrate, (int?)a.MaxHeartrate,
            a.AverageCadence, (int?)a.Calories, a.Map?.SummaryPolyline, a.Map?.Polyline,
            a.AverageTemp
        );
    }

    public async Task<StravaActivityStreams> GetActivityStreamsAsync(string accessToken, long activityId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"activities/{activityId}/streams?keys=latlng,distance,altitude,heartrate,cadence,time&key_by_type=true");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(request, ct);
        CheckRateLimits(response);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        var doc = JsonDocument.Parse(json);

        double[][]? latLng = null;
        double[]? distance = null;
        double[]? altitude = null;
        int[]? heartrate = null;
        int[]? cadence = null;
        int[]? time = null;

        if (doc.RootElement.TryGetProperty("latlng", out var latLngEl) && latLngEl.TryGetProperty("data", out var latLngData))
            latLng = latLngData.Deserialize<double[][]>();
        if (doc.RootElement.TryGetProperty("distance", out var distEl) && distEl.TryGetProperty("data", out var distData))
            distance = distData.Deserialize<double[]>();
        if (doc.RootElement.TryGetProperty("altitude", out var altEl) && altEl.TryGetProperty("data", out var altData))
            altitude = altData.Deserialize<double[]>();
        if (doc.RootElement.TryGetProperty("heartrate", out var hrEl) && hrEl.TryGetProperty("data", out var hrData))
            heartrate = hrData.Deserialize<int[]>();
        if (doc.RootElement.TryGetProperty("cadence", out var cadEl) && cadEl.TryGetProperty("data", out var cadData))
            cadence = cadData.Deserialize<int[]>();
        if (doc.RootElement.TryGetProperty("time", out var timeEl) && timeEl.TryGetProperty("data", out var timeData))
            time = timeData.Deserialize<int[]>();

        return new StravaActivityStreams(latLng, distance, altitude, heartrate, cadence, time);
    }

    public async Task<StravaAthleteStats> GetAthleteStatsAsync(string accessToken, long athleteId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"athletes/{athleteId}/stats");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _httpClient.SendAsync(request, ct);
        CheckRateLimits(response);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<StravaStatsResponse>(JsonOptions, ct);
        return new StravaAthleteStats(
            json?.AllRunTotals?.Count ?? 0,
            json?.AllRideTotals?.Count ?? 0,
            json?.AllSwimTotals?.Count ?? 0
        );
    }

    private void CheckRateLimits(HttpResponseMessage response)
    {
        // 429 = rate limit hit
        if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            throw new StravaRateLimitException(isDailyLimit: false);

        if (!response.Headers.TryGetValues("X-RateLimit-Usage", out var usageValues))
            return;

        var parts = usageValues.FirstOrDefault()?.Split(',');
        if (parts?.Length != 2) return;

        if (!int.TryParse(parts[0].Trim(), out var fifteenMin) ||
            !int.TryParse(parts[1].Trim(), out var daily)) return;

        _logger.LogDebug("Strava rate limit usage: {FifteenMin}/100 (15min), {Daily}/1000 (daily)", fifteenMin, daily);

        // Check limit headers if present, otherwise use defaults
        int fifteenMinLimit = 100, dailyLimit = 1000;
        if (response.Headers.TryGetValues("X-RateLimit-Limit", out var limitValues))
        {
            var limitParts = limitValues.FirstOrDefault()?.Split(',');
            if (limitParts?.Length == 2)
            {
                int.TryParse(limitParts[0].Trim(), out fifteenMinLimit);
                int.TryParse(limitParts[1].Trim(), out dailyLimit);
            }
        }

        if (daily >= dailyLimit)
            throw new StravaRateLimitException(isDailyLimit: true);

        if (fifteenMin >= fifteenMinLimit)
            throw new StravaRateLimitException(isDailyLimit: false);

        if (fifteenMin > fifteenMinLimit * 0.9)
            _logger.LogWarning("Approaching 15-minute Strava rate limit: {Usage}/{Limit}", fifteenMin, fifteenMinLimit);
        if (daily > dailyLimit * 0.9)
            _logger.LogWarning("Approaching daily Strava rate limit: {Usage}/{Limit}", daily, dailyLimit);
    }

    private static string BuildUrl(string path, Dictionary<string, string?> queryParams)
    {
        var filtered = queryParams.Where(kv => kv.Value is not null).Select(kv => $"{kv.Key}={kv.Value}");
        var qs = string.Join("&", filtered);
        return string.IsNullOrEmpty(qs) ? path : $"{path}?{qs}";
    }

    // Internal DTOs for Strava API deserialization
    private class StravaStatsResponse
    {
        public StravaSportTotals? AllRunTotals { get; set; }
        public StravaSportTotals? AllRideTotals { get; set; }
        public StravaSportTotals? AllSwimTotals { get; set; }
    }

    private class StravaSportTotals
    {
        public int Count { get; set; }
    }

    private class StravaApiActivity
    {
        public long Id { get; set; }
        public string? Name { get; set; }
        public string? SportType { get; set; }
        public DateTime StartDate { get; set; }
        public double Distance { get; set; }
        public double MovingTime { get; set; }
        public double ElapsedTime { get; set; }
        public double TotalElevationGain { get; set; }
        public double? AverageSpeed { get; set; }
        public double? MaxSpeed { get; set; }
        public double? AverageHeartrate { get; set; }
        public double? MaxHeartrate { get; set; }
        public double? AverageCadence { get; set; }
        public double? Calories { get; set; }
        public StravaMap? Map { get; set; }
        public double? AverageTemp { get; set; }
    }

    private class StravaMap
    {
        public string? SummaryPolyline { get; set; }
        public string? Polyline { get; set; }
    }

    private class StravaOAuthResponse
    {
        public string AccessToken { get; set; } = "";
        public string RefreshToken { get; set; } = "";
        public long ExpiresAt { get; set; }
        public StravaAthlete? Athlete { get; set; }
    }

    private class StravaAthlete
    {
        public long Id { get; set; }
    }
}
