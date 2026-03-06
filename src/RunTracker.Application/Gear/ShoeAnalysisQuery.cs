using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Gear;

public record ShoeMonthDto(string MonthLabel, int ActivityCount, double TotalDistanceKm, double AvgPaceMinPerKm);
public record ShoeRecentActivityDto(string Date, string Name, double DistanceKm);
public record ShoeRotationPeerDto(Guid GearId, string Name, int DaysSinceLastUse, double TotalDistanceKm);

public record ShoeAnalysisDto(
    Guid GearId,
    string GearName,
    int DaysSinceLastUse,
    int TotalActivities,
    double TotalDistanceKm,
    List<ShoeMonthDto> MonthlyTrend,
    List<ShoeRecentActivityDto> RecentActivities,
    List<ShoeRotationPeerDto> OtherShoes
);

public record GetShoeAnalysisQuery(string UserId, Guid GearId) : IRequest<ShoeAnalysisDto?>;

public class GetShoeAnalysisQueryHandler : IRequestHandler<GetShoeAnalysisQuery, ShoeAnalysisDto?>
{
    private readonly IApplicationDbContext _db;
    public GetShoeAnalysisQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<ShoeAnalysisDto?> Handle(GetShoeAnalysisQuery request, CancellationToken ct)
    {
        var gear = await _db.Gear
            .Where(g => g.Id == request.GearId && g.UserId == request.UserId)
            .FirstOrDefaultAsync(ct);

        if (gear is null) return null;

        var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);

        // Activities using this gear
        var activities = await _db.Activities
            .Where(a => a.GearId == request.GearId)
            .OrderByDescending(a => a.StartDate)
            .Select(a => new { a.StartDate, a.Name, a.Distance, a.MovingTime })
            .ToListAsync(ct);

        var daysSinceLast = activities.Count > 0
            ? (int)(DateTime.UtcNow.Date - activities.First().StartDate.Date).TotalDays
            : -1;

        var totalDistanceKm = activities.Sum(a => a.Distance) / 1000.0;
        var totalActivities = activities.Count;

        // Monthly trend (last 6 months)
        var monthly = activities
            .Where(a => a.StartDate >= sixMonthsAgo)
            .GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g =>
            {
                var dist = g.Sum(a => a.Distance);
                var time = g.Sum(a => a.MovingTime);
                var pace = dist > 0 ? (time / 60.0) / (dist / 1000.0) : 0;
                return new ShoeMonthDto(
                    $"{g.Key.Year}-{g.Key.Month:D2}",
                    g.Count(),
                    Math.Round(dist / 1000.0, 1),
                    Math.Round(pace, 2)
                );
            })
            .ToList();

        // Fill in missing months
        var allMonths = Enumerable.Range(0, 6)
            .Select(i => DateTime.UtcNow.AddMonths(-5 + i))
            .Select(d => $"{d.Year}-{d.Month:D2}")
            .ToList();
        var monthDict = monthly.ToDictionary(m => m.MonthLabel);
        var fullMonthly = allMonths.Select(m =>
            monthDict.TryGetValue(m, out var val) ? val : new ShoeMonthDto(m, 0, 0, 0)
        ).ToList();

        // Recent activities (last 10)
        var recent = activities.Take(10)
            .Select(a => new ShoeRecentActivityDto(
                a.StartDate.ToString("yyyy-MM-dd"),
                a.Name,
                Math.Round(a.Distance / 1000.0, 1)
            ))
            .ToList();

        // Other active shoes for rotation comparison
        var otherShoes = await _db.Gear
            .Where(g => g.UserId == request.UserId
                && g.Type == GearType.Shoes
                && !g.IsRetired
                && g.Id != request.GearId)
            .ToListAsync(ct);

        var peers = new List<ShoeRotationPeerDto>();
        foreach (var shoe in otherShoes)
        {
            var latestActivity = await _db.Activities
                .Where(a => a.GearId == shoe.Id)
                .OrderByDescending(a => a.StartDate)
                .Select(a => (DateTime?)a.StartDate)
                .FirstOrDefaultAsync(ct);

            var days = latestActivity.HasValue
                ? (int)(DateTime.UtcNow.Date - latestActivity.Value.Date).TotalDays
                : -1;

            var totalDist = await _db.Activities
                .Where(a => a.GearId == shoe.Id)
                .SumAsync(a => a.Distance, ct);

            peers.Add(new ShoeRotationPeerDto(shoe.Id, shoe.Name, days, Math.Round(totalDist / 1000.0, 1)));
        }

        return new ShoeAnalysisDto(
            gear.Id,
            gear.Name,
            daysSinceLast,
            totalActivities,
            Math.Round(totalDistanceKm, 1),
            fullMonthly,
            recent,
            peers
        );
    }
}
