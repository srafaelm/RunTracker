using System.Threading.Channels;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Infrastructure.Services;

public record StravaWebhookEvent(string ObjectType, long ObjectId, string AspectType, long OwnerId);

public class StravaSyncBackgroundService : BackgroundService
{
    private readonly Channel<StravaWebhookEvent> _channel;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<StravaSyncBackgroundService> _logger;

    public StravaSyncBackgroundService(
        Channel<StravaWebhookEvent> channel,
        IServiceScopeFactory scopeFactory,
        ILogger<StravaSyncBackgroundService> logger)
    {
        _channel = channel;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public static Channel<StravaWebhookEvent> CreateChannel() =>
        Channel.CreateUnbounded<StravaWebhookEvent>(new UnboundedChannelOptions { SingleReader = true });

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Strava sync background service started");

        await foreach (var evt in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessEventAsync(evt, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Strava webhook event: {ObjectType} {ObjectId}", evt.ObjectType, evt.ObjectId);
            }
        }
    }

    private async Task ProcessEventAsync(StravaWebhookEvent evt, CancellationToken ct)
    {
        if (evt.ObjectType != "activity") return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var stravaService = scope.ServiceProvider.GetRequiredService<IStravaService>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var prService = scope.ServiceProvider.GetRequiredService<PersonalRecordService>();
        var vo2maxSnapshotService = scope.ServiceProvider.GetRequiredService<Vo2maxSnapshotService>();
        var streetMatchingService = scope.ServiceProvider.GetRequiredService<IStreetMatchingService>();
        var tileService = scope.ServiceProvider.GetRequiredService<ITileService>();
        var badgeService = scope.ServiceProvider.GetRequiredService<IBadgeService>();

        var user = await userManager.Users.FirstOrDefaultAsync(u => u.StravaAthleteId == evt.OwnerId, ct);
        if (user is null)
        {
            _logger.LogWarning("No user found for Strava athlete {AthleteId}", evt.OwnerId);
            return;
        }

        var accessToken = await EnsureValidToken(user, stravaService, userManager, ct);

        switch (evt.AspectType)
        {
            case "create":
            case "update":
                await SyncActivityAsync(db, stravaService, prService, vo2maxSnapshotService, streetMatchingService, tileService, badgeService, user, accessToken, evt.ObjectId, ct);
                // Update the newest synced pointer when a new activity arrives via webhook
                var activity = await db.Activities.FirstOrDefaultAsync(a => a.ExternalId == evt.ObjectId && a.UserId == user.Id, ct);
                if (activity is not null && activity.StartDate > (user.StravaNewestSyncedAt ?? DateTime.MinValue))
                {
                    user.StravaNewestSyncedAt = activity.StartDate;
                    await userManager.UpdateAsync(user);
                }
                break;
            case "delete":
                var existing = await db.Activities.FirstOrDefaultAsync(a => a.ExternalId == evt.ObjectId && a.UserId == user.Id, ct);
                if (existing is not null)
                {
                    db.Activities.Remove(existing);
                    await db.SaveChangesAsync(ct);
                    _logger.LogInformation("Deleted activity {ExternalId} for user {UserId}", evt.ObjectId, user.Id);
                }
                break;
        }
    }

    /// <summary>
    /// Cursor-based historical sync. Fetches all activities from Strava, oldest to newest (paged newest-first
    /// using a 'before' cursor). Saves progress after each page so it can resume after a restart or rate limit hit.
    /// </summary>
    public async Task SyncHistoricalActivitiesAsync(string userId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var stravaService = scope.ServiceProvider.GetRequiredService<IStravaService>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var prService = scope.ServiceProvider.GetRequiredService<PersonalRecordService>();
            var vo2maxSnapshotService = scope.ServiceProvider.GetRequiredService<Vo2maxSnapshotService>();
            var streetMatchingService = scope.ServiceProvider.GetRequiredService<IStreetMatchingService>();
            var tileService = scope.ServiceProvider.GetRequiredService<ITileService>();
            var badgeService = scope.ServiceProvider.GetRequiredService<IBadgeService>();

            var user = await userManager.FindByIdAsync(userId);
            if (user?.StravaAccessToken is null)
            {
                _logger.LogWarning("Historical sync aborted: no Strava token for user {UserId}", userId);
                return;
            }

            if (user.StravaHistoricalSyncComplete)
            {
                _logger.LogInformation("Historical sync already complete for user {UserId}", userId);
                return;
            }

            _logger.LogInformation("Starting historical sync for user {UserId} (cursor: {Cursor})", userId, user.StravaHistoricalSyncCursor);

            int totalSynced = 0;
            int totalSkipped = 0;
            const int perPage = 100;

            while (!user.StravaHistoricalSyncComplete)
            {
                ct.ThrowIfCancellationRequested();

                // Build the 'before' timestamp from our cursor (null = no filter, gets most recent)
                long? before = user.StravaHistoricalSyncCursor.HasValue
                    ? new DateTimeOffset(user.StravaHistoricalSyncCursor.Value, TimeSpan.Zero).ToUnixTimeSeconds()
                    : null;

                List<StravaActivitySummary> batch;
                try
                {
                    var accessToken = await EnsureValidToken(user, stravaService, userManager, ct);
                    var activities = await stravaService.GetAthleteActivitiesAsync(accessToken, before: before, perPage: perPage, ct: ct);
                    batch = activities.ToList();
                }
                catch (StravaRateLimitException ex)
                {
                    _logger.LogWarning("Rate limited fetching page for user {UserId} ({Limit}). Will resume from cursor {Cursor}",
                        userId, ex.IsDailyLimit ? "daily" : "15-min", user.StravaHistoricalSyncCursor);
                    return;
                }

                _logger.LogInformation("Historical sync page: {Count} activities (before {Before}) for user {UserId}", batch.Count, before, userId);

                if (batch.Count == 0)
                {
                    user.StravaHistoricalSyncComplete = true;
                    await userManager.UpdateAsync(user);
                    _logger.LogInformation("Historical sync complete for user {UserId}: {Total} synced, {Skipped} already existed", userId, totalSynced, totalSkipped);
                    await badgeService.CheckAndAwardBadgesAsync(userId, ct);
                    return;
                }

                // ── Advance the cursor BEFORE syncing individual activities ──────────────
                // Saving the cursor here means a mid-batch rate-limit or restart won't
                // re-fetch this same Strava page. Activities in this batch that didn't
                // get processed are caught by the already-in-DB check below on next run.
                var oldestInBatch = batch.Min(a => a.StartDate);
                user.StravaHistoricalSyncCursor = oldestInBatch.AddSeconds(-1);

                // Track the newest activity we've seen (first batch = most recent)
                var newestInBatch = batch.Max(a => a.StartDate);
                if (newestInBatch > (user.StravaNewestSyncedAt ?? DateTime.MinValue))
                    user.StravaNewestSyncedAt = newestInBatch;

                await userManager.UpdateAsync(user); // persist cursor now

                // ── Skip activities already in DB to preserve rate-limit budget ─────────
                var batchExternalIds = batch.Select(a => (long?)a.Id).ToList();
                var alreadySyncedIds = (await db.Activities
                    .Where(a => a.UserId == userId && a.ExternalId != null && batchExternalIds.Contains(a.ExternalId))
                    .Select(a => a.ExternalId!.Value)
                    .ToListAsync(ct))
                    .ToHashSet();

                // Process oldest-first within each page so "first discovery" timestamps
                // (streets, tiles, UserStreetNodes) are assigned to the chronologically
                // earliest run that visited a location, not the most-recently fetched one.
                var orderedBatch = batch.OrderBy(a => a.StartDate).ToList();

                foreach (var summary in orderedBatch)
                {
                    if (alreadySyncedIds.Contains(summary.Id))
                    {
                        totalSkipped++;
                        continue; // already in DB — no API call needed
                    }

                    try
                    {
                        var accessToken = await EnsureValidToken(user, stravaService, userManager, ct);
                        await SyncActivityAsync(db, stravaService, prService, vo2maxSnapshotService, streetMatchingService, tileService, badgeService, user, accessToken, summary.Id, ct, checkBadges: false);
                        totalSynced++;
                    }
                    catch (StravaRateLimitException ex)
                    {
                        _logger.LogWarning("Rate limited syncing activity {ActivityId} for user {UserId} ({Limit}). Cursor already saved at {Cursor}.",
                            summary.Id, userId, ex.IsDailyLimit ? "daily" : "15-min", user.StravaHistoricalSyncCursor);
                        return; // cursor was persisted above — safe to stop
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to sync activity {ActivityId} for user {UserId}", summary.Id, userId);
                    }
                }

                // If we got fewer than a full page we've reached the oldest activity
                if (batch.Count < perPage)
                {
                    user.StravaHistoricalSyncComplete = true;
                    await userManager.UpdateAsync(user);
                    _logger.LogInformation("Historical sync complete for user {UserId}: {Total} synced, {Skipped} already existed", userId, totalSynced, totalSkipped);
                    await badgeService.CheckAndAwardBadgesAsync(userId, ct);
                    return;
                }

                // Respect Strava rate limits between pages
                await Task.Delay(1000, ct);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Historical sync cancelled for user {UserId}", userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Historical sync failed for user {UserId}", userId);
        }
    }

    /// <summary>
    /// Incremental sync: fetches activities newer than the last known synced activity.
    /// Safe to call at any time — does not interfere with historical sync.
    /// </summary>
    public async Task SyncIncrementalActivitiesAsync(string userId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
            var stravaService = scope.ServiceProvider.GetRequiredService<IStravaService>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var prService = scope.ServiceProvider.GetRequiredService<PersonalRecordService>();
            var vo2maxSnapshotService = scope.ServiceProvider.GetRequiredService<Vo2maxSnapshotService>();
            var streetMatchingService = scope.ServiceProvider.GetRequiredService<IStreetMatchingService>();
            var tileService = scope.ServiceProvider.GetRequiredService<ITileService>();
            var badgeService = scope.ServiceProvider.GetRequiredService<IBadgeService>();

            var user = await userManager.FindByIdAsync(userId);
            if (user?.StravaAccessToken is null)
            {
                _logger.LogWarning("Incremental sync aborted: no Strava token for user {UserId}", userId);
                return;
            }

            long? after = user.StravaNewestSyncedAt.HasValue
                ? new DateTimeOffset(user.StravaNewestSyncedAt.Value, TimeSpan.Zero).ToUnixTimeSeconds()
                : null;

            _logger.LogInformation("Starting incremental sync for user {UserId} (after: {After})", userId, user.StravaNewestSyncedAt);

            int page = 1;
            const int perPage = 100;
            int totalSynced = 0;

            while (true)
            {
                ct.ThrowIfCancellationRequested();

                List<StravaActivitySummary> batch;
                try
                {
                    var accessToken = await EnsureValidToken(user, stravaService, userManager, ct);
                    var activities = await stravaService.GetAthleteActivitiesAsync(accessToken, after: after, page: page, perPage: perPage, ct: ct);
                    batch = activities.ToList();
                }
                catch (StravaRateLimitException ex)
                {
                    _logger.LogWarning("Rate limited during incremental sync for user {UserId} ({Limit})", userId, ex.IsDailyLimit ? "daily" : "15-min");
                    break;
                }

                _logger.LogInformation("Incremental sync page {Page}: {Count} activities for user {UserId}", page, batch.Count, userId);

                if (batch.Count == 0) break;

                // Process oldest-first so street/tile "first discovery" is assigned
                // to the chronologically earliest run, matching historical sync behaviour.
                var orderedBatch = batch.OrderBy(a => a.StartDate).ToList();

                foreach (var summary in orderedBatch)
                {
                    try
                    {
                        var accessToken = await EnsureValidToken(user, stravaService, userManager, ct);
                        await SyncActivityAsync(db, stravaService, prService, vo2maxSnapshotService, streetMatchingService, tileService, badgeService, user, accessToken, summary.Id, ct);
                        totalSynced++;
                    }
                    catch (StravaRateLimitException ex)
                    {
                        _logger.LogWarning("Rate limited syncing activity {ActivityId} for user {UserId} ({Limit})", summary.Id, userId, ex.IsDailyLimit ? "daily" : "15-min");
                        await userManager.UpdateAsync(user);
                        return;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to sync activity {ActivityId} for user {UserId}", summary.Id, userId);
                    }

                    if (summary.StartDate > (user.StravaNewestSyncedAt ?? DateTime.MinValue))
                        user.StravaNewestSyncedAt = summary.StartDate;

                }

                await userManager.UpdateAsync(user);

                if (batch.Count < perPage) break;

                page++;
                await Task.Delay(1000, ct);
            }

            _logger.LogInformation("Incremental sync complete for user {UserId}: {Total} new activities synced", userId, totalSynced);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Incremental sync cancelled for user {UserId}", userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Incremental sync failed for user {UserId}", userId);
        }
    }

    private async Task SyncActivityAsync(
        IApplicationDbContext db, IStravaService stravaService, PersonalRecordService prService,
        Vo2maxSnapshotService vo2maxSnapshotService,
        IStreetMatchingService streetMatchingService, ITileService tileService, IBadgeService badgeService,
        User user, string accessToken, long stravaActivityId, CancellationToken ct,
        bool checkBadges = true)
    {
        var detail = await stravaService.GetActivityAsync(accessToken, stravaActivityId, ct);

        var existing = await db.Activities
            .FirstOrDefaultAsync(a => a.ExternalId == stravaActivityId && a.UserId == user.Id, ct);

        var activity = existing ?? new Activity { UserId = user.Id };
        activity.ExternalId = detail.Id;
        activity.Source = ActivitySource.Strava;
        activity.Name = detail.Name;
        activity.SportType = ParseSportType(detail.SportType);
        activity.StartDate = detail.StartDate;
        activity.Distance = detail.Distance;
        activity.MovingTime = detail.MovingTime;
        activity.ElapsedTime = detail.ElapsedTime;
        activity.TotalElevationGain = detail.TotalElevationGain;
        activity.AverageSpeed = detail.AverageSpeed;
        activity.MaxSpeed = detail.MaxSpeed;
        activity.AverageHeartRate = detail.AverageHeartrate;
        activity.MaxHeartRate = detail.MaxHeartrate;
        activity.AverageCadence = detail.AverageCadence;
        activity.Calories = detail.Calories;
        activity.SummaryPolyline = detail.MapSummaryPolyline;
        activity.DetailedPolyline = detail.MapPolyline;
        if (detail.AverageTemp.HasValue)
            activity.WeatherTempC = detail.AverageTemp;

        if (existing is null)
            db.Activities.Add(activity);

        await db.SaveChangesAsync(ct);

        // Sync streams
        try
        {
            var streams = await stravaService.GetActivityStreamsAsync(accessToken, stravaActivityId, ct);
            if (streams.LatLng?.Length > 0)
            {
                var existingStreams = await db.ActivityStreams
                    .Where(s => s.ActivityId == activity.Id)
                    .ToListAsync(ct);
                db.ActivityStreams.RemoveRange(existingStreams);

                var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

                for (int i = 0; i < streams.LatLng.Length; i++)
                {
                    var stream = new ActivityStream
                    {
                        ActivityId = activity.Id,
                        PointIndex = i,
                        Latitude = streams.LatLng[i][0],
                        Longitude = streams.LatLng[i][1],
                        Altitude = streams.Altitude?.Length > i ? streams.Altitude[i] : null,
                        Time = streams.Time?.Length > i ? streams.Time[i] : null,
                        Distance = streams.Distance?.Length > i ? streams.Distance[i] : null,
                        HeartRate = streams.Heartrate?.Length > i ? streams.Heartrate[i] : null,
                        Cadence = streams.Cadence?.Length > i ? streams.Cadence[i] : null,
                        Location = geometryFactory.CreatePoint(new Coordinate(streams.LatLng[i][1], streams.LatLng[i][0]))
                    };
                    db.ActivityStreams.Add(stream);
                }
                await db.SaveChangesAsync(ct);
            }
        }
        catch (StravaRateLimitException)
        {
            throw; // Propagate so the caller can stop and save state
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sync streams for activity {ActivityId}", stravaActivityId);
        }

        await prService.EvaluateAsync(user.Id, activity, ct);
        try { await vo2maxSnapshotService.RecordAsync(user.Id, activity, ct); } catch { /* non-critical */ }

        try
        {
            await streetMatchingService.MatchActivityAsync(user.Id, activity.Id, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Street matching failed for activity {ActivityId}", activity.Id);
        }

        try
        {
            await tileService.ProcessActivityTilesAsync(user.Id, activity.Id, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Tile processing failed for activity {ActivityId}", activity.Id);
        }

        if (checkBadges)
        {
            try
            {
                await badgeService.CheckAndAwardBadgesAsync(user.Id, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Badge check failed for user {UserId}", user.Id);
            }
        }

        _logger.LogInformation("Synced activity {Name} ({ExternalId}) for user {UserId}", activity.Name, stravaActivityId, user.Id);
    }

    private async Task<string> EnsureValidToken(User user, IStravaService stravaService, UserManager<User> userManager, CancellationToken ct)
    {
        if (user.StravaTokenExpiry.HasValue && user.StravaTokenExpiry.Value > DateTime.UtcNow.AddMinutes(5))
            return user.StravaAccessToken!;

        var tokens = await stravaService.RefreshTokenAsync(user.StravaRefreshToken!, ct);
        user.StravaAccessToken = tokens.AccessToken;
        user.StravaRefreshToken = tokens.RefreshToken;
        user.StravaTokenExpiry = DateTimeOffset.FromUnixTimeSeconds(tokens.ExpiresAt).UtcDateTime;
        await userManager.UpdateAsync(user);

        return tokens.AccessToken;
    }

    private static SportType ParseSportType(string sportType) => sportType?.ToLowerInvariant() switch
    {
        "run" => SportType.Run,
        "trailrun" or "trail_run" => SportType.TrailRun,
        "walk" => SportType.Walk,
        "hike" => SportType.Hike,
        "virtualrun" or "virtual_run" => SportType.VirtualRun,
        "ride" => SportType.Ride,
        "swim" => SportType.Swim,
        "virtualride" or "virtual_ride" => SportType.VirtualRide,
        "weighttraining" or "weight_training" => SportType.WeightTraining,
        "workout" => SportType.Workout,
        "yoga" => SportType.Yoga,
        "elliptical" => SportType.Elliptical,
        _ => SportType.Other
    };
}
