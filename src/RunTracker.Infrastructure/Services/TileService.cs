using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Services;

public class TileService : ITileService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<TileService> _logger;
    private const int Zoom = 15;
    private const int TileCount = 1 << Zoom; // 32768

    public TileService(IApplicationDbContext db, ILogger<TileService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public (int x, int y) ComputeTile(double lat, double lon)
    {
        var latRad = lat * Math.PI / 180.0;
        var x = (int)Math.Floor((lon + 180.0) / 360.0 * TileCount);
        var y = (int)Math.Floor((1.0 - Math.Log(Math.Tan(latRad) + 1.0 / Math.Cos(latRad)) / Math.PI) / 2.0 * TileCount);
        return (x, y);
    }

    public async Task ProcessActivityTilesAsync(string userId, Guid activityId, CancellationToken ct = default)
    {
        var gpsPoints = await _db.ActivityStreams
            .Where(s => s.ActivityId == activityId)
            .Select(s => new { s.Latitude, s.Longitude })
            .ToListAsync(ct);

        if (gpsPoints.Count == 0) return;

        var alreadyVisited = (await _db.UserTiles
            .Where(t => t.UserId == userId)
            .Select(t => new { t.TileX, t.TileY })
            .ToListAsync(ct))
            .Select(t => (t.TileX, t.TileY))
            .ToHashSet();

        var newTiles = new Dictionary<(int x, int y), UserTile>();

        foreach (var pt in gpsPoints)
        {
            var (x, y) = ComputeTile(pt.Latitude, pt.Longitude);
            var key = (x, y);

            if (alreadyVisited.Contains(key)) continue;
            if (newTiles.ContainsKey(key)) continue;

            newTiles[key] = new UserTile
            {
                UserId = userId,
                TileX = x,
                TileY = y,
                ActivityId = activityId,
                FirstVisitedAt = DateTime.UtcNow,
            };
        }

        if (newTiles.Count > 0)
        {
            _db.UserTiles.AddRange(newTiles.Values);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Recorded {Count} new tiles for activity {ActivityId}", newTiles.Count, activityId);
        }
    }

    public async Task ProcessAllActivitiesAsync(string userId, CancellationToken ct = default)
    {
        // Clear existing tiles for full reprocess
        var existing = _db.UserTiles.Where(t => t.UserId == userId);
        _db.UserTiles.RemoveRange(existing);
        await _db.SaveChangesAsync(ct);

        var activityIds = await _db.Activities
            .Where(a => a.UserId == userId)
            .OrderBy(a => a.StartDate)
            .Select(a => a.Id)
            .ToListAsync(ct);

        foreach (var activityId in activityIds)
        {
            await ProcessActivityTilesAsync(userId, activityId, ct);
        }

        _logger.LogInformation("Tile reprocess complete for user {UserId}: processed {Count} activities", userId, activityIds.Count);
    }
}
