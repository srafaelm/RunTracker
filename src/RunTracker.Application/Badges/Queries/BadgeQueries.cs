using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Badges.Queries;

public record BadgeDto(
    BadgeType BadgeType,
    string Name,
    string Description,
    string Icon,
    DateTime EarnedAt);

public record BadgeWithStatusDto(
    int Id,
    string Name,
    string Description,
    string Icon,
    string Category,
    int SortOrder,
    bool IsEarned,
    DateTime? EarnedAt);

public record GetAllBadgesQuery(string UserId) : IRequest<List<BadgeWithStatusDto>>;

public class GetAllBadgesQueryHandler : IRequestHandler<GetAllBadgesQuery, List<BadgeWithStatusDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAllBadgesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BadgeWithStatusDto>> Handle(GetAllBadgesQuery request, CancellationToken ct)
    {
        var definitions = await _db.BadgeDefinitions
            .OrderBy(b => b.Category)
            .ThenBy(b => b.SortOrder)
            .ToListAsync(ct);

        var earned = await _db.UserBadges
            .Where(b => b.UserId == request.UserId)
            .ToDictionaryAsync(b => b.BadgeType, b => (DateTime?)b.EarnedAt, ct);

        return definitions.Select(d => new BadgeWithStatusDto(
            d.Id,
            d.Name,
            d.Description,
            d.Icon,
            d.Category,
            d.SortOrder,
            earned.ContainsKey(d.BadgeType),
            earned.TryGetValue(d.BadgeType, out var dt) ? dt : null
        )).ToList();
    }
}

public record GetUserBadgesQuery(string UserId) : IRequest<List<BadgeDto>>;

public class GetUserBadgesQueryHandler : IRequestHandler<GetUserBadgesQuery, List<BadgeDto>>
{
    private readonly IApplicationDbContext _db;
    public GetUserBadgesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BadgeDto>> Handle(GetUserBadgesQuery request, CancellationToken ct)
    {
        var earned = await _db.UserBadges
            .Where(b => b.UserId == request.UserId)
            .OrderBy(b => b.EarnedAt)
            .ToListAsync(ct);

        return earned
            .Where(b => BadgeMeta.All.ContainsKey(b.BadgeType))
            .Select(b =>
            {
                var (name, desc, icon) = BadgeMeta.All[b.BadgeType];
                return new BadgeDto(b.BadgeType, name, desc, icon, b.EarnedAt);
            })
            .ToList();
    }
}

internal static class BadgeMeta
{
    public static readonly Dictionary<BadgeType, (string Name, string Description, string Icon)> All = new()
    {
        [BadgeType.First5K]       = ("First 5K",        "Completed your first 5km run",              "🏅"),
        [BadgeType.First10K]      = ("First 10K",       "Completed your first 10km run",             "🥈"),
        [BadgeType.First21K]      = ("First Half",      "Completed your first half marathon",        "🥇"),
        [BadgeType.First42K]      = ("First Marathon",  "Completed your first full marathon",        "🏆"),
        [BadgeType.Total100km]    = ("Century",         "Ran 100km in total",                        "💯"),
        [BadgeType.Total500km]    = ("500km Club",      "Ran 500km in total",                        "⭐"),
        [BadgeType.Total1000km]   = ("1000km Club",     "Ran 1,000km in total",                      "🌟"),
        [BadgeType.Total5000km]   = ("Ultra Runner",    "Ran 5,000km in total",                      "🚀"),
        [BadgeType.FirstRun]      = ("First Steps",     "Logged your first run",                     "👟"),
        [BadgeType.Runs10]        = ("10 Runs",         "Completed 10 runs",                         "🔟"),
        [BadgeType.Runs50]        = ("50 Runs",         "Completed 50 runs",                         "🎯"),
        [BadgeType.Runs100]       = ("Century Runner",  "Completed 100 runs",                        "💪"),
        [BadgeType.Runs365]       = ("Full Year",       "Completed 365 runs",                        "📅"),
        [BadgeType.EverestRun]    = ("Everest",         "Climbed 8,848m elevation in a single run",  "🏔️"),
        [BadgeType.Tiles100]      = ("Explorer",        "Visited 100 map tiles",                     "🗺️"),
        [BadgeType.Tiles500]      = ("Adventurer",      "Visited 500 map tiles",                     "🧭"),
        [BadgeType.Tiles1000]     = ("Cartographer",    "Visited 1,000 map tiles",                   "📍"),
        [BadgeType.Tiles5000]     = ("World Traveller", "Visited 5,000 map tiles",                   "🌍"),
        [BadgeType.StreetExplorer]= ("Street Explorer", "Completed 100% of streets in a city",       "🏙️"),
    };
}
