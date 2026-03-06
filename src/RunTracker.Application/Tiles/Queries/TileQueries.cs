using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Application.Tiles.Queries;

public record TileStatsDto(int VisitedCount);

public record GetTileStatsQuery(string UserId) : IRequest<TileStatsDto>;

public class GetTileStatsQueryHandler : IRequestHandler<GetTileStatsQuery, TileStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetTileStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<TileStatsDto> Handle(GetTileStatsQuery request, CancellationToken ct)
    {
        var count = await _db.UserTiles.CountAsync(t => t.UserId == request.UserId, ct);
        return new TileStatsDto(count);
    }
}

// --- Advanced Exploration (T19) ---

public record TileOriginDto(int TileX, int TileY);

public record AdvancedExplorationDto(
    int MaxSquareSize,
    TileOriginDto? MaxSquareOrigin,
    double ExplorerScore,
    int ExplorerPercentile,
    TileOriginDto? ChallengeTile
);

public record GetAdvancedExplorationQuery(string UserId) : IRequest<AdvancedExplorationDto>;

public class GetAdvancedExplorationQueryHandler : IRequestHandler<GetAdvancedExplorationQuery, AdvancedExplorationDto>
{
    private readonly IApplicationDbContext _db;
    public GetAdvancedExplorationQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<AdvancedExplorationDto> Handle(GetAdvancedExplorationQuery request, CancellationToken ct)
    {
        var tiles = await _db.UserTiles
            .Where(t => t.UserId == request.UserId)
            .Select(t => new { t.TileX, t.TileY })
            .ToListAsync(ct);

        if (tiles.Count == 0)
            return new AdvancedExplorationDto(0, null, 0, 0, null);

        var tileSet = new HashSet<(int, int)>(tiles.Select(t => (t.TileX, t.TileY)));

        // --- Maximal Square via dynamic programming ---
        int maxSqSize = 0;
        TileOriginDto? maxSqOrigin = null;

        int minX = tiles.Min(t => t.TileX), maxX = tiles.Max(t => t.TileX);
        int minY = tiles.Min(t => t.TileY), maxY = tiles.Max(t => t.TileY);
        int width = maxX - minX + 1, height = maxY - minY + 1;

        if (width <= 3000 && height <= 3000)
        {
            var dp = new int[height + 1, width + 1];
            for (int row = 1; row <= height; row++)
            {
                for (int col = 1; col <= width; col++)
                {
                    int tx = minX + col - 1, ty = minY + row - 1;
                    if (!tileSet.Contains((tx, ty))) continue;
                    dp[row, col] = Math.Min(Math.Min(dp[row - 1, col], dp[row, col - 1]), dp[row - 1, col - 1]) + 1;
                    if (dp[row, col] > maxSqSize)
                    {
                        maxSqSize = dp[row, col];
                        maxSqOrigin = new TileOriginDto(tx - maxSqSize + 1, ty - maxSqSize + 1);
                    }
                }
            }
        }

        // --- Explorer score ---
        int completedStreets = await _db.UserCityProgress
            .Where(p => p.UserId == request.UserId)
            .SumAsync(p => p.CompletedStreets, ct);
        int citiesCount = await _db.UserCityProgress
            .CountAsync(p => p.UserId == request.UserId && p.CompletionPercentage > 0, ct);

        double score = tiles.Count * 10.0 + completedStreets * 50.0 + citiesCount * 100.0;

        var allCounts = await _db.UserTiles
            .GroupBy(t => t.UserId)
            .Select(g => g.Count())
            .ToListAsync(ct);

        int usersBelow = allCounts.Count(c => c < tiles.Count);
        int percentile = allCounts.Count > 1 ? (int)((double)usersBelow / (allCounts.Count - 1) * 100) : 100;

        // --- Weekly challenge tile (changes each calendar week) ---
        TileOriginDto? challengeTile = null;
        var candidates = new List<(int x, int y)>();
        foreach (var t in tiles.Take(800))
        {
            int[] dx = { 0, 0, 1, -1 };
            int[] dy = { 1, -1, 0, 0 };
            for (int d = 0; d < 4; d++)
            {
                int nx = t.TileX + dx[d], ny = t.TileY + dy[d];
                if (!tileSet.Contains((nx, ny)))
                    candidates.Add((nx, ny));
            }
        }
        if (candidates.Count > 0)
        {
            int weekSeed = DateTime.UtcNow.Year * 53 + (DateTime.UtcNow.DayOfYear - 1) / 7;
            var pick = candidates[weekSeed % candidates.Count];
            challengeTile = new TileOriginDto(pick.x, pick.y);
        }

        return new AdvancedExplorationDto(maxSqSize, maxSqOrigin, Math.Round(score, 0), percentile, challengeTile);
    }
}

// Returns GeoJSON as a plain object (serialised by the endpoint)
public record TileFeatureDto(int TileX, int TileY, double LonWest, double LatNorth, double LonEast, double LatSouth);

public record GetTileGeoJsonQuery(string UserId) : IRequest<List<TileFeatureDto>>;

public class GetTileGeoJsonQueryHandler : IRequestHandler<GetTileGeoJsonQuery, List<TileFeatureDto>>
{
    private const int Zoom = 15;
    private const int N = 1 << Zoom; // 32768

    private readonly IApplicationDbContext _db;
    public GetTileGeoJsonQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<TileFeatureDto>> Handle(GetTileGeoJsonQuery request, CancellationToken ct)
    {
        var tiles = await _db.UserTiles
            .Where(t => t.UserId == request.UserId)
            .Select(t => new { t.TileX, t.TileY })
            .ToListAsync(ct);

        return tiles.Select(t =>
        {
            double lonWest  = (double)t.TileX / N * 360.0 - 180.0;
            double lonEast  = (double)(t.TileX + 1) / N * 360.0 - 180.0;
            double latNorth = Math.Atan(Math.Sinh(Math.PI * (1.0 - 2.0 * t.TileY / N))) * 180.0 / Math.PI;
            double latSouth = Math.Atan(Math.Sinh(Math.PI * (1.0 - 2.0 * (t.TileY + 1) / N))) * 180.0 / Math.PI;
            return new TileFeatureDto(t.TileX, t.TileY, lonWest, latNorth, lonEast, latSouth);
        }).ToList();
    }
}
