using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Goals;

// --- Get Goals with current progress ---
public record GetGoalsQuery(string UserId) : IRequest<List<GoalDto>>;

public class GetGoalsQueryHandler : IRequestHandler<GetGoalsQuery, List<GoalDto>>
{
    private readonly IApplicationDbContext _db;

    public GetGoalsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<GoalDto>> Handle(GetGoalsQuery request, CancellationToken ct)
    {
        var goals = await _db.UserGoals
            .Where(g => g.UserId == request.UserId && g.IsActive)
            .OrderBy(g => g.Period)
            .ThenBy(g => g.SportType)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var result = new List<GoalDto>();

        foreach (var goal in goals)
        {
            var (from, to) = GetPeriodRange(goal.Period, now);

            var query = _db.Activities.Where(a =>
                a.UserId == request.UserId &&
                a.StartDate >= from && a.StartDate < to);

            if (goal.SportType.HasValue)
                query = query.Where(a => a.SportType == goal.SportType.Value);

            var currentDistanceM = await query.SumAsync(a => a.Distance, ct);
            var currentKm = currentDistanceM / 1000.0;
            var pct = goal.TargetDistanceKm > 0
                ? Math.Min(100.0, currentKm / goal.TargetDistanceKm * 100.0)
                : 0;

            result.Add(new GoalDto(
                goal.Id, goal.SportType, goal.Period,
                goal.TargetDistanceKm, goal.IsActive,
                Math.Round(currentKm, 2), Math.Round(pct, 1)
            ));
        }

        return result;
    }

    public static (DateTime from, DateTime to) GetMonthRange(int year, int month) => (
        new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc),
        new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1)
    );

    public static (DateTime from, DateTime to) GetPeriodRange(GoalPeriod period, DateTime now)
    {
        return period switch
        {
            GoalPeriod.Week => (
                now.Date.AddDays(-(int)now.DayOfWeek == 0 ? 6 : (int)now.DayOfWeek - 1),
                now.Date.AddDays(-(int)now.DayOfWeek == 0 ? 6 : (int)now.DayOfWeek - 1).AddDays(7)
            ),
            GoalPeriod.Month => (
                new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1)
            ),
            GoalPeriod.Year => (
                new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(now.Year + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            ),
            _ => throw new ArgumentOutOfRangeException()
        };
    }
}

// --- Get Goal History (last 12 months, monthly goals only) ---
public record GetGoalHistoryQuery(string UserId) : IRequest<GoalHistoryDto>;

public class GetGoalHistoryQueryHandler : IRequestHandler<GetGoalHistoryQuery, GoalHistoryDto>
{
    private readonly IApplicationDbContext _db;
    public GetGoalHistoryQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<GoalHistoryDto> Handle(GetGoalHistoryQuery request, CancellationToken ct)
    {
        // Only monthly goals make sense for a monthly breakdown
        var monthlyGoals = await _db.UserGoals
            .Where(g => g.UserId == request.UserId && g.IsActive && g.Period == GoalPeriod.Month)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var months = new List<GoalHistoryMonthDto>();

        // Last 12 complete months (not including current month)
        for (int i = 11; i >= 0; i--)
        {
            var d = now.AddMonths(-i - 1);
            var year = d.Year;
            var month = d.Month;
            var (from, to) = GetGoalsQueryHandler.GetMonthRange(year, month);
            var label = $"{year:D4}-{month:D2}";

            int goalsTotal = monthlyGoals.Count;
            int goalsMet = 0;

            foreach (var goal in monthlyGoals)
            {
                var query = _db.Activities.Where(a =>
                    a.UserId == request.UserId &&
                    a.StartDate >= from && a.StartDate < to);
                if (goal.SportType.HasValue)
                    query = query.Where(a => a.SportType == goal.SportType.Value);
                var distanceM = await query.SumAsync(a => a.Distance, ct);
                if (distanceM / 1000.0 >= goal.TargetDistanceKm)
                    goalsMet++;
            }

            var pct = goalsTotal > 0 ? Math.Round((double)goalsMet / goalsTotal * 100, 1) : 0;
            months.Add(new GoalHistoryMonthDto(label, goalsTotal, goalsMet, pct));
        }

        // Compute consecutive streak (months from most recent going back where all goals were met)
        int streak = 0;
        for (int i = months.Count - 1; i >= 0; i--)
        {
            if (months[i].GoalsTotal > 0 && months[i].GoalsMet == months[i].GoalsTotal)
                streak++;
            else
                break;
        }

        return new GoalHistoryDto(months, streak);
    }
}
