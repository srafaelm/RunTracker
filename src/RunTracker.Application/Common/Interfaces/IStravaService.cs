namespace RunTracker.Application.Common.Interfaces;

public class StravaRateLimitException : Exception
{
    public bool IsDailyLimit { get; }
    public StravaRateLimitException(bool isDailyLimit)
        : base(isDailyLimit ? "Strava daily rate limit exhausted" : "Strava 15-minute rate limit exhausted")
    {
        IsDailyLimit = isDailyLimit;
    }
}

public interface IStravaService
{
    Task<IEnumerable<StravaActivitySummary>> GetAthleteActivitiesAsync(string accessToken, long? after = null, long? before = null, int page = 1, int perPage = 30, CancellationToken ct = default);
    Task<StravaActivityDetail> GetActivityAsync(string accessToken, long activityId, CancellationToken ct = default);
    Task<StravaActivityStreams> GetActivityStreamsAsync(string accessToken, long activityId, CancellationToken ct = default);
    Task<StravaAthleteStats> GetAthleteStatsAsync(string accessToken, long athleteId, CancellationToken ct = default);
    Task<StravaTokenResponse> ExchangeCodeAsync(string code, CancellationToken ct = default);
    Task<StravaTokenResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
}

/// <summary>
/// Activity totals from Strava's /athletes/{id}/stats endpoint.
/// Strava only breaks these down by sport (run/ride/swim) — no single combined total.
/// </summary>
public record StravaAthleteStats(
    int AllRunCount,
    int AllRideCount,
    int AllSwimCount
)
{
    public int ApproximateTotal => AllRunCount + AllRideCount + AllSwimCount;
}

public record StravaActivitySummary(
    long Id,
    string Name,
    string SportType,
    DateTime StartDate,
    double Distance,
    int MovingTime,
    int ElapsedTime,
    double TotalElevationGain,
    double? AverageSpeed,
    double? MaxSpeed,
    double? AverageHeartrate,
    int? MaxHeartrate,
    double? AverageCadence,
    int? Calories,
    string? MapSummaryPolyline
);

public record StravaActivityDetail(
    long Id,
    string Name,
    string SportType,
    DateTime StartDate,
    double Distance,
    int MovingTime,
    int ElapsedTime,
    double TotalElevationGain,
    double? AverageSpeed,
    double? MaxSpeed,
    double? AverageHeartrate,
    int? MaxHeartrate,
    double? AverageCadence,
    int? Calories,
    string? MapSummaryPolyline,
    string? MapPolyline,
    double? AverageTemp = null
);

public record StravaActivityStreams(
    double[][]? LatLng,
    double[]? Distance,
    double[]? Altitude,
    int[]? Heartrate,
    int[]? Cadence,
    int[]? Time
);

public record StravaTokenResponse(
    string AccessToken,
    string RefreshToken,
    long ExpiresAt,
    long? AthleteId
);
