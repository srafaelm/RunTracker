using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Social;

// --- DTOs ---

public record UserSummaryDto(string Id, string? DisplayName, string? Email, string? ProfilePictureUrl, bool IsFollowing);
public record LeaderboardEntryDto(string UserId, string? DisplayName, string? ProfilePictureUrl, double TotalDistanceM, int RunCount);
public record FeedActivityDto(string ActivityId, string UserId, string? DisplayName, string? ProfilePictureUrl,
    string ActivityName, SportType SportType, DateTime StartDate, double Distance, int MovingTime, double AveragePaceMinPerKm);

// --- Follow ---

public record FollowUserCommand(string FollowerId, string FolloweeId) : IRequest<bool>;

public class FollowUserCommandHandler : IRequestHandler<FollowUserCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public FollowUserCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(FollowUserCommand request, CancellationToken ct)
    {
        if (request.FollowerId == request.FolloweeId) return false;
        var exists = await _db.UserFollows.AnyAsync(
            f => f.FollowerId == request.FollowerId && f.FolloweeId == request.FolloweeId, ct);
        if (exists) return true;

        _db.UserFollows.Add(new UserFollow
        {
            FollowerId = request.FollowerId,
            FolloweeId = request.FolloweeId,
            FollowedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// --- Unfollow ---

public record UnfollowUserCommand(string FollowerId, string FolloweeId) : IRequest;

public class UnfollowUserCommandHandler : IRequestHandler<UnfollowUserCommand>
{
    private readonly IApplicationDbContext _db;
    public UnfollowUserCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task Handle(UnfollowUserCommand request, CancellationToken ct)
    {
        var follow = await _db.UserFollows.FirstOrDefaultAsync(
            f => f.FollowerId == request.FollowerId && f.FolloweeId == request.FolloweeId, ct);
        if (follow is null) return;
        _db.UserFollows.Remove(follow);
        await _db.SaveChangesAsync(ct);
    }
}

// --- Get Following ---

public record GetFollowingQuery(string UserId) : IRequest<List<UserSummaryDto>>;

public class GetFollowingQueryHandler : IRequestHandler<GetFollowingQuery, List<UserSummaryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetFollowingQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<UserSummaryDto>> Handle(GetFollowingQuery request, CancellationToken ct)
    {
        return await _db.UserFollows
            .Where(f => f.FollowerId == request.UserId)
            .Select(f => new UserSummaryDto(
                f.Followee!.Id,
                f.Followee.DisplayName,
                f.Followee.Email,
                f.Followee.ProfilePictureUrl,
                true))
            .ToListAsync(ct);
    }
}

// --- Get Followers ---

public record GetFollowersQuery(string UserId) : IRequest<List<UserSummaryDto>>;

public class GetFollowersQueryHandler : IRequestHandler<GetFollowersQuery, List<UserSummaryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetFollowersQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<UserSummaryDto>> Handle(GetFollowersQuery request, CancellationToken ct)
    {
        var followingIds = await _db.UserFollows
            .Where(f => f.FollowerId == request.UserId)
            .Select(f => f.FolloweeId)
            .ToHashSetAsync(ct);

        return await _db.UserFollows
            .Where(f => f.FolloweeId == request.UserId)
            .Select(f => new UserSummaryDto(
                f.Follower!.Id,
                f.Follower.DisplayName,
                f.Follower.Email,
                f.Follower.ProfilePictureUrl,
                followingIds.Contains(f.Follower.Id)))
            .ToListAsync(ct);
    }
}

// --- Leaderboard ---

public record GetLeaderboardQuery(string RequestingUserId, string Period = "weekly") : IRequest<List<LeaderboardEntryDto>>;

public class GetLeaderboardQueryHandler : IRequestHandler<GetLeaderboardQuery, List<LeaderboardEntryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetLeaderboardQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<LeaderboardEntryDto>> Handle(GetLeaderboardQuery request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        DateTime from = request.Period switch
        {
            "monthly" => new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            "yearly"  => new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            _         => now.AddDays(-(int)now.DayOfWeek).Date.ToUniversalTime(), // weekly: Monday
        };

        var runSports = new[] { SportType.Run, SportType.TrailRun, SportType.VirtualRun };

        return await _db.Activities
            .Where(a => a.StartDate >= from && runSports.Contains(a.SportType))
            .GroupBy(a => new { a.UserId, a.User!.DisplayName, a.User.ProfilePictureUrl })
            .OrderByDescending(g => g.Sum(a => a.Distance))
            .Take(50)
            .Select(g => new LeaderboardEntryDto(
                g.Key.UserId,
                g.Key.DisplayName,
                g.Key.ProfilePictureUrl,
                g.Sum(a => a.Distance),
                g.Count()))
            .ToListAsync(ct);
    }
}

// --- Friend Feed ---

public record GetFriendFeedQuery(string UserId, int Page = 1, int PageSize = 20) : IRequest<List<FeedActivityDto>>;

public class GetFriendFeedQueryHandler : IRequestHandler<GetFriendFeedQuery, List<FeedActivityDto>>
{
    private readonly IApplicationDbContext _db;
    public GetFriendFeedQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<FeedActivityDto>> Handle(GetFriendFeedQuery request, CancellationToken ct)
    {
        var followeeIds = await _db.UserFollows
            .Where(f => f.FollowerId == request.UserId)
            .Select(f => f.FolloweeId)
            .ToListAsync(ct);

        return await _db.Activities
            .Where(a => followeeIds.Contains(a.UserId))
            .OrderByDescending(a => a.StartDate)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(a => new FeedActivityDto(
                a.Id.ToString(),
                a.UserId,
                a.User!.DisplayName,
                a.User.ProfilePictureUrl,
                a.Name,
                a.SportType,
                a.StartDate,
                a.Distance,
                a.MovingTime,
                a.Distance > 0 && a.MovingTime > 0 ? (a.MovingTime / 60.0) / (a.Distance / 1000.0) : 0))
            .ToListAsync(ct);
    }
}

// --- Find Users (search) ---

public record FindUsersQuery(string RequestingUserId, string Search) : IRequest<List<UserSummaryDto>>;

public class FindUsersQueryHandler : IRequestHandler<FindUsersQuery, List<UserSummaryDto>>
{
    private readonly IApplicationDbContext _db;
    public FindUsersQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<UserSummaryDto>> Handle(FindUsersQuery request, CancellationToken ct)
    {
        var followingIds = await _db.UserFollows
            .Where(f => f.FollowerId == request.RequestingUserId)
            .Select(f => f.FolloweeId)
            .ToHashSetAsync(ct);

        var lower = request.Search.ToLower();

        return await _db.Activities
            .Select(a => a.User!)
            .Distinct()
            .Where(u => u.Id != request.RequestingUserId &&
                (u.DisplayName != null && u.DisplayName.ToLower().Contains(lower) ||
                 u.Email != null && u.Email.ToLower().Contains(lower)))
            .Take(20)
            .Select(u => new UserSummaryDto(
                u.Id, u.DisplayName, u.Email, u.ProfilePictureUrl,
                followingIds.Contains(u.Id)))
            .ToListAsync(ct);
    }
}
