using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Infrastructure.Services;

public class BadgeService : IBadgeService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<BadgeService> _logger;

    public BadgeService(IApplicationDbContext db, ILogger<BadgeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task CheckAndAwardBadgesAsync(string userId, CancellationToken ct = default)
    {
        var earned = await _db.UserBadges
            .Where(b => b.UserId == userId)
            .Select(b => b.BadgeType)
            .ToHashSetAsync(ct);

        // Running activities
        var runs = await _db.Activities
            .Where(a => a.UserId == userId &&
                       (a.SportType == SportType.Run ||
                        a.SportType == SportType.TrailRun ||
                        a.SportType == SportType.VirtualRun))
            .Select(a => new { a.Id, a.Distance, a.TotalElevationGain, a.StartDate, a.MovingTime, a.AverageCadence, a.Calories })
            .ToListAsync(ct);

        // Cycling activities
        var rides = await _db.Activities
            .Where(a => a.UserId == userId && a.SportType == SportType.Ride)
            .Select(a => new { a.Id, a.Distance, a.StartDate })
            .ToListAsync(ct);

        // Swimming activities
        var swims = await _db.Activities
            .Where(a => a.UserId == userId && a.SportType == SportType.Swim)
            .Select(a => new { a.Id, a.Distance, a.StartDate })
            .ToListAsync(ct);

        // Walking / hiking activities
        var walks = await _db.Activities
            .Where(a => a.UserId == userId &&
                       (a.SportType == SportType.Walk ||
                        a.SportType == SportType.Hike))
            .Select(a => new { a.Id, a.Distance, a.StartDate })
            .ToListAsync(ct);

        var runsOrdered  = runs.OrderBy(a => a.StartDate).ToList();
        var ridesOrdered = rides.OrderBy(a => a.StartDate).ToList();
        var swimsOrdered = swims.OrderBy(a => a.StartDate).ToList();
        var walksOrdered = walks.OrderBy(a => a.StartDate).ToList();

        var totalRunDistanceM  = runs.Sum(a => a.Distance);
        var runCount           = runs.Count;
        var totalElevationM    = runs.Sum(a => a.TotalElevationGain);
        var totalRideDistanceM = rides.Sum(a => a.Distance);
        var totalSwimDistanceM = swims.Sum(a => a.Distance);
        var totalWalkDistanceM = walks.Sum(a => a.Distance);

        var totalCalories    = runs.Sum(a => a.Calories ?? 0);
        var maxMonthlyDistM  = runs.Count > 0
            ? runs.GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
                  .Select(g => g.Sum(a => (double)a.Distance))
                  .Max()
            : 0.0;

        var weekendRunDays = runs
            .Select(a => a.StartDate.Date)
            .Where(d => d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
            .Distinct()
            .Count();
        var maxRunDaysInWeek = runs.Count > 0
            ? runs.GroupBy(a => a.StartDate.Date.AddDays(-(int)a.StartDate.Date.DayOfWeek))
                  .Select(g => g.Select(a => a.StartDate.Date).Distinct().Count())
                  .Max()
            : 0;
        var maxRunsInDay  = runs.Count > 0
            ? runs.GroupBy(a => a.StartDate.Date).Select(g => g.Count()).Max()
            : 0;
        var longRunCount  = runs.Count(a => a.Distance >= 21097);

        // Compute when each streak length was first achieved
        DateTime? streak3Date = null, streak7Date = null, streak14Date = null,
                  streak30Date = null, streak60Date = null, streak100Date = null;
        {
            var dates = runsOrdered.Select(a => a.StartDate.Date).Distinct().OrderBy(d => d).ToList();
            int cur = 0; DateTime? last = null;
            foreach (var d in dates)
            {
                cur = (last.HasValue && (d - last.Value).TotalDays == 1) ? cur + 1 : 1;
                if (cur >= 3   && streak3Date   == null) streak3Date   = d;
                if (cur >= 7   && streak7Date   == null) streak7Date   = d;
                if (cur >= 14  && streak14Date  == null) streak14Date  = d;
                if (cur >= 30  && streak30Date  == null) streak30Date  = d;
                if (cur >= 60  && streak60Date  == null) streak60Date  = d;
                if (cur >= 100 && streak100Date == null) streak100Date = d;
                last = d;
            }
        }

        var tileCount = await _db.UserTiles.CountAsync(t => t.UserId == userId, ct);

        var newBadges = new List<UserBadge>();

        void Award(BadgeType type, Guid? activityId = null, DateTime? earnedAt = null)
        {
            if (earned.Contains(type)) return;
            earned.Add(type);
            newBadges.Add(new UserBadge
            {
                UserId     = userId,
                BadgeType  = type,
                EarnedAt   = earnedAt ?? DateTime.UtcNow,
                ActivityId = activityId,
            });
        }

        // Returns the date of the activity that pushed the cumulative run distance past a threshold.
        DateTime? RunDistanceTip(double threshold)
        {
            double acc = 0;
            foreach (var a in runsOrdered) { acc += a.Distance; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // Returns the date of the activity that pushed the cumulative run elevation past a threshold.
        DateTime? ElevationTip(double threshold)
        {
            double acc = 0;
            foreach (var a in runsOrdered) { acc += a.TotalElevationGain; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // Returns the date of the activity that pushed the cumulative ride distance past a threshold.
        DateTime? RideDistanceTip(double threshold)
        {
            double acc = 0;
            foreach (var a in ridesOrdered) { acc += a.Distance; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // Returns the date of the activity that pushed the cumulative swim distance past a threshold.
        DateTime? SwimDistanceTip(double threshold)
        {
            double acc = 0;
            foreach (var a in swimsOrdered) { acc += a.Distance; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // Returns the date of the activity that pushed the cumulative walk distance past a threshold.
        DateTime? WalkDistanceTip(double threshold)
        {
            double acc = 0;
            foreach (var a in walksOrdered) { acc += a.Distance; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // ---- Distance milestones (single run) ----
        foreach (var a in runs)
        {
            if (a.Distance >= 1000)   Award(BadgeType.First1K,      a.Id, a.StartDate);
            if (a.Distance >= 5000)   Award(BadgeType.First5K,      a.Id, a.StartDate);
            if (a.Distance >= 10000)  Award(BadgeType.First10K,     a.Id, a.StartDate);
            if (a.Distance >= 15000)  Award(BadgeType.First15K,     a.Id, a.StartDate);
            if (a.Distance >= 21097)  Award(BadgeType.First21K,     a.Id, a.StartDate);
            if (a.Distance >= 42195)  Award(BadgeType.First42K,     a.Id, a.StartDate);
            if (a.Distance >= 50000)  Award(BadgeType.First50K,     a.Id, a.StartDate);
            if (a.Distance >= 100000) Award(BadgeType.First100K,    a.Id, a.StartDate);
            if (a.Distance >= 160934) Award(BadgeType.First100Mile, a.Id, a.StartDate);

            if (a.TotalElevationGain >= 4808) Award(BadgeType.MontBlancRun,   a.Id, a.StartDate);
            if (a.TotalElevationGain >= 5895) Award(BadgeType.KilimanjaroRun, a.Id, a.StartDate);
            if (a.TotalElevationGain >= 8611) Award(BadgeType.K2Run,          a.Id, a.StartDate);
            if (a.TotalElevationGain >= 8848) Award(BadgeType.EverestRun,     a.Id, a.StartDate);
        }

        // ---- Cumulative elevation milestones ----
        if (totalElevationM >= 157)   Award(BadgeType.Cauberg,           null, ElevationTip(157));
        if (totalElevationM >= 322)   Award(BadgeType.Vaalserberg,       null, ElevationTip(322));
        if (totalElevationM >= 1912)  Award(BadgeType.MontVentoux,       null, ElevationTip(1912));
        if (totalElevationM >= 2962)  Award(BadgeType.Zugspitze,         null, ElevationTip(2962));
        if (totalElevationM >= 3357)  Award(BadgeType.Etna,              null, ElevationTip(3357));
        if (totalElevationM >= 8848)  Award(BadgeType.EverestCumulative, null, ElevationTip(8848));
        if (totalElevationM >= 17696) Award(BadgeType.EverestLevel2,     null, ElevationTip(17696));
        if (totalElevationM >= 26544) Award(BadgeType.EverestLevel3,     null, ElevationTip(26544));
        if (totalElevationM >= 35392) Award(BadgeType.EverestLevel4,     null, ElevationTip(35392));
        if (totalElevationM >= 44240) Award(BadgeType.EverestLevel5,     null, ElevationTip(44240));
        if (totalElevationM >= 53088) Award(BadgeType.EverestLevel6,     null, ElevationTip(53088));
        if (totalElevationM >= 61936) Award(BadgeType.EverestLevel7,     null, ElevationTip(61936));
        if (totalElevationM >= 70784) Award(BadgeType.EverestLevel8,     null, ElevationTip(70784));
        if (totalElevationM >= 79632) Award(BadgeType.EverestLevel9,     null, ElevationTip(79632));
        if (totalElevationM >= 88480) Award(BadgeType.EverestLevel10,    null, ElevationTip(88480));

        // ---- Total running distance milestones ----
        if (totalRunDistanceM >= 100_000)   Award(BadgeType.Total100km,  null, RunDistanceTip(100_000));
        if (totalRunDistanceM >= 500_000)   Award(BadgeType.Total500km,  null, RunDistanceTip(500_000));
        if (totalRunDistanceM >= 1_000_000) Award(BadgeType.Total1000km, null, RunDistanceTip(1_000_000));
        if (totalRunDistanceM >= 5_000_000) Award(BadgeType.Total5000km, null, RunDistanceTip(5_000_000));

        // ---- Running activity count ----
        if (runCount >= 1)    Award(BadgeType.FirstRun,  runsOrdered.ElementAtOrDefault(0)?.Id,   runsOrdered.ElementAtOrDefault(0)?.StartDate);
        if (runCount >= 10)   Award(BadgeType.Runs10,    runsOrdered.ElementAtOrDefault(9)?.Id,   runsOrdered.ElementAtOrDefault(9)?.StartDate);
        if (runCount >= 50)   Award(BadgeType.Runs50,    runsOrdered.ElementAtOrDefault(49)?.Id,  runsOrdered.ElementAtOrDefault(49)?.StartDate);
        if (runCount >= 100)  Award(BadgeType.Runs100,   runsOrdered.ElementAtOrDefault(99)?.Id,  runsOrdered.ElementAtOrDefault(99)?.StartDate);
        if (runCount >= 365)  Award(BadgeType.Runs365,   runsOrdered.ElementAtOrDefault(364)?.Id, runsOrdered.ElementAtOrDefault(364)?.StartDate);
        if (runCount >= 1000) Award(BadgeType.Runs1000,  runsOrdered.ElementAtOrDefault(999)?.Id, runsOrdered.ElementAtOrDefault(999)?.StartDate);

        // ---- Tile exploration ----
        if (tileCount >= 100)  Award(BadgeType.Tiles100);
        if (tileCount >= 500)  Award(BadgeType.Tiles500);
        if (tileCount >= 1000) Award(BadgeType.Tiles1000);
        if (tileCount >= 5000) Award(BadgeType.Tiles5000);

        // ---- Street exploration: any city 100% complete ----
        var hasCompletedCity = await _db.UserCityProgress
            .AnyAsync(p => p.UserId == userId && p.CompletionPercentage >= 100, ct);
        if (hasCompletedCity) Award(BadgeType.StreetExplorer);

        // ---- Cycling ----
        var rideCount = rides.Count;
        if (rideCount >= 1)  Award(BadgeType.FirstRide, ridesOrdered.ElementAtOrDefault(0)?.Id,  ridesOrdered.ElementAtOrDefault(0)?.StartDate);
        if (rideCount >= 10) Award(BadgeType.Rides10,   ridesOrdered.ElementAtOrDefault(9)?.Id,  ridesOrdered.ElementAtOrDefault(9)?.StartDate);
        if (rideCount >= 50) Award(BadgeType.Rides50,   ridesOrdered.ElementAtOrDefault(49)?.Id, ridesOrdered.ElementAtOrDefault(49)?.StartDate);
        if (totalRideDistanceM >= 100_000)   Award(BadgeType.CyclingTotal100km,  null, RideDistanceTip(100_000));
        if (totalRideDistanceM >= 500_000)   Award(BadgeType.CyclingTotal500km,  null, RideDistanceTip(500_000));
        if (totalRideDistanceM >= 1_000_000) Award(BadgeType.CyclingTotal1000km, null, RideDistanceTip(1_000_000));

        // ---- Swimming ----
        var swimCount = swims.Count;
        if (swimCount >= 1)  Award(BadgeType.FirstSwim, swimsOrdered.ElementAtOrDefault(0)?.Id,  swimsOrdered.ElementAtOrDefault(0)?.StartDate);
        if (swimCount >= 10) Award(BadgeType.Swims10,   swimsOrdered.ElementAtOrDefault(9)?.Id,  swimsOrdered.ElementAtOrDefault(9)?.StartDate);
        if (totalSwimDistanceM >= 10_000) Award(BadgeType.SwimTotal10km, null, SwimDistanceTip(10_000));
        if (totalSwimDistanceM >= 50_000) Award(BadgeType.SwimTotal50km, null, SwimDistanceTip(50_000));

        // ---- Walking & Hiking ----
        var walkCount = walks.Count;
        if (walkCount >= 1)  Award(BadgeType.FirstWalk,         walksOrdered.ElementAtOrDefault(0)?.Id,  walksOrdered.ElementAtOrDefault(0)?.StartDate);
        if (walkCount >= 10) Award(BadgeType.Walks10,            walksOrdered.ElementAtOrDefault(9)?.Id,  walksOrdered.ElementAtOrDefault(9)?.StartDate);
        if (totalWalkDistanceM >= 100_000) Award(BadgeType.WalkingTotal100km, null, WalkDistanceTip(100_000));

        // ---- Speed: pace badges ----
        // pace (min/km) = MovingTime(s) / 60 / (Distance(m) / 1000)
        (Guid? actId, DateTime? date) FirstAtPace(double minDistM, double maxPaceMinPerKm)
        {
            var r = runsOrdered.FirstOrDefault(a =>
                a.Distance >= minDistM && a.MovingTime > 0 &&
                (double)a.MovingTime / 60.0 / (a.Distance / 1000.0) < maxPaceMinPerKm);
            return r is null ? (null, null) : (r.Id, r.StartDate);
        }

        { var (id, dt) = FirstAtPace(5000,  7.0);  if (id.HasValue) Award(BadgeType.Sub75K,      id, dt); }
        { var (id, dt) = FirstAtPace(5000,  6.0);  if (id.HasValue) Award(BadgeType.Sub65K,      id, dt); }
        { var (id, dt) = FirstAtPace(5000,  5.0);  if (id.HasValue) Award(BadgeType.Sub55K,      id, dt); }
        { var (id, dt) = FirstAtPace(5000,  4.5);  if (id.HasValue) Award(BadgeType.Sub4305K,    id, dt); }
        { var (id, dt) = FirstAtPace(5000,  4.0);  if (id.HasValue) Award(BadgeType.Sub45K,      id, dt); }
        { var (id, dt) = FirstAtPace(10000, 6.0);  if (id.HasValue) Award(BadgeType.Sub610K,     id, dt); }
        { var (id, dt) = FirstAtPace(10000, 5.0);  if (id.HasValue) Award(BadgeType.Sub510K,     id, dt); }
        { var (id, dt) = FirstAtPace(10000, 4.5);  if (id.HasValue) Award(BadgeType.Sub43010K,   id, dt); }
        { var (id, dt) = FirstAtPace(21097, 6.0);  if (id.HasValue) Award(BadgeType.Sub6Half,    id, dt); }
        { var (id, dt) = FirstAtPace(21097, 5.5);  if (id.HasValue) Award(BadgeType.Sub530Half,  id, dt); }
        { var (id, dt) = FirstAtPace(21097, 5.0);  if (id.HasValue) Award(BadgeType.Sub5Half,    id, dt); }
        { var (id, dt) = FirstAtPace(42195, 5.0);  if (id.HasValue) Award(BadgeType.Sub5Marathon,id, dt); }

        // ---- Streak badges ----
        if (streak3Date.HasValue)   Award(BadgeType.Streak3,   null, streak3Date);
        if (streak7Date.HasValue)   Award(BadgeType.Streak7,   null, streak7Date);
        if (streak14Date.HasValue)  Award(BadgeType.Streak14,  null, streak14Date);
        if (streak30Date.HasValue)  Award(BadgeType.Streak30,  null, streak30Date);
        if (streak60Date.HasValue)  Award(BadgeType.Streak60,  null, streak60Date);
        if (streak100Date.HasValue) Award(BadgeType.Streak100, null, streak100Date);

        // ---- Cadence badges ----
        // AverageCadence is stored as single-foot SPM; multiply by 2 for total SPM
        foreach (var a in runs)
        {
            if (a.AverageCadence == null || a.Distance < 5000) continue;
            var spm = a.AverageCadence.Value * 2;
            if (spm >= 170) Award(BadgeType.RhythmRunner,    a.Id, a.StartDate);
            if (spm >= 180) Award(BadgeType.MetronomeRunner, a.Id, a.StartDate);
            if (spm >= 185) Award(BadgeType.StrideMaster,    a.Id, a.StartDate);
        }

        // ---- Calorie badges ----
        foreach (var a in runs)
        {
            if (a.Calories == null) continue;
            if (a.Calories >= 500)  Award(BadgeType.CalorieBurner500, a.Id, a.StartDate);
            if (a.Calories >= 1000) Award(BadgeType.Inferno,          a.Id, a.StartDate);
        }
        if (totalCalories >= 10_000)  Award(BadgeType.TotalCal10K);
        if (totalCalories >= 50_000)  Award(BadgeType.TotalCal50K);
        if (totalCalories >= 100_000) Award(BadgeType.TotalCal100K);

        // ---- Monthly volume badges ----
        if (maxMonthlyDistM >= 50_000)  Award(BadgeType.Month50km);
        if (maxMonthlyDistM >= 100_000) Award(BadgeType.Month100km);
        if (maxMonthlyDistM >= 200_000) Award(BadgeType.Month200km);
        if (maxMonthlyDistM >= 300_000) Award(BadgeType.Month300km);

        // ---- More single-run distance milestones ----
        foreach (var a in runs)
        {
            if (a.Distance >= 20000)  Award(BadgeType.First20K,            a.Id, a.StartDate);
            if (a.Distance >= 25000)  Award(BadgeType.First25K,            a.Id, a.StartDate);
            if (a.Distance >= 30000)  Award(BadgeType.First30K,            a.Id, a.StartDate);
            if (a.Distance >= 35000)  Award(BadgeType.First35K,            a.Id, a.StartDate);
            if (a.Distance >= 75000)  Award(BadgeType.First75K,            a.Id, a.StartDate);
            if (a.Distance >= 84390)  Award(BadgeType.FirstDoubleMarathon, a.Id, a.StartDate);
        }

        // ---- More total running distance milestones ----
        if (totalRunDistanceM >= 250_000)    Award(BadgeType.Total250km,   null, RunDistanceTip(250_000));
        if (totalRunDistanceM >= 750_000)    Award(BadgeType.Total750km,   null, RunDistanceTip(750_000));
        if (totalRunDistanceM >= 2_000_000)  Award(BadgeType.Total2000km,  null, RunDistanceTip(2_000_000));
        if (totalRunDistanceM >= 3_000_000)  Award(BadgeType.Total3000km,  null, RunDistanceTip(3_000_000));
        if (totalRunDistanceM >= 10_000_000) Award(BadgeType.Total10000km, null, RunDistanceTip(10_000_000));
        if (totalRunDistanceM >= 15_000_000) Award(BadgeType.Total15000km, null, RunDistanceTip(15_000_000));

        // ---- More run count milestones ----
        if (runCount >= 25)   Award(BadgeType.Runs25,   runsOrdered.ElementAtOrDefault(24)?.Id,   runsOrdered.ElementAtOrDefault(24)?.StartDate);
        if (runCount >= 75)   Award(BadgeType.Runs75,   runsOrdered.ElementAtOrDefault(74)?.Id,   runsOrdered.ElementAtOrDefault(74)?.StartDate);
        if (runCount >= 150)  Award(BadgeType.Runs150,  runsOrdered.ElementAtOrDefault(149)?.Id,  runsOrdered.ElementAtOrDefault(149)?.StartDate);
        if (runCount >= 200)  Award(BadgeType.Runs200,  runsOrdered.ElementAtOrDefault(199)?.Id,  runsOrdered.ElementAtOrDefault(199)?.StartDate);
        if (runCount >= 300)  Award(BadgeType.Runs300,  runsOrdered.ElementAtOrDefault(299)?.Id,  runsOrdered.ElementAtOrDefault(299)?.StartDate);
        if (runCount >= 500)  Award(BadgeType.Runs500,  runsOrdered.ElementAtOrDefault(499)?.Id,  runsOrdered.ElementAtOrDefault(499)?.StartDate);
        if (runCount >= 750)  Award(BadgeType.Runs750,  runsOrdered.ElementAtOrDefault(749)?.Id,  runsOrdered.ElementAtOrDefault(749)?.StartDate);
        if (runCount >= 1500) Award(BadgeType.Runs1500, runsOrdered.ElementAtOrDefault(1499)?.Id, runsOrdered.ElementAtOrDefault(1499)?.StartDate);
        if (runCount >= 2000) Award(BadgeType.Runs2000, runsOrdered.ElementAtOrDefault(1999)?.Id, runsOrdered.ElementAtOrDefault(1999)?.StartDate);
        if (runCount >= 2500) Award(BadgeType.Runs2500, runsOrdered.ElementAtOrDefault(2499)?.Id, runsOrdered.ElementAtOrDefault(2499)?.StartDate);

        // ---- Habit badges ----
        if (weekendRunDays >= 20)   Award(BadgeType.WeekendWarrior);
        if (maxRunDaysInWeek >= 5)  Award(BadgeType.FiveDayWeek);
        if (maxRunDaysInWeek >= 6)  Award(BadgeType.SixDayWeek);
        if (maxRunsInDay >= 2)      Award(BadgeType.DailyDouble);
        if (longRunCount >= 10)     Award(BadgeType.LongRunner10);

        // ---- More single-run elevation milestones ----
        foreach (var a in runs)
        {
            if (a.TotalElevationGain >= 200)  Award(BadgeType.HillStarter,    a.Id, a.StartDate);
            if (a.TotalElevationGain >= 500)  Award(BadgeType.HillClimber,    a.Id, a.StartDate);
            if (a.TotalElevationGain >= 1000) Award(BadgeType.MountainRunner, a.Id, a.StartDate);
            if (a.TotalElevationGain >= 2000) Award(BadgeType.AlpineMaster,   a.Id, a.StartDate);
            if (a.TotalElevationGain >= 3000) Award(BadgeType.HighPeaks,      a.Id, a.StartDate);
        }

        if (newBadges.Count > 0)
        {
            _db.UserBadges.AddRange(newBadges);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Awarded {Count} new badges to user {UserId}", newBadges.Count, userId);
        }
    }
}
