using System.Globalization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Statistics.DTOs;
using RunTracker.Application.Statistics;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Statistics.Queries;

// --- GetYearlyStats ---
public record GetYearlyStatsQuery(string UserId, int Year, SportType? SportType = null, List<Guid>? TagIds = null) : IRequest<YearlyStatsDto>;

public class GetYearlyStatsQueryHandler : IRequestHandler<GetYearlyStatsQuery, YearlyStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetYearlyStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<YearlyStatsDto> Handle(GetYearlyStatsQuery request, CancellationToken ct)
    {
        var q = _db.Activities.Where(a => a.UserId == request.UserId && a.StartDate.Year == request.Year);
        if (request.SportType.HasValue) q = q.Where(a => a.SportType == request.SportType.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            q = q.Where(a => a.ActivityTags.Any(t => request.TagIds.Contains(t.TagId)));
        var activities = await q.ToListAsync(ct);

        var totalDistance = activities.Sum(a => a.Distance);
        var totalRuns = activities.Count;
        var totalTime = activities.Sum(a => a.MovingTime);
        var totalElevation = activities.Sum(a => a.TotalElevationGain);
        var longestRun = activities.Any() ? activities.Max(a => a.Distance) : 0;
        var avgPace = totalDistance > 0 ? (totalTime / 60.0) / (totalDistance / 1000.0) : 0;

        var monthly = Enumerable.Range(1, 12).Select(m =>
        {
            var monthActivities = activities.Where(a => a.StartDate.Month == m).ToList();
            var dist = monthActivities.Sum(a => a.Distance);
            var time = monthActivities.Sum(a => a.MovingTime);
            return new MonthlyBreakdownDto(
                m,
                CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(m),
                dist,
                monthActivities.Count,
                time,
                dist > 0 ? (time / 60.0) / (dist / 1000.0) : 0
            );
        }).ToList();

        return new YearlyStatsDto(request.Year, totalDistance, totalRuns, totalTime, avgPace, totalElevation, longestRun, monthly);
    }
}

// --- GetWeeklyStats ---
public record GetWeeklyStatsQuery(string UserId, int Year, SportType? SportType = null, List<Guid>? TagIds = null) : IRequest<WeeklyStatsDto>;

public class GetWeeklyStatsQueryHandler : IRequestHandler<GetWeeklyStatsQuery, WeeklyStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetWeeklyStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<WeeklyStatsDto> Handle(GetWeeklyStatsQuery request, CancellationToken ct)
    {
        var startOfYear = new DateTime(request.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endOfYear = new DateTime(request.Year, 12, 31, 23, 59, 59, DateTimeKind.Utc);

        var q = _db.Activities.Where(a => a.UserId == request.UserId && a.StartDate >= startOfYear && a.StartDate <= endOfYear);
        if (request.SportType.HasValue) q = q.Where(a => a.SportType == request.SportType.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            q = q.Where(a => a.ActivityTags.Any(t => request.TagIds.Contains(t.TagId)));
        var activities = await q.ToListAsync(ct);

        var weeks = activities
            .GroupBy(a => CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(a.StartDate, CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday))
            .Select(g =>
            {
                var dist = g.Sum(a => a.Distance);
                var time = g.Sum(a => a.MovingTime);
                var weekStart = ISOWeek.ToDateTime(request.Year, g.Key, DayOfWeek.Monday);
                return new WeekBreakdownDto(
                    g.Key,
                    weekStart,
                    dist,
                    g.Count(),
                    time,
                    dist > 0 ? (time / 60.0) / (dist / 1000.0) : 0
                );
            })
            .OrderBy(w => w.WeekNumber)
            .ToList();

        return new WeeklyStatsDto(request.Year, weeks);
    }
}

// --- GetAllTimeStats ---
public record GetAllTimeStatsQuery(string UserId, SportType? SportType = null, List<Guid>? TagIds = null) : IRequest<AllTimeStatsDto>;

public class GetAllTimeStatsQueryHandler : IRequestHandler<GetAllTimeStatsQuery, AllTimeStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetAllTimeStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<AllTimeStatsDto> Handle(GetAllTimeStatsQuery request, CancellationToken ct)
    {
        var q = _db.Activities.Where(a => a.UserId == request.UserId);
        if (request.SportType.HasValue) q = q.Where(a => a.SportType == request.SportType.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            q = q.Where(a => a.ActivityTags.Any(t => request.TagIds.Contains(t.TagId)));
        var activities = await q.ToListAsync(ct);

        var totalDistance = activities.Sum(a => a.Distance);
        var totalRuns = activities.Count;
        var totalTime = activities.Sum(a => a.MovingTime);
        var totalElevation = activities.Sum(a => a.TotalElevationGain);
        var longestRun = activities.Any() ? activities.Max(a => a.Distance) : 0;
        var avgPace = totalDistance > 0 ? (totalTime / 60.0) / (totalDistance / 1000.0) : 0;
        var firstRun = activities.Any() ? activities.Min(a => a.StartDate) : (DateTime?)null;
        var lastRun = activities.Any() ? activities.Max(a => a.StartDate) : (DateTime?)null;

        var prs = await _db.PersonalRecords
            .Where(pr => pr.UserId == request.UserId)
            .OrderBy(pr => pr.RecordType)
            .Select(pr => new PersonalRecordDto(
                pr.RecordType, pr.Value, pr.ActivityId, pr.AchievedAt,
                FormatPrValue(pr.RecordType, pr.Value)
            ))
            .ToListAsync(ct);

        // Best year by total distance
        var byYear = activities
            .GroupBy(a => a.StartDate.Year)
            .Select(g => (Year: g.Key, Distance: g.Sum(a => a.Distance)))
            .OrderByDescending(x => x.Distance)
            .FirstOrDefault();

        // Best month by total distance (across all years)
        var byMonth = activities
            .GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
            .Select(g => (Year: g.Key.Year, Month: g.Key.Month, Distance: g.Sum(a => a.Distance)))
            .OrderByDescending(x => x.Distance)
            .FirstOrDefault();

        string? bestMonthLabel = byMonth == default ? null
            : $"{CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(byMonth.Month)} {byMonth.Year}";

        // ── Streak computation ────────────────────────────────────────────────
        var dates = activities.Select(a => a.StartDate.Date).Distinct().OrderBy(d => d).ToList();
        var dateSet = new HashSet<DateTime>(dates);

        // Longest consecutive day streak
        int longestDay = 0, dayRun = 0;
        for (int i = 0; i < dates.Count; i++)
        {
            dayRun = (i > 0 && dates[i] == dates[i - 1].AddDays(1)) ? dayRun + 1 : 1;
            if (dayRun > longestDay) longestDay = dayRun;
        }

        // Current day streak (today counts; if today has no activity, yesterday still starts it)
        int currentDay = 0;
        var today = DateTime.UtcNow.Date;
        var dayCursor = dateSet.Contains(today) ? today : today.AddDays(-1);
        while (dateSet.Contains(dayCursor)) { currentDay++; dayCursor = dayCursor.AddDays(-1); }

        // ISO week helper: returns (year, weekNumber) per ISO 8601
        static (int y, int w) IsoWeek(DateTime dt)
        {
            var d = dt.Date.AddDays(4 - ((int)dt.DayOfWeek == 0 ? 7 : (int)dt.DayOfWeek));
            int wk = (int)Math.Ceiling((d - new DateTime(d.Year, 1, 1)).TotalDays / 7.0) + 1;
            return (d.Year, wk);
        }
        static bool IsConsecutiveWeek((int y, int w) a, (int y, int w) b) =>
            (b.y == a.y && b.w == a.w + 1) || (b.y == a.y + 1 && b.w == 1 && a.w >= 52);

        var weekTuples = dates.Select(IsoWeek).Distinct().OrderBy(t => t).ToList();
        int longestWeek = 0, weekRun = 0;
        for (int i = 0; i < weekTuples.Count; i++)
        {
            weekRun = (i > 0 && IsConsecutiveWeek(weekTuples[i - 1], weekTuples[i])) ? weekRun + 1 : 1;
            if (weekRun > longestWeek) longestWeek = weekRun;
        }

        var weekSet = new HashSet<(int, int)>(weekTuples);
        int currentWeek = 0;
        var wCursor = DateTime.UtcNow;
        while (weekSet.Contains(IsoWeek(wCursor))) { currentWeek++; wCursor = wCursor.AddDays(-7); }

        return new AllTimeStatsDto(
            totalDistance, totalRuns, totalTime, avgPace, totalElevation, longestRun,
            firstRun, lastRun, prs,
            byYear == default ? null : byYear.Year, byYear == default ? 0 : byYear.Distance,
            bestMonthLabel, byMonth == default ? 0 : byMonth.Distance,
            currentDay, longestDay, currentWeek, longestWeek
        );
    }

    private static string FormatPrValue(RecordType type, double value) => type switch
    {
        RecordType.LongestRun      => $"{value / 1000.0:F2} km",
        RecordType.LongestRide     => $"{value / 1000.0:F2} km",
        RecordType.LongestRunTime  => TimeSpan.FromSeconds(value).ToString(@"h\:mm\:ss"),
        RecordType.LongestSwim     => value >= 1000 ? $"{value / 1000.0:F2} km" : $"{value:F0} m",
        RecordType.MostElevation   => $"{value:F0} m",
        RecordType.BestRunCadence  => $"{value:F0} spm",
        RecordType.BestRideCadence => $"{value:F0} rpm",
        _                          => value >= 3600
                                       ? TimeSpan.FromSeconds(value).ToString(@"h\:mm\:ss\.f")
                                       : TimeSpan.FromSeconds(value).ToString(@"m\:ss\.f"),
    };
}

// --- GetPaceTrend ---
public record GetPaceTrendQuery(string UserId, string Period = "monthly", SportType? SportType = null, List<Guid>? TagIds = null, int? Year = null) : IRequest<PaceTrendDto>;

public class GetPaceTrendQueryHandler : IRequestHandler<GetPaceTrendQuery, PaceTrendDto>
{
    private readonly IApplicationDbContext _db;
    public GetPaceTrendQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PaceTrendDto> Handle(GetPaceTrendQuery request, CancellationToken ct)
    {
        var q = _db.Activities
            .Where(a => a.UserId == request.UserId && a.Distance > 0 && a.MovingTime > 0);
        if (request.Year.HasValue && request.Year.Value > 0) q = q.Where(a => a.StartDate.Year == request.Year.Value);
        if (request.SportType.HasValue) q = q.Where(a => a.SportType == request.SportType.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            q = q.Where(a => a.ActivityTags.Any(t => request.TagIds.Contains(t.TagId)));
        var activities = await q.OrderBy(a => a.StartDate).ToListAsync(ct);

        List<PaceTrendPointDto> points;

        if (request.Period == "weekly")
        {
            points = activities
                .GroupBy(a => new { a.StartDate.Year, Week = CultureInfo.InvariantCulture.Calendar.GetWeekOfYear(a.StartDate, CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday) })
                .Select(g =>
                {
                    var dist = g.Sum(a => a.Distance);
                    var time = g.Sum(a => a.MovingTime);
                    var weekStart = ISOWeek.ToDateTime(g.Key.Year, g.Key.Week, DayOfWeek.Monday);
                    return new PaceTrendPointDto(weekStart, $"W{g.Key.Week} {g.Key.Year}", (time / 60.0) / (dist / 1000.0), g.Count());
                })
                .ToList();
        }
        else
        {
            points = activities
                .GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
                .Select(g =>
                {
                    var dist = g.Sum(a => a.Distance);
                    var time = g.Sum(a => a.MovingTime);
                    return new PaceTrendPointDto(
                        new DateTime(g.Key.Year, g.Key.Month, 1),
                        $"{CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(g.Key.Month)} {g.Key.Year}",
                        (time / 60.0) / (dist / 1000.0),
                        g.Count()
                    );
                })
                .ToList();
        }

        return new PaceTrendDto(points);
    }
}

// --- GetPersonalRecords ---
public record GetPersonalRecordsQuery(string UserId, int? Year = null) : IRequest<List<PersonalRecordDto>>;

public class GetPersonalRecordsQueryHandler : IRequestHandler<GetPersonalRecordsQuery, List<PersonalRecordDto>>
{
    private readonly IApplicationDbContext _db;
    public GetPersonalRecordsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<PersonalRecordDto>> Handle(GetPersonalRecordsQuery request, CancellationToken ct)
    {
        var query = _db.PersonalRecords.Where(pr => pr.UserId == request.UserId);
        if (request.Year.HasValue)
            query = query.Where(pr => pr.AchievedAt.Year == request.Year.Value);

        var records = await query
            .OrderBy(pr => pr.RecordType)
            .ToListAsync(ct);

        return records.Select(pr => new PersonalRecordDto(
            pr.RecordType, pr.Value, pr.ActivityId, pr.AchievedAt,
            FormatValue(pr.RecordType, pr.Value)
        )).ToList();
    }

    private static string FormatValue(RecordType type, double value) => type switch
    {
        RecordType.LongestRun      => $"{value / 1000.0:F2} km",
        RecordType.LongestRide     => $"{value / 1000.0:F2} km",
        RecordType.LongestRunTime  => TimeSpan.FromSeconds(value).ToString(@"h\:mm\:ss"),
        RecordType.LongestSwim     => value >= 1000 ? $"{value / 1000.0:F2} km" : $"{value:F0} m",
        RecordType.MostElevation   => $"{value:F0} m",
        RecordType.BestRunCadence  => $"{value:F0} spm",
        RecordType.BestRideCadence => $"{value:F0} rpm",
        _                          => value >= 3600
                                       ? TimeSpan.FromSeconds(value).ToString(@"h\:mm\:ss\.f")
                                       : TimeSpan.FromSeconds(value).ToString(@"m\:ss\.f"),
    };
}

// --- GetMultiYearStats ---
public record GetMultiYearStatsQuery(string UserId, SportType? SportType = null, List<Guid>? TagIds = null) : IRequest<List<MultiYearDto>>;

public class GetMultiYearStatsQueryHandler : IRequestHandler<GetMultiYearStatsQuery, List<MultiYearDto>>
{
    private readonly IApplicationDbContext _db;
    public GetMultiYearStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<MultiYearDto>> Handle(GetMultiYearStatsQuery request, CancellationToken ct)
    {
        var q = _db.Activities.Where(a => a.UserId == request.UserId);
        if (request.SportType.HasValue) q = q.Where(a => a.SportType == request.SportType.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            q = q.Where(a => a.ActivityTags.Any(t => request.TagIds.Contains(t.TagId)));
        var activities = await q.Select(a => new { a.Distance, a.StartDate }).ToListAsync(ct);

        return activities
            .GroupBy(a => a.StartDate.Year)
            .Select(yg => new MultiYearDto(
                yg.Key,
                yg.Sum(a => a.Distance),
                yg.Count(),
                Enumerable.Range(1, 12).Select(m =>
                {
                    var mg = yg.Where(a => a.StartDate.Month == m).ToList();
                    return new MultiYearMonthDto(m, mg.Sum(a => a.Distance), mg.Count);
                }).ToList()
            ))
            .OrderBy(y => y.Year)
            .ToList();
    }
}

// --- GetRunningPercentile ---
public record GetRunningPercentileQuery(string UserId, bool IsMale, int Age) : IRequest<RunningLevelDto>;

public class GetRunningPercentileQueryHandler : IRequestHandler<GetRunningPercentileQuery, RunningLevelDto>
{
    private readonly IApplicationDbContext _db;
    public GetRunningPercentileQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<RunningLevelDto> Handle(GetRunningPercentileQuery request, CancellationToken ct)
    {
        var prs = await _db.PersonalRecords
            .Where(pr => pr.UserId == request.UserId)
            .ToListAsync(ct);

        var distanceDtos = new List<RunningLevelDistanceDto>();
        var distMap = new Dictionary<int, RecordType>
        {
            { 5000,  RecordType.Fastest5K },
            { 10000, RecordType.Fastest10K },
            { 21097, RecordType.FastestHalf },
            { 42195, RecordType.FastestMarathon },
        };

        for (int di = 0; di < RunningLevelStandards.Distances.Length; di++)
        {
            var distM = RunningLevelStandards.Distances[di];
            var label = RunningLevelStandards.DistanceLabels[di];

            var userPr = distMap.TryGetValue(distM, out var rt)
                ? prs.FirstOrDefault(p => p.RecordType == rt)
                : null;

            var standards = RunningLevelStandards.LevelNames.Select((lvl, li) =>
            {
                var stdSec = RunningLevelStandards.GetStandardSeconds(request.IsMale, distM, request.Age, li);
                return new RunningLevelStandardDto(
                    lvl,
                    TimeSpan.FromSeconds(stdSec).ToString(stdSec >= 3600 ? @"h\:mm\:ss" : @"m\:ss"),
                    userPr is not null && userPr.Value <= stdSec
                );
            }).ToArray();

            distanceDtos.Add(new RunningLevelDistanceDto(
                label, distM,
                userPr is not null ? TimeSpan.FromSeconds(userPr.Value).ToString(userPr.Value >= 3600 ? @"h\:mm\:ss" : @"m\:ss\.f") : null,
                userPr?.Value,
                standards
            ));
        }

        return new RunningLevelDto(distanceDtos, $"Age {request.Age}", true);
    }
}

// --- GetExplorationStats ---
public record GetExplorationStatsQuery(string UserId) : IRequest<ExplorationStatsDto>;

public class GetExplorationStatsQueryHandler : IRequestHandler<GetExplorationStatsQuery, ExplorationStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetExplorationStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<ExplorationStatsDto> Handle(GetExplorationStatsQuery request, CancellationToken ct)
    {
        var cityProgress = await _db.UserCityProgress
            .Where(p => p.UserId == request.UserId)
            .Include(p => p.City)
            .ToListAsync(ct);

        var countriesCount = cityProgress.Select(p => p.City.Country).Distinct().Count();
        var citiesWithProgress = cityProgress.Count(p => p.CompletionPercentage > 0);
        var completedStreetsTotal = cityProgress.Sum(p => p.CompletedStreets);

        var explorerTiles = await _db.UserTiles.CountAsync(t => t.UserId == request.UserId, ct);

        var totalDistanceM = await _db.Activities
            .Where(a => a.UserId == request.UserId)
            .SumAsync(a => (double)a.Distance, ct);

        const double moonDistanceM = 384_400_000.0;
        const double earthCircumferenceM = 40_075_000.0;

        return new ExplorationStatsDto(
            countriesCount,
            citiesWithProgress,
            completedStreetsTotal,
            explorerTiles,
            totalDistanceM / moonDistanceM,
            totalDistanceM / earthCircumferenceM
        );
    }
}

// --- GetActivityDaySummary (for Eddington number) ---
public record GetActivityDaySummaryQuery(string UserId, SportType? SportTypeFilter = null) : IRequest<List<ActivityDaySummaryDto>>;

public class GetActivityDaySummaryQueryHandler : IRequestHandler<GetActivityDaySummaryQuery, List<ActivityDaySummaryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetActivityDaySummaryQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<ActivityDaySummaryDto>> Handle(GetActivityDaySummaryQuery request, CancellationToken ct)
    {
        var query = _db.Activities.Where(a => a.UserId == request.UserId);

        if (request.SportTypeFilter.HasValue)
            query = query.Where(a => a.SportType == request.SportTypeFilter.Value);

        var activities = await query
            .Select(a => new { a.Distance, a.StartDate })
            .ToListAsync(ct);

        return activities
            .GroupBy(a => a.StartDate.Date.ToString("yyyy-MM-dd"))
            .Select(g => new ActivityDaySummaryDto(g.Key, g.Sum(a => a.Distance / 1000.0)))
            .OrderBy(d => d.Date)
            .ToList();
    }
}

// --- GetRecentPredictions ---
public record GetRecentPredictionsQuery(string UserId, int Days, List<Guid>? TagIds = null, bool UseTagWeighting = false) : IRequest<RecentPredictionsDto>;

public class GetRecentPredictionsQueryHandler : IRequestHandler<GetRecentPredictionsQuery, RecentPredictionsDto>
{
    private readonly IApplicationDbContext _db;
    public GetRecentPredictionsQueryHandler(IApplicationDbContext db) => _db = db;

    // Distance definitions for prediction targets
    private static readonly (string Label, int Meters, RecordType? RecordType)[] TargetDistances =
    [
        ("5K",           5000,  RecordType.Fastest5K),
        ("10K",         10000,  RecordType.Fastest10K),
        ("Half Marathon",21097, RecordType.FastestHalf),
        ("Marathon",    42195,  RecordType.FastestMarathon),
    ];

    private static readonly (string Label, int Meters, RecordType RecordType)[] SourceDistances =
    [
        ("1K",           1000,  RecordType.Fastest1K),
        ("5K",           5000,  RecordType.Fastest5K),
        ("10K",         10000,  RecordType.Fastest10K),
        ("Half Marathon",21097, RecordType.FastestHalf),
        ("Marathon",    42195,  RecordType.FastestMarathon),
    ];

    private static double Riegel(double t1, double d1, double d2) => t1 * Math.Pow(d2 / d1, 1.06);

    private static string FormatTime(double seconds)
    {
        var ts = TimeSpan.FromSeconds(seconds);
        return ts.TotalHours >= 1
            ? ts.ToString(@"h\:mm\:ss")
            : ts.ToString(@"m\:ss");
    }

    private static string FormatPace(double seconds, int meters)
    {
        var secPerKm = seconds / (meters / 1000.0);
        var ts = TimeSpan.FromSeconds(secPerKm);
        return $"{(int)ts.TotalMinutes}:{ts.Seconds:D2} /km";
    }

    /// <summary>
    /// Tag-based weight for race predictor. Lower is "better" (faster baseline).
    /// Tempo/Intervals tags are higher-quality indicators of race fitness.
    /// </summary>
    private static double GetTagWeight(IEnumerable<string> tagNames)
    {
        var names = tagNames.Select(n => n.ToLowerInvariant()).ToList();
        if (names.Any(n => n is "tempo" or "interval" or "intervals" or "race" or "threshold"))
            return 0.97;
        if (names.Any(n => n is "easy" or "recovery" or "base"))
            return 1.03;
        return 1.0;
    }

    public async Task<RecentPredictionsDto> Handle(GetRecentPredictionsQuery request, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-request.Days);

        // Find best PR achieved within the period
        var prQuery = _db.PersonalRecords
            .Where(pr => pr.UserId == request.UserId && pr.AchievedAt >= since);

        // When tag filter is specified, also join to Activity→ActivityTags to filter by tag
        List<RunTracker.Domain.Entities.PersonalRecord> recentPrs;
        if (request.TagIds != null && request.TagIds.Count > 0)
        {
            var taggedActivityIds = await _db.ActivityTags
                .Where(at => request.TagIds.Contains(at.TagId))
                .Select(at => at.ActivityId)
                .ToListAsync(ct);
            recentPrs = await prQuery
                .Where(pr => taggedActivityIds.Contains(pr.ActivityId))
                .ToListAsync(ct);
        }
        else
        {
            recentPrs = await prQuery.ToListAsync(ct);
        }

        // Load tag names for each PR's activity when weighting is requested
        Dictionary<Guid, List<string>> activityTagNames = new();
        if (request.UseTagWeighting && recentPrs.Count > 0)
        {
            var activityIds = recentPrs.Select(p => p.ActivityId).Distinct().ToList();
            var tagData = await _db.ActivityTags
                .Where(at => activityIds.Contains(at.ActivityId))
                .Select(at => new { at.ActivityId, at.Tag.Name })
                .ToListAsync(ct);
            activityTagNames = tagData
                .GroupBy(x => x.ActivityId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.Name).ToList());
        }

        // Pick the source with best effective pace (considering tag weighting)
        RunTracker.Domain.Entities.PersonalRecord? bestPr = null;
        (string Label, int Meters, RecordType RecordType)? bestSrc = null;
        double bestEffectivePace = double.MaxValue;

        foreach (var src in SourceDistances)
        {
            var pr = recentPrs.FirstOrDefault(p => p.RecordType == src.RecordType);
            if (pr is null) continue;
            var actualPace = pr.Value / (src.Meters / 1000.0);
            var weight = request.UseTagWeighting && activityTagNames.TryGetValue(pr.ActivityId, out var names)
                ? GetTagWeight(names)
                : 1.0;
            var effectivePace = actualPace * weight;
            if (effectivePace < bestEffectivePace)
            {
                bestEffectivePace = effectivePace;
                bestPr = pr;
                bestSrc = src;
            }
        }

        if (bestPr is null || bestSrc is null)
            return new RecentPredictionsDto(request.Days, null, []);

        var basedOn = new RecentBasePrDto(bestSrc.Value.Label, bestPr.Value, FormatTime(bestPr.Value), bestPr.AchievedAt);

        var predictions = TargetDistances.Select(t =>
        {
            var predicted = Riegel(bestPr.Value, bestSrc.Value.Meters, t.Meters);
            return new RecentPredictedTimeDto(t.Label, t.Meters, predicted, FormatTime(predicted), FormatPace(predicted, t.Meters));
        }).ToList();

        return new RecentPredictionsDto(request.Days, basedOn, predictions);
    }
}

// --- GetYearInfographic ---
public record GetYearInfographicQuery(string UserId, int Year, string DisplayName, string? Username, string? ProfilePictureUrl)
    : IRequest<YearInfographicDto>;

public class GetYearInfographicQueryHandler : IRequestHandler<GetYearInfographicQuery, YearInfographicDto>
{
    private readonly IApplicationDbContext _db;
    public GetYearInfographicQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<YearInfographicDto> Handle(GetYearInfographicQuery request, CancellationToken ct)
    {
        var activities = await _db.Activities
            .Where(a => a.UserId == request.UserId && a.StartDate.Year == request.Year)
            .OrderBy(a => a.StartDate)
            .ToListAsync(ct);

        // Basic totals
        var totalDistanceM = activities.Sum(a => a.Distance);
        var totalHoursSec = activities.Sum(a => a.MovingTime);
        var totalElevationM = activities.Sum(a => a.TotalElevationGain);
        const double EverestM = 8848.86;

        // Active days & streaks
        var activeDateStrings = activities
            .Select(a => a.StartDate.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();
        var activeDays = activeDateStrings.Count;

        int maxStreak = 0, currentStreak = 0;
        for (int i = 0; i < activeDateStrings.Count; i++)
        {
            if (i == 0 || (activeDateStrings[i] - activeDateStrings[i - 1]).TotalDays != 1)
                currentStreak = 1;
            else
                currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        }

        // Per-type maxes
        var runs = activities.Where(a => a.SportType == SportType.Run || a.SportType == SportType.TrailRun || a.SportType == SportType.VirtualRun).ToList();
        var rides = activities.Where(a => a.SportType == SportType.Ride).ToList();
        var swims = activities.Where(a => a.SportType == SportType.Swim).ToList();
        var walks = activities.Where(a => a.SportType == SportType.Walk || a.SportType == SportType.Hike).ToList();

        // Daily summaries — one entry per day per sport type
        var dailySummaries = activities
            .GroupBy(a => (Date: a.StartDate.Date.ToString("yyyy-MM-dd"), SportType: (int)a.SportType))
            .Select(g => new DailyActivitySummaryDto(g.Key.Date, g.Key.SportType, g.Sum(a => a.Distance) / 1000.0))
            .OrderBy(d => d.Date)
            .ToList();

        // Monthly by sport type
        var monthlyBySport = activities
            .GroupBy(a => (Month: a.StartDate.Month, SportType: (int)a.SportType))
            .Select(g => new MonthlyBySportTypeDto(g.Key.Month, g.Key.SportType, g.Sum(a => a.Distance) / 1000.0))
            .ToList();

        return new YearInfographicDto(
            Year: request.Year,
            DisplayName: request.DisplayName,
            Username: request.Username,
            ProfilePictureUrl: request.ProfilePictureUrl,
            TotalDistanceKm: totalDistanceM / 1000.0,
            ActiveDays: activeDays,
            MaxStreakDays: maxStreak,
            TotalHours: totalHoursSec / 3600.0,
            TotalElevationM: totalElevationM,
            EverestMultiple: totalElevationM / EverestM,
            MaxRunDistance: runs.Any() ? runs.Max(a => a.Distance) / 1000.0 : 0,
            MaxRideDistance: rides.Any() ? rides.Max(a => a.Distance) / 1000.0 : 0,
            MaxRideElevation: rides.Any() ? rides.Max(a => a.TotalElevationGain) : 0,
            MaxSwimDistance: swims.Any() ? swims.Max(a => a.Distance) / 1000.0 : 0,
            MaxSwimTimeSec: swims.Any() ? swims.Max(a => a.MovingTime) : 0,
            MaxWalkDistance: walks.Any() ? walks.Max(a => a.Distance) / 1000.0 : 0,
            DailyActivitySummaries: dailySummaries,
            MonthlyBreakdownBySportType: monthlyBySport
        );
    }
}

// --- GetTimeOfDayStats ---
public record GetTimeOfDayStatsQuery(string UserId, int? SportType = null) : IRequest<TimeOfDayStatsDto>;

public class GetTimeOfDayStatsQueryHandler : IRequestHandler<GetTimeOfDayStatsQuery, TimeOfDayStatsDto>
{
    private readonly IApplicationDbContext _db;
    public GetTimeOfDayStatsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<TimeOfDayStatsDto> Handle(GetTimeOfDayStatsQuery request, CancellationToken ct)
    {
        var q = _db.Activities.Where(a => a.UserId == request.UserId);
        if (request.SportType.HasValue) q = q.Where(a => (int)a.SportType == request.SportType.Value);
        var activities = await q.ToListAsync(ct);

        static string HourLabel(int h) => h == 0 ? "12am" : h < 12 ? $"{h}am" : h == 12 ? "12pm" : $"{h - 12}pm";
        string[] DayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        // Remap DayOfWeek: Sunday=0 → index 6, Monday=1 → 0, …
        static int DowIndex(DayOfWeek d) => d == DayOfWeek.Sunday ? 6 : (int)d - 1;

        var byHour = Enumerable.Range(0, 24).Select(h =>
        {
            var group = activities.Where(a => a.StartDate.Hour == h).ToList();
            var paced = group.Where(a => a.Distance > 0 && a.MovingTime > 0).ToList();
            var avgPace = paced.Count > 0 ? paced.Average(a => (a.MovingTime / 60.0) / (a.Distance / 1000.0)) : 0;
            var avgDist = group.Count > 0 ? group.Average(a => a.Distance) : 0;
            return new HourBucketDto(h, HourLabel(h), group.Count, avgPace, avgDist);
        }).ToList();

        var byDow = Enumerable.Range(0, 7).Select(i =>
        {
            var group = activities.Where(a => DowIndex(a.StartDate.DayOfWeek) == i).ToList();
            var paced = group.Where(a => a.Distance > 0 && a.MovingTime > 0).ToList();
            var avgPace = paced.Count > 0 ? paced.Average(a => (a.MovingTime / 60.0) / (a.Distance / 1000.0)) : 0;
            var avgDist = group.Count > 0 ? group.Average(a => a.Distance) : 0;
            return new DayOfWeekBucketDto(i, DayNames[i], group.Count, avgPace, avgDist);
        }).ToList();

        return new TimeOfDayStatsDto(byHour, byDow);
    }
}

// --- GetTrainingLoad ---
public record GetTrainingLoadQuery(string UserId, int? SportType = null) : IRequest<TrainingLoadDto>;

public class GetTrainingLoadQueryHandler : IRequestHandler<GetTrainingLoadQuery, TrainingLoadDto>
{
    private readonly IApplicationDbContext _db;

    public GetTrainingLoadQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<TrainingLoadDto> Handle(GetTrainingLoadQuery request, CancellationToken ct)
    {
        var query = _db.Activities.Where(a => a.UserId == request.UserId);
        if (request.SportType.HasValue)
            query = query.Where(a => (int)a.SportType == request.SportType.Value);

        // Load activities from the last 365 + 42 days (need 42-day window before range)
        var since = DateTime.UtcNow.AddDays(-(365 + 42));
        var activities = await query
            .Where(a => a.StartDate >= since)
            .Select(a => new { a.StartDate, a.Distance, a.MovingTime, a.AverageHeartRate })
            .OrderBy(a => a.StartDate)
            .ToListAsync(ct);

        // Build a daily load map (date → TRIMP-like load score)
        // Simplified load: if HR data available use TRIMP (HR_norm * duration_min), else distance-based
        var dailyLoad = new Dictionary<DateTime, double>();
        foreach (var a in activities)
        {
            var date = a.StartDate.Date;
            double load;
            if (a.AverageHeartRate.HasValue && a.MovingTime > 0)
            {
                // Simplified TRIMP: (HR/180) * duration_min
                load = (a.AverageHeartRate.Value / 180.0) * (a.MovingTime / 60.0);
            }
            else if (a.Distance > 0)
            {
                // Distance-based load: 1 point per km (cap at 50 to avoid skewing)
                load = Math.Min(a.Distance / 1000.0, 50.0);
            }
            else
            {
                load = 10.0; // flat 10 for activities without data
            }

            dailyLoad[date] = dailyLoad.GetValueOrDefault(date, 0) + load;
        }

        // Calculate CTL/ATL/TSB with EMA
        const double ctlDecay = 1.0 / 42.0;
        const double atlDecay = 1.0 / 7.0;

        var startDate = DateTime.UtcNow.Date.AddDays(-365);
        var endDate = DateTime.UtcNow.Date;
        var points = new List<TrainingLoadPointDto>();

        double ctl = 0, atl = 0;
        for (var d = startDate; d <= endDate; d = d.AddDays(1))
        {
            var load = dailyLoad.GetValueOrDefault(d, 0);
            ctl = ctl + ctlDecay * (load - ctl);
            atl = atl + atlDecay * (load - atl);
            var tsb = ctl - atl;

            // Only include in output every 7 days (or last 90 days daily) to keep payload small
            var daysAgo = (endDate - d).TotalDays;
            if (d.DayOfWeek == DayOfWeek.Monday || daysAgo <= 90)
            {
                points.Add(new TrainingLoadPointDto(
                    d.ToString("yyyy-MM-dd"),
                    Math.Round(ctl, 1),
                    Math.Round(atl, 1),
                    Math.Round(tsb, 1),
                    Math.Round(load, 1)
                ));
            }
        }

        return new TrainingLoadDto(points, Math.Round(ctl, 1), Math.Round(atl, 1), Math.Round(ctl - atl, 1));
    }
}

// --- GetVo2maxQuery ---
public record GetVo2maxQuery(string UserId) : IRequest<Vo2maxDto>;

public class GetVo2maxQueryHandler : IRequestHandler<GetVo2maxQuery, Vo2maxDto>
{
    private readonly IApplicationDbContext _db;
    public GetVo2maxQueryHandler(IApplicationDbContext db) => _db = db;

    // Distance in meters for each PR record type (sprint/LongestRun excluded)
    private static readonly Dictionary<RecordType, int> PrDistances = new()
    {
        [RecordType.Fastest1K]       = 1000,
        [RecordType.Fastest3K]       = 3000,
        [RecordType.Fastest5K]       = 5000,
        [RecordType.Fastest10K]      = 10000,
        [RecordType.Fastest15K]      = 15000,
        [RecordType.Fastest30K]      = 30000,
        [RecordType.FastestHalf]     = 21097,
        [RecordType.FastestMarathon] = 42195,
    };

    /// <summary>Jack Daniels' VDOT formula.</summary>
    private static double CalcVdot(double distanceMeters, double timeSecs)
    {
        var t = timeSecs / 60.0;           // minutes
        var v = distanceMeters / t;        // m/min
        var pct = 0.8 + 0.1894393 * Math.Exp(-0.012778 * t) + 0.2989558 * Math.Exp(-0.1932605 * t);
        var vo2AtV = -4.60 + 0.182258 * v + 0.000104 * v * v;
        return vo2AtV / pct;
    }

    private static string GetLevel(double v) => v switch
    {
        >= 60 => "Elite",
        >= 55 => "Sub-Elite",
        >= 50 => "Advanced",
        >= 45 => "Intermediate",
        >= 40 => "Novice",
        _     => "Beginner",
    };

    private static string GetClassification(double v) => v switch
    {
        >= 60 => "Superior",
        >= 55 => "Excellent",
        >= 50 => "Good",
        >= 45 => "Fair",
        _     => "Poor",
    };

    public async Task<Vo2maxDto> Handle(GetVo2maxQuery request, CancellationToken ct)
    {
        // Best VO2max from PRs
        var prs = await _db.PersonalRecords
            .Where(r => r.UserId == request.UserId)
            .ToListAsync(ct);

        double? bestVo2max = null;
        string? basedOn = null;
        foreach (var pr in prs)
        {
            if (!PrDistances.TryGetValue(pr.RecordType, out var dist)) continue;
            if (pr.Value <= 0) continue;
            var v = CalcVdot(dist, pr.Value);
            if (v > (bestVo2max ?? 0))
            {
                bestVo2max = v;
                basedOn = pr.RecordType switch
                {
                    RecordType.Fastest1K       => "1K PR",
                    RecordType.Fastest3K       => "3K PR",
                    RecordType.Fastest5K       => "5K PR",
                    RecordType.Fastest10K      => "10K PR",
                    RecordType.Fastest15K      => "15K PR",
                    RecordType.Fastest30K      => "30K PR",
                    RecordType.FastestHalf     => "Half Marathon PR",
                    RecordType.FastestMarathon => "Marathon PR",
                    _                          => null,
                };
            }
        }

        // Trend: for each month in the past 12 months, find the best VO2max estimate
        // from running activities >= 3km (using actual pace as a proxy — lower bound since training pace)
        var twelveMonthsAgo = DateTime.UtcNow.AddMonths(-12);
        var recentRuns = await _db.Activities
            .Where(a => a.UserId == request.UserId
                && a.SportType == SportType.Run
                && a.StartDate >= twelveMonthsAgo
                && a.Distance >= 3000
                && a.MovingTime > 0)
            .Select(a => new { a.StartDate, a.Distance, a.MovingTime })
            .ToListAsync(ct);

        var trend = recentRuns
            .GroupBy(a => new { a.StartDate.Year, a.StartDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g =>
            {
                var monthLabel = $"{g.Key.Year}-{g.Key.Month:D2}";
                var best = g.Max(a => CalcVdot(a.Distance, a.MovingTime));
                return new Vo2maxTrendPointDto(monthLabel, Math.Round(best, 1));
            })
            .ToList();

        var rounded = bestVo2max.HasValue ? Math.Round(bestVo2max.Value, 1) : (double?)null;
        var level = rounded.HasValue ? GetLevel(rounded.Value) : "Unknown";
        var classification = rounded.HasValue ? GetClassification(rounded.Value) : "No data";

        return new Vo2maxDto(rounded, basedOn, level, classification, trend);
    }
}


// --- GetVo2maxSnapshotsQuery ---
public record GetVo2maxSnapshotsQuery(string UserId) : IRequest<List<Vo2maxSnapshotDto>>;

public class GetVo2maxSnapshotsQueryHandler : IRequestHandler<GetVo2maxSnapshotsQuery, List<Vo2maxSnapshotDto>>
{
    private readonly IApplicationDbContext _db;
    public GetVo2maxSnapshotsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<Vo2maxSnapshotDto>> Handle(GetVo2maxSnapshotsQuery request, CancellationToken ct)
    {
        return await _db.Vo2maxSnapshots
            .Where(s => s.UserId == request.UserId)
            .OrderBy(s => s.Date)
            .Select(s => new Vo2maxSnapshotDto(s.Date.ToString("yyyy-MM-dd"), s.Value))
            .ToListAsync(ct);
    }
}
