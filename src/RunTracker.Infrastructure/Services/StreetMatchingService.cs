using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Services;

public class StreetMatchingService : IStreetMatchingService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<StreetMatchingService> _logger;

    /// <summary>Distance threshold in meters for matching GPS points to street nodes.</summary>
    private const double MatchDistanceMeters = 25;

    /// <summary>Fraction of nodes that must be hit for a street to count as completed.</summary>
    private const double StreetCompletionThreshold = 0.9;

    public StreetMatchingService(IApplicationDbContext db, ILogger<StreetMatchingService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task MatchActivityAsync(string userId, Guid activityId, CancellationToken ct = default)
    {
        // Check if there are any imported cities (no point matching if no streets)
        var hasCities = await _db.Cities.AnyAsync(ct);
        if (!hasCities) return;

        // Load activity stream GPS points
        var gpsPoints = await _db.ActivityStreams
            .Where(s => s.ActivityId == activityId && s.Location != null)
            .Select(s => s.Location!)
            .ToListAsync(ct);

        if (gpsPoints.Count == 0)
        {
            _logger.LogDebug("No GPS points for activity {ActivityId}, skipping street matching", activityId);
            return;
        }

        _logger.LogInformation("Matching {PointCount} GPS points for activity {ActivityId}", gpsPoints.Count, activityId);

        // Get already-completed nodes for this user to skip them
        var completedNodeIds = await _db.UserStreetNodes
            .Where(usn => usn.UserId == userId)
            .Select(usn => usn.StreetNodeId)
            .ToHashSetAsync(ct);

        int newMatches = 0;

        // Process GPS points in batches to reduce DB round trips
        const int batchSize = 50;
        for (int i = 0; i < gpsPoints.Count; i += batchSize)
        {
            var batchPoints = gpsPoints.Skip(i).Take(batchSize).ToList();

            foreach (var point in batchPoints)
            {
                // Spatial query: find street nodes within 25m of this GPS point
                var nearbyNodes = await _db.StreetNodes
                    .Where(sn => sn.Location.Distance(point) <= MatchDistanceMeters)
                    .Select(sn => sn.Id)
                    .ToListAsync(ct);

                foreach (var nodeId in nearbyNodes)
                {
                    if (!completedNodeIds.Add(nodeId)) continue; // Already completed

                    _db.UserStreetNodes.Add(new UserStreetNode
                    {
                        UserId = userId,
                        StreetNodeId = nodeId,
                        ActivityId = activityId,
                        FirstCompletedAt = DateTime.UtcNow,
                    });
                    newMatches++;
                }
            }

            // Save each batch
            if (newMatches > 0)
                await _db.SaveChangesAsync(ct);
        }

        _logger.LogInformation("Street matching complete for activity {ActivityId}: {NewMatches} new node matches", activityId, newMatches);

        // Recalculate city progress if we found new matches
        if (newMatches > 0)
            await RecalculateCityProgressAsync(userId, ct);
    }

    public async Task<int> MatchAllActivitiesAsync(string userId, CancellationToken ct = default)
    {
        var activityIds = await _db.Activities
            .Where(a => a.UserId == userId)
            .OrderBy(a => a.StartDate)
            .Select(a => a.Id)
            .ToListAsync(ct);

        _logger.LogInformation("Starting bulk street matching for user {UserId}: {Count} activities", userId, activityIds.Count);

        int totalMatched = 0;
        foreach (var activityId in activityIds)
        {
            try
            {
                var beforeCount = await _db.UserStreetNodes.CountAsync(usn => usn.UserId == userId, ct);
                await MatchActivityAsync(userId, activityId, ct);
                var afterCount = await _db.UserStreetNodes.CountAsync(usn => usn.UserId == userId, ct);
                totalMatched += afterCount - beforeCount;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Street matching failed for activity {ActivityId}, continuing", activityId);
            }
        }

        // Final progress recalculation
        await RecalculateCityProgressAsync(userId, ct);

        _logger.LogInformation("Bulk street matching complete for user {UserId}: {TotalMatched} new node matches across {Count} activities",
            userId, totalMatched, activityIds.Count);

        return totalMatched;
    }

    public async Task RecalculateCityProgressAsync(string userId, CancellationToken ct = default)
    {
        var cities = await _db.Cities.ToListAsync(ct);

        foreach (var city in cities)
        {
            if (city.TotalNodes == 0) continue;

            // Count completed nodes for this city
            var completedNodes = await _db.UserStreetNodes
                .Where(usn => usn.UserId == userId)
                .Where(usn => usn.StreetNode.Street.CityId == city.Id)
                .CountAsync(ct);

            // Count completed streets (>= 90% of nodes hit)
            var completedStreets = await _db.Streets
                .Where(s => s.CityId == city.Id && s.NodeCount > 0)
                .CountAsync(s =>
                    _db.UserStreetNodes
                        .Count(usn => usn.UserId == userId && usn.StreetNode.StreetId == s.Id)
                    >= (int)Math.Ceiling(s.NodeCount * StreetCompletionThreshold),
                    ct);

            var completionPct = city.TotalNodes > 0
                ? (double)completedNodes / city.TotalNodes * 100
                : 0;

            var progress = await _db.UserCityProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.CityId == city.Id, ct);

            if (progress is null)
            {
                progress = new UserCityProgress
                {
                    UserId = userId,
                    CityId = city.Id,
                };
                _db.UserCityProgress.Add(progress);
            }

            progress.CompletedNodes = completedNodes;
            progress.CompletedStreets = completedStreets;
            progress.CompletionPercentage = Math.Round(completionPct, 2);
            progress.LastUpdated = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("City progress recalculated for user {UserId}", userId);
    }
}
