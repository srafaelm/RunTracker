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
            .Select(a => new { a.Id, a.Distance, a.TotalElevationGain, a.MovingTime, a.StartDate })
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
            .Select(a => new { a.Id, a.Distance, a.TotalElevationGain, a.StartDate })
            .ToListAsync(ct);

        var runsOrdered  = runs.OrderBy(a => a.StartDate).ToList();
        var ridesOrdered = rides.OrderBy(a => a.StartDate).ToList();
        var swimsOrdered = swims.OrderBy(a => a.StartDate).ToList();
        var walksOrdered = walks.OrderBy(a => a.StartDate).ToList();

        var totalRunDistanceM  = runs.Sum(a => a.Distance);
        var runCount           = runs.Count;
        var totalElevationM    = runs.Sum(a => a.TotalElevationGain);
        var totalSwimDistanceM = swims.Sum(a => a.Distance);
        var totalWalkDistanceM = walks.Sum(a => a.Distance);

        var totalCalories      = runs.Sum(a => a.Calories ?? 0);
        var totalMovingTimeSec = runs.Sum(a => (long)a.MovingTime);
        var maxMonthlyDistM  = runs.Count > 0
            ? runs.GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
                  .Select(g => g.Sum(a => (double)a.Distance))
                  .Max()
            : 0.0;
        var maxYearlyDistM = runs.Count > 0
            ? runs.GroupBy(a => a.StartDate.Year)
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
        var maxRunsInDay    = runs.Count > 0
            ? runs.GroupBy(a => a.StartDate.Date).Select(g => g.Count()).Max()
            : 0;
        var longRunCount    = runs.Count(a => a.Distance >= 21097);
        var marathonCount   = runs.Count(a => a.Distance >= 42195);
        var morningRunCount = runs.Count(a => a.StartDate.Hour < 8);
        var eveningRunCount = runs.Count(a => a.StartDate.Hour >= 20);

        var totalRideDistanceM  = rides.Sum(a => a.Distance);
        var totalRideElevationM = rides.Sum(a => a.TotalElevationGain);
        var maxRideMonthlyDistM = rides.Count > 0
            ? rides.GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
                   .Select(g => g.Sum(a => (double)a.Distance))
                   .Max()
            : 0.0;

        // Compute when each streak length was first achieved
        DateTime? streak3Date = null, streak7Date = null, streak14Date = null,
                  streak30Date = null, streak60Date = null, streak100Date = null,
                  streak200Date = null, streak365Date = null;
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
                if (cur >= 200 && streak200Date == null) streak200Date = d;
                if (cur >= 365 && streak365Date == null) streak365Date = d;
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

        // Returns the date of the activity that pushed the cumulative ride elevation past a threshold.
        DateTime? RideElevationTip(double threshold)
        {
            double acc = 0;
            foreach (var a in ridesOrdered) { acc += a.TotalElevationGain; if (acc >= threshold) return a.StartDate; }
            return null;
        }

        // Returns the Nth run (1-indexed, ordered by date) that meets a distance filter, or null.
        (Guid? id, DateTime? date) NthRun(int n, double minDist = 0)
        {
            var filtered2 = minDist > 0 ? runsOrdered.Where(a => a.Distance >= minDist).ToList() : runsOrdered;
            var item = filtered2.ElementAtOrDefault(n - 1);
            return item is null ? (null, null) : (item.Id, item.StartDate);
        }

        // ---- Distance milestones (single run) ----
        foreach (var a in runsOrdered)
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

            if (a.TotalElevationGain >= 50)   Award(BadgeType.ElevationSprint50,  a.Id, a.StartDate);
            if (a.TotalElevationGain >= 100)  Award(BadgeType.ElevationSprint100, a.Id, a.StartDate);
            if (a.TotalElevationGain >= 4808) Award(BadgeType.MontBlancRun,       a.Id, a.StartDate);
            if (a.TotalElevationGain >= 5895) Award(BadgeType.KilimanjaroRun,     a.Id, a.StartDate);
            if (a.TotalElevationGain >= 8611) Award(BadgeType.K2Run,              a.Id, a.StartDate);
            if (a.TotalElevationGain >= 8848) Award(BadgeType.EverestRun,         a.Id, a.StartDate);
        }

        // ---- Cumulative elevation milestones ----
        if (totalElevationM >= 157)    Award(BadgeType.Cauberg,            null, ElevationTip(157));
        if (totalElevationM >= 322)    Award(BadgeType.Vaalserberg,        null, ElevationTip(322));
        if (totalElevationM >= 500)    Award(BadgeType.CumElev500,         null, ElevationTip(500));
        if (totalElevationM >= 1000)   Award(BadgeType.CumElev1000,        null, ElevationTip(1000));
        if (totalElevationM >= 1912)   Award(BadgeType.MontVentoux,        null, ElevationTip(1912));
        if (totalElevationM >= 2962)   Award(BadgeType.Zugspitze,          null, ElevationTip(2962));
        if (totalElevationM >= 3357)   Award(BadgeType.Etna,               null, ElevationTip(3357));
        if (totalElevationM >= 4478)   Award(BadgeType.CumElevMatterhorn,  null, ElevationTip(4478));
        if (totalElevationM >= 5000)   Award(BadgeType.CumElev5000,        null, ElevationTip(5000));
        if (totalElevationM >= 5895)   Award(BadgeType.CumElevKilimanjaro, null, ElevationTip(5895));
        if (totalElevationM >= 8611)   Award(BadgeType.CumElevK2,          null, ElevationTip(8611));
        if (totalElevationM >= 8848)   Award(BadgeType.EverestCumulative,  null, ElevationTip(8848));
        if (totalElevationM >= 17696)  Award(BadgeType.EverestLevel2,      null, ElevationTip(17696));
        if (totalElevationM >= 25000)  Award(BadgeType.CumElev25000,       null, ElevationTip(25000));
        if (totalElevationM >= 26544)  Award(BadgeType.EverestLevel3,      null, ElevationTip(26544));
        if (totalElevationM >= 35392)  Award(BadgeType.EverestLevel4,      null, ElevationTip(35392));
        if (totalElevationM >= 44240)  Award(BadgeType.EverestLevel5,      null, ElevationTip(44240));
        if (totalElevationM >= 50000)  Award(BadgeType.CumElev50000,       null, ElevationTip(50000));
        if (totalElevationM >= 53088)  Award(BadgeType.EverestLevel6,      null, ElevationTip(53088));
        if (totalElevationM >= 61936)  Award(BadgeType.EverestLevel7,      null, ElevationTip(61936));
        if (totalElevationM >= 70784)  Award(BadgeType.EverestLevel8,      null, ElevationTip(70784));
        if (totalElevationM >= 79632)  Award(BadgeType.EverestLevel9,      null, ElevationTip(79632));
        if (totalElevationM >= 88480)  Award(BadgeType.EverestLevel10,     null, ElevationTip(88480));
        if (totalElevationM >= 100000) Award(BadgeType.CumElev100000,      null, ElevationTip(100000));

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

        { var (id, dt) = FirstAtPace(5000,  7.0);  if (id.HasValue) Award(BadgeType.Sub75K,         id, dt); }
        { var (id, dt) = FirstAtPace(5000,  6.0);  if (id.HasValue) Award(BadgeType.Sub65K,         id, dt); }
        { var (id, dt) = FirstAtPace(5000,  5.0);  if (id.HasValue) Award(BadgeType.Sub55K,         id, dt); }
        { var (id, dt) = FirstAtPace(5000,  4.5);  if (id.HasValue) Award(BadgeType.Sub4305K,       id, dt); }
        { var (id, dt) = FirstAtPace(5000,  4.0);  if (id.HasValue) Award(BadgeType.Sub45K,         id, dt); }
        { var (id, dt) = FirstAtPace(10000, 6.0);  if (id.HasValue) Award(BadgeType.Sub610K,        id, dt); }
        { var (id, dt) = FirstAtPace(10000, 5.0);  if (id.HasValue) Award(BadgeType.Sub510K,        id, dt); }
        { var (id, dt) = FirstAtPace(10000, 4.5);  if (id.HasValue) Award(BadgeType.Sub43010K,      id, dt); }
        { var (id, dt) = FirstAtPace(10000, 4.0);  if (id.HasValue) Award(BadgeType.Sub4Per10K,     id, dt); }
        { var (id, dt) = FirstAtPace(21097, 6.0);  if (id.HasValue) Award(BadgeType.Sub6Half,       id, dt); }
        { var (id, dt) = FirstAtPace(21097, 5.5);  if (id.HasValue) Award(BadgeType.Sub530Half,     id, dt); }
        { var (id, dt) = FirstAtPace(21097, 5.0);  if (id.HasValue) Award(BadgeType.Sub5Half,       id, dt); }
        { var (id, dt) = FirstAtPace(21097, 4.5);  if (id.HasValue) Award(BadgeType.Sub430Per21K,   id, dt); }
        { var (id, dt) = FirstAtPace(21097, 4.0);  if (id.HasValue) Award(BadgeType.Sub4Per21K,     id, dt); }
        { var (id, dt) = FirstAtPace(42195, 5.0);  if (id.HasValue) Award(BadgeType.Sub5Marathon,   id, dt); }
        { var (id, dt) = FirstAtPace(42195, 4.5);  if (id.HasValue) Award(BadgeType.Sub430Marathon, id, dt); }
        { var (id, dt) = FirstAtPace(42195, 4.0);  if (id.HasValue) Award(BadgeType.Sub4Marathon,   id, dt); }
        { var (id, dt) = FirstAtPace(1000,  4.0);  if (id.HasValue) Award(BadgeType.Sub4Per1K,      id, dt); }
        { var (id, dt) = FirstAtPace(1000,  3.5);  if (id.HasValue) Award(BadgeType.Sub330Per1K,    id, dt); }
        { var (id, dt) = FirstAtPace(1000,  3.0);  if (id.HasValue) Award(BadgeType.Sub3Per1K,      id, dt); }
        { var (id, dt) = FirstAtPace(400,   3.0);  if (id.HasValue) Award(BadgeType.Sub3Per400m,    id, dt); }

        // ---- Streak badges ----
        if (streak3Date.HasValue)   Award(BadgeType.Streak3,   null, streak3Date);
        if (streak7Date.HasValue)   Award(BadgeType.Streak7,   null, streak7Date);
        if (streak14Date.HasValue)  Award(BadgeType.Streak14,  null, streak14Date);
        if (streak30Date.HasValue)  Award(BadgeType.Streak30,  null, streak30Date);
        if (streak60Date.HasValue)  Award(BadgeType.Streak60,  null, streak60Date);
        if (streak100Date.HasValue) Award(BadgeType.Streak100, null, streak100Date);

        // ---- Cadence badges ----
        // AverageCadence is stored as single-foot SPM; multiply by 2 for total SPM
        foreach (var a in runsOrdered)
        {
            if (a.AverageCadence == null || a.Distance < 5000) continue;
            var spm = a.AverageCadence.Value * 2;
            if (spm >= 170) Award(BadgeType.RhythmRunner,    a.Id, a.StartDate);
            if (spm >= 180) Award(BadgeType.MetronomeRunner, a.Id, a.StartDate);
            if (spm >= 185) Award(BadgeType.StrideMaster,    a.Id, a.StartDate);
        }

        // ---- Calorie badges ----
        foreach (var a in runsOrdered)
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
        foreach (var a in runsOrdered)
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
        if (weekendRunDays >= 20)    Award(BadgeType.WeekendWarrior);
        if (weekendRunDays >= 50)    Award(BadgeType.WeekendWarrior50);
        if (weekendRunDays >= 100)   Award(BadgeType.WeekendWarrior100);
        if (maxRunDaysInWeek >= 5)   Award(BadgeType.FiveDayWeek);
        if (maxRunDaysInWeek >= 6)   Award(BadgeType.SixDayWeek);
        if (maxRunsInDay >= 2)       Award(BadgeType.DailyDouble);
        if (longRunCount >= 10)      Award(BadgeType.LongRunner10);
        if (longRunCount >= 25)      Award(BadgeType.LongRunner25);
        if (longRunCount >= 50)      Award(BadgeType.LongRunner50);
        if (longRunCount >= 100)     Award(BadgeType.LongRunner100);
        if (morningRunCount >= 1)    Award(BadgeType.EarlyBird,   runsOrdered.FirstOrDefault(a => a.StartDate.Hour < 7)?.Id,  runsOrdered.FirstOrDefault(a => a.StartDate.Hour < 7)?.StartDate);
        if (morningRunCount >= 10)   Award(BadgeType.EarlyBird10);
        if (eveningRunCount >= 1)    Award(BadgeType.NightOwl,    runsOrdered.FirstOrDefault(a => a.StartDate.Hour >= 21)?.Id, runsOrdered.FirstOrDefault(a => a.StartDate.Hour >= 21)?.StartDate);
        if (eveningRunCount >= 10)   Award(BadgeType.NightOwl10);

        // ---- More single-run elevation milestones ----
        foreach (var a in runsOrdered)
        {
            if (a.TotalElevationGain >= 200)  Award(BadgeType.HillStarter,    a.Id, a.StartDate);
            if (a.TotalElevationGain >= 500)  Award(BadgeType.HillClimber,    a.Id, a.StartDate);
            if (a.TotalElevationGain >= 1000) Award(BadgeType.MountainRunner, a.Id, a.StartDate);
            if (a.TotalElevationGain >= 2000) Award(BadgeType.AlpineMaster,   a.Id, a.StartDate);
            if (a.TotalElevationGain >= 3000) Award(BadgeType.HighPeaks,      a.Id, a.StartDate);
        }
        // Note: ElevationSprint50 and ElevationSprint100 are handled in the first run loop above

        // ---- Extended streaks ----
        if (streak200Date.HasValue)  Award(BadgeType.Streak200,  null, streak200Date);
        if (streak365Date.HasValue)  Award(BadgeType.Streak365,  null, streak365Date);

        // ---- Extended cadence ----
        foreach (var a in runsOrdered)
        {
            if (a.AverageCadence == null || a.Distance < 5000) continue;
            var spm = a.AverageCadence.Value * 2;
            if (spm >= 190) Award(BadgeType.StrideLegend, a.Id, a.StartDate);
        }

        // ---- Monthly volume additions ----
        if (maxMonthlyDistM >= 150_000) Award(BadgeType.Month150km);
        if (maxMonthlyDistM >= 400_000) Award(BadgeType.Month400km);
        if (maxMonthlyDistM >= 500_000) Award(BadgeType.Month500km);

        // ---- Yearly volume ----
        if (maxYearlyDistM >= 500_000)   Award(BadgeType.Year500km);
        if (maxYearlyDistM >= 1_000_000) Award(BadgeType.Year1000km);
        if (maxYearlyDistM >= 2_000_000) Award(BadgeType.Year2000km);
        if (maxYearlyDistM >= 3_000_000) Award(BadgeType.Year3000km);

        // ---- Total moving time ----
        if (totalMovingTimeSec >= 360_000)   Award(BadgeType.TotalHours100);
        if (totalMovingTimeSec >= 900_000)   Award(BadgeType.TotalHours250);
        if (totalMovingTimeSec >= 1_800_000) Award(BadgeType.TotalHours500);
        if (totalMovingTimeSec >= 3_600_000) Award(BadgeType.TotalHours1000);

        // ---- Total calorie additions ----
        if (totalCalories >= 200_000) Award(BadgeType.TotalCal200K);
        if (totalCalories >= 500_000) Award(BadgeType.TotalCal500K);

        // ---- Marathon & half-marathon counts ----
        if (marathonCount >= 3)  { var (id, dt) = NthRun(3,  42195); Award(BadgeType.MarathonFinisher3,  id, dt); }
        if (marathonCount >= 5)  { var (id, dt) = NthRun(5,  42195); Award(BadgeType.MarathonFinisher5,  id, dt); }
        if (marathonCount >= 10) { var (id, dt) = NthRun(10, 42195); Award(BadgeType.MarathonFinisher10, id, dt); }
        if (marathonCount >= 20) { var (id, dt) = NthRun(20, 42195); Award(BadgeType.MarathonFinisher20, id, dt); }
        if (marathonCount >= 50) { var (id, dt) = NthRun(50, 42195); Award(BadgeType.MarathonFinisher50, id, dt); }
        if (longRunCount >= 5)   { var (id, dt) = NthRun(5,  21097); Award(BadgeType.HalfMarathonCount5,  id, dt); }
        if (longRunCount >= 10)  { var (id, dt) = NthRun(10, 21097); Award(BadgeType.HalfMarathonCount10, id, dt); }
        if (longRunCount >= 25)  { var (id, dt) = NthRun(25, 21097); Award(BadgeType.HalfMarathonCount25, id, dt); }

        // ---- Time-based single run milestones ----
        foreach (var a in runsOrdered)
        {
            if (a.MovingTime >= 3600)  Award(BadgeType.Run1Hour,  a.Id, a.StartDate);
            if (a.MovingTime >= 7200)  Award(BadgeType.Run2Hours, a.Id, a.StartDate);
            if (a.MovingTime >= 10800) Award(BadgeType.Run3Hours, a.Id, a.StartDate);
            if (a.MovingTime >= 21600) Award(BadgeType.Run6Hours, a.Id, a.StartDate);
        }

        // ---- Beginner pace ----
        { var (id, dt) = FirstAtPace(5000, 8.0); if (id.HasValue) Award(BadgeType.Sub85K, id, dt); }

        // ---- Short-distance pace additions ----
        { var (id, dt) = FirstAtPace(1000, 5.0); if (id.HasValue) Award(BadgeType.Sub5Per1K,  id, dt); }
        { var (id, dt) = FirstAtPace(1000, 4.5); if (id.HasValue) Award(BadgeType.Sub45Per1K, id, dt); }

        // ---- More total running distance ----
        if (totalRunDistanceM >= 4_000_000)  Award(BadgeType.Total4000km, null, RunDistanceTip(4_000_000));
        if (totalRunDistanceM >= 6_000_000)  Award(BadgeType.Total6000km, null, RunDistanceTip(6_000_000));
        if (totalRunDistanceM >= 7_500_000)  Award(BadgeType.Total7500km, null, RunDistanceTip(7_500_000));

        // ---- More run count milestones ----
        if (runCount >= 3000) Award(BadgeType.Runs3000, runsOrdered.ElementAtOrDefault(2999)?.Id, runsOrdered.ElementAtOrDefault(2999)?.StartDate);
        if (runCount >= 4000) Award(BadgeType.Runs4000, runsOrdered.ElementAtOrDefault(3999)?.Id, runsOrdered.ElementAtOrDefault(3999)?.StartDate);
        if (runCount >= 5000) Award(BadgeType.Runs5000, runsOrdered.ElementAtOrDefault(4999)?.Id, runsOrdered.ElementAtOrDefault(4999)?.StartDate);

        // ---- Exploration additions ----
        if (tileCount >= 2500)  Award(BadgeType.Tiles2500);
        if (tileCount >= 10000) Award(BadgeType.Tiles10000);

        // ---- Cycling: single-ride distance milestones ----
        foreach (var a in ridesOrdered)
        {
            if (a.Distance >= 20_000)  Award(BadgeType.FirstRide20K,  a.Id, a.StartDate);
            if (a.Distance >= 50_000)  Award(BadgeType.FirstRide50K,  a.Id, a.StartDate);
            if (a.Distance >= 100_000) Award(BadgeType.FirstRide100K, a.Id, a.StartDate);
            if (a.Distance >= 200_000) Award(BadgeType.FirstRide200K, a.Id, a.StartDate);
        }

        // ---- Cycling: ride count ----
        var rideCount2 = rides.Count;
        if (rideCount2 >= 25)  Award(BadgeType.Rides25,  ridesOrdered.ElementAtOrDefault(24)?.Id,  ridesOrdered.ElementAtOrDefault(24)?.StartDate);
        if (rideCount2 >= 100) Award(BadgeType.Rides100, ridesOrdered.ElementAtOrDefault(99)?.Id,  ridesOrdered.ElementAtOrDefault(99)?.StartDate);
        if (rideCount2 >= 200) Award(BadgeType.Rides200, ridesOrdered.ElementAtOrDefault(199)?.Id, ridesOrdered.ElementAtOrDefault(199)?.StartDate);
        if (rideCount2 >= 500) Award(BadgeType.Rides500, ridesOrdered.ElementAtOrDefault(499)?.Id, ridesOrdered.ElementAtOrDefault(499)?.StartDate);

        // ---- Cycling: total distance additions ----
        if (totalRideDistanceM >= 2_000_000)  Award(BadgeType.CyclingTotal2000km,  null, RideDistanceTip(2_000_000));
        if (totalRideDistanceM >= 5_000_000)  Award(BadgeType.CyclingTotal5000km,  null, RideDistanceTip(5_000_000));
        if (totalRideDistanceM >= 10_000_000) Award(BadgeType.CyclingTotal10000km, null, RideDistanceTip(10_000_000));

        // ---- Cycling: single-ride elevation ----
        foreach (var a in ridesOrdered)
        {
            if (a.TotalElevationGain >= 500)  Award(BadgeType.CyclingElevation500,  a.Id, a.StartDate);
            if (a.TotalElevationGain >= 1000) Award(BadgeType.CyclingElevation1000, a.Id, a.StartDate);
            if (a.TotalElevationGain >= 2000) Award(BadgeType.CyclingElevation2000, a.Id, a.StartDate);
        }

        // ---- Cycling: cumulative elevation ----
        if (totalRideElevationM >= 5_000)  Award(BadgeType.CyclingCumElev5000,  null, RideElevationTip(5_000));
        if (totalRideElevationM >= 10_000) Award(BadgeType.CyclingCumElev10000, null, RideElevationTip(10_000));
        if (totalRideElevationM >= 50_000) Award(BadgeType.CyclingCumElev50000, null, RideElevationTip(50_000));

        // ---- Cycling: speed badges (compute from distance / moving time) ----
        foreach (var a in ridesOrdered)
        {
            if (a.Distance < 20_000 || a.MovingTime <= 0) continue;
            var speedKmh = a.Distance / 1000.0 / (a.MovingTime / 3600.0);
            if (speedKmh >= 30) Award(BadgeType.CyclingSpeed30, a.Id, a.StartDate);
            if (speedKmh >= 35) Award(BadgeType.CyclingSpeed35, a.Id, a.StartDate);
            if (speedKmh >= 40) Award(BadgeType.CyclingSpeed40, a.Id, a.StartDate);
        }

        // ---- Cycling: monthly volume ----
        if (maxRideMonthlyDistM >= 500_000)   Award(BadgeType.CyclingMonth500km);
        if (maxRideMonthlyDistM >= 1_000_000) Award(BadgeType.CyclingMonth1000km);

        // ---- Swimming: single-swim distance ----
        foreach (var a in swimsOrdered)
        {
            if (a.Distance >= 500)  Award(BadgeType.FirstSwim500m, a.Id, a.StartDate);
            if (a.Distance >= 1000) Award(BadgeType.FirstSwim1K,   a.Id, a.StartDate);
            if (a.Distance >= 2000) Award(BadgeType.FirstSwim2K,   a.Id, a.StartDate);
            if (a.Distance >= 5000) Award(BadgeType.FirstSwim5K,   a.Id, a.StartDate);
        }

        // ---- Swimming: count additions ----
        var swimCount2 = swims.Count;
        if (swimCount2 >= 25)  Award(BadgeType.Swims25,  swimsOrdered.ElementAtOrDefault(24)?.Id,  swimsOrdered.ElementAtOrDefault(24)?.StartDate);
        if (swimCount2 >= 50)  Award(BadgeType.Swims50,  swimsOrdered.ElementAtOrDefault(49)?.Id,  swimsOrdered.ElementAtOrDefault(49)?.StartDate);
        if (swimCount2 >= 100) Award(BadgeType.Swims100, swimsOrdered.ElementAtOrDefault(99)?.Id,  swimsOrdered.ElementAtOrDefault(99)?.StartDate);

        // ---- Swimming: total distance additions ----
        if (totalSwimDistanceM >= 25_000)  Award(BadgeType.SwimTotal25km,  null, SwimDistanceTip(25_000));
        if (totalSwimDistanceM >= 100_000) Award(BadgeType.SwimTotal100km, null, SwimDistanceTip(100_000));
        if (totalSwimDistanceM >= 200_000) Award(BadgeType.SwimTotal200km, null, SwimDistanceTip(200_000));

        // ---- Walking & Hiking: single-activity distance ----
        foreach (var a in walksOrdered)
        {
            if (a.Distance >= 10_000) Award(BadgeType.FirstHike10K, a.Id, a.StartDate);
            if (a.Distance >= 20_000) Award(BadgeType.FirstHike20K, a.Id, a.StartDate);
        }

        // ---- Walking & Hiking: count additions ----
        var walkCount2 = walks.Count;
        if (walkCount2 >= 25)  Award(BadgeType.Walks25,  walksOrdered.ElementAtOrDefault(24)?.Id,  walksOrdered.ElementAtOrDefault(24)?.StartDate);
        if (walkCount2 >= 50)  Award(BadgeType.Walks50,  walksOrdered.ElementAtOrDefault(49)?.Id,  walksOrdered.ElementAtOrDefault(49)?.StartDate);
        if (walkCount2 >= 100) Award(BadgeType.Walks100, walksOrdered.ElementAtOrDefault(99)?.Id,  walksOrdered.ElementAtOrDefault(99)?.StartDate);

        // ---- Walking & Hiking: total distance additions ----
        if (totalWalkDistanceM >= 250_000)   Award(BadgeType.WalkingTotal250km,  null, WalkDistanceTip(250_000));
        if (totalWalkDistanceM >= 500_000)   Award(BadgeType.WalkingTotal500km,  null, WalkDistanceTip(500_000));
        if (totalWalkDistanceM >= 1_000_000) Award(BadgeType.WalkingTotal1000km, null, WalkDistanceTip(1_000_000));

        // ---- Walking & Hiking: single-activity elevation ----
        foreach (var a in walksOrdered)
        {
            if (a.TotalElevationGain >= 500)  Award(BadgeType.HikingElevation500,  a.Id, a.StartDate);
            if (a.TotalElevationGain >= 1000) Award(BadgeType.HikingElevation1000, a.Id, a.StartDate);
        }

        if (newBadges.Count > 0)
        {
            _db.UserBadges.AddRange(newBadges);
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Awarded {Count} new badges to user {UserId}", newBadges.Count, userId);
        }
    }
}
