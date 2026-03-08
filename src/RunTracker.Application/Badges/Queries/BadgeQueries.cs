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
    DateTime? EarnedAt,
    bool IsArchived);

public record BadgeAdminDto(
    int Id,
    string Name,
    string Description,
    string Icon,
    string Category,
    int SortOrder,
    bool IsArchived);

// ── Regular user queries ────────────────────────────────────────────────────

public record GetAllBadgesQuery(string UserId) : IRequest<List<BadgeWithStatusDto>>;

public class GetAllBadgesQueryHandler : IRequestHandler<GetAllBadgesQuery, List<BadgeWithStatusDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAllBadgesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BadgeWithStatusDto>> Handle(GetAllBadgesQuery request, CancellationToken ct)
    {
        var definitions = await _db.BadgeDefinitions
            .Where(b => !b.IsArchived)
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
            earned.TryGetValue(d.BadgeType, out var dt) ? dt : null,
            d.IsArchived
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
        var rows = await _db.UserBadges
            .Where(b => b.UserId == request.UserId)
            .Join(_db.BadgeDefinitions,
                ub => ub.BadgeType,
                bd => bd.BadgeType,
                (ub, bd) => new { ub.BadgeType, bd.Name, bd.Description, bd.Icon, ub.EarnedAt })
            .OrderBy(x => x.EarnedAt)
            .ToListAsync(ct);

        return rows.Select(x => new BadgeDto(x.BadgeType, x.Name, x.Description, x.Icon, x.EarnedAt)).ToList();
    }
}

// ── Admin queries ────────────────────────────────────────────────────────────

public record GetAllBadgesAdminQuery : IRequest<List<BadgeAdminDto>>;

public class GetAllBadgesAdminQueryHandler : IRequestHandler<GetAllBadgesAdminQuery, List<BadgeAdminDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAllBadgesAdminQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BadgeAdminDto>> Handle(GetAllBadgesAdminQuery request, CancellationToken ct)
    {
        return await _db.BadgeDefinitions
            .OrderBy(b => b.Category)
            .ThenBy(b => b.SortOrder)
            .Select(b => new BadgeAdminDto(b.Id, b.Name, b.Description, b.Icon, b.Category, b.SortOrder, b.IsArchived))
            .ToListAsync(ct);
    }
}
