using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Activities.DTOs;
using RunTracker.Application.Common;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Common.Models;
using RunTracker.Application.Tags;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Activities.Queries;

// --- GetActivityList ---
public record GetActivityListQuery(
    string UserId,
    int Page = 1,
    int PageSize = 20,
    SportType? SportType = null,
    DateTime? From = null,
    DateTime? To = null,
    List<Guid>? TagIds = null,
    string? SortBy = null,
    bool SortDescending = true,
    List<SportType>? HiddenSportTypes = null,
    string? Search = null
) : IRequest<PaginatedList<ActivitySummaryDto>>;

public class GetActivityListQueryHandler : IRequestHandler<GetActivityListQuery, PaginatedList<ActivitySummaryDto>>
{
    private readonly IApplicationDbContext _db;

    public GetActivityListQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PaginatedList<ActivitySummaryDto>> Handle(GetActivityListQuery request, CancellationToken ct)
    {
        var query = _db.Activities
            .Where(a => a.UserId == request.UserId)
            .AsQueryable();

        if (request.SportType.HasValue)
            query = query.Where(a => a.SportType == request.SportType.Value);
        else if (request.HiddenSportTypes != null && request.HiddenSportTypes.Count > 0)
            query = query.Where(a => !request.HiddenSportTypes.Contains(a.SportType));
        if (request.From.HasValue)
            query = query.Where(a => a.StartDate >= request.From.Value);
        if (request.To.HasValue)
            query = query.Where(a => a.StartDate <= request.To.Value);
        if (request.TagIds != null && request.TagIds.Count > 0)
            query = query.Where(a => a.ActivityTags.Any(at => request.TagIds.Contains(at.TagId)));
        if (!string.IsNullOrWhiteSpace(request.Search))
            query = query.Where(a => a.Name.Contains(request.Search));

        var totalCount = await query.CountAsync(ct);

        IQueryable<RunTracker.Domain.Entities.Activity> sorted = request.SortBy?.ToLower() switch
        {
            "distance"  => request.SortDescending ? query.OrderByDescending(a => a.Distance)         : query.OrderBy(a => a.Distance),
            "duration"  => request.SortDescending ? query.OrderByDescending(a => a.MovingTime)       : query.OrderBy(a => a.MovingTime),
            "elevation" => request.SortDescending ? query.OrderByDescending(a => a.TotalElevationGain) : query.OrderBy(a => a.TotalElevationGain),
            _           => request.SortDescending ? query.OrderByDescending(a => a.StartDate)        : query.OrderBy(a => a.StartDate),
        };

        var items = await sorted
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(a => new ActivitySummaryDto(
                a.Id, a.Name, a.SportType, a.StartDate,
                a.Distance, a.MovingTime, a.ElapsedTime,
                a.TotalElevationGain, a.AverageSpeed, a.MaxSpeed,
                a.AverageHeartRate, a.MaxHeartRate, a.AverageCadence,
                a.Calories, a.SummaryPolyline,
                a.Distance > 0 && a.MovingTime > 0
                    ? (a.MovingTime / 60.0) / (a.Distance / 1000.0)
                    : 0
            ))
            .ToListAsync(ct);

        return new PaginatedList<ActivitySummaryDto>(items, totalCount, request.Page, request.PageSize);
    }
}

// --- GetActivityDetail ---
public record GetActivityDetailQuery(string UserId, Guid ActivityId) : IRequest<ActivityDetailDto?>;

public class GetActivityDetailQueryHandler : IRequestHandler<GetActivityDetailQuery, ActivityDetailDto?>
{
    private readonly IApplicationDbContext _db;

    public GetActivityDetailQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<ActivityDetailDto?> Handle(GetActivityDetailQuery request, CancellationToken ct)
    {
        var activity = await _db.Activities
            .Where(a => a.Id == request.ActivityId && a.UserId == request.UserId)
            .FirstOrDefaultAsync(ct);

        if (activity is null) return null;

        var streams = await _db.ActivityStreams
            .Where(s => s.ActivityId == activity.Id)
            .OrderBy(s => s.PointIndex)
            .Select(s => new ActivityStreamPointDto(
                s.PointIndex, s.Latitude, s.Longitude, s.Altitude,
                s.Time, s.Distance, s.HeartRate, s.Speed, s.Cadence
            ))
            .ToListAsync(ct);

        var tags = await _db.ActivityTags
            .Where(at => at.ActivityId == activity.Id && at.Tag.UserId == request.UserId)
            .Select(at => new TagDto(at.Tag.Id, at.Tag.Name, at.Tag.Color))
            .ToListAsync(ct);

        var newStreetsDiscovered = await _db.UserStreetNodes
            .CountAsync(n => n.UserId == request.UserId && n.ActivityId == activity.Id, ct);

        var pace = activity.Distance > 0 && activity.MovingTime > 0
            ? (activity.MovingTime / 60.0) / (activity.Distance / 1000.0)
            : 0;

        return new ActivityDetailDto(
            activity.Id, activity.Name, activity.SportType, activity.StartDate,
            activity.Distance, activity.MovingTime, activity.ElapsedTime,
            activity.TotalElevationGain, activity.AverageSpeed, activity.MaxSpeed,
            activity.AverageHeartRate, activity.MaxHeartRate, activity.AverageCadence,
            activity.Calories, activity.SummaryPolyline, activity.DetailedPolyline,
            pace, streams, tags, activity.GearId, newStreetsDiscovered,
            activity.WeatherTempC, activity.WeatherHumidityPct,
            activity.WeatherWindSpeedKmh, activity.WeatherCondition
        );
    }
}

// --- GetActivitiesExport (CSV) ---
public record GetActivitiesExportQuery(
    string UserId,
    int Count = 50,
    List<string>? Fields = null,
    DateTime? From = null,
    DateTime? To = null,
    ZoneBoundary[]? HrZones = null
) : IRequest<string>;

/// <summary>Available optional export field names.</summary>
public static class ExportField
{
    public const string Pace = "pace";
    public const string AvgHR = "avghr";
    public const string MaxHR = "maxhr";
    public const string Elevation = "elevation";
    public const string Calories = "calories";
    public const string Cadence = "cadence";
    public const string Tags = "tags";
    public const string Gear = "gear";
    public const string HrZones = "hrzones";
}

public class GetActivitiesExportQueryHandler : IRequestHandler<GetActivitiesExportQuery, string>
{
    private readonly IApplicationDbContext _db;

    public GetActivitiesExportQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<string> Handle(GetActivitiesExportQuery request, CancellationToken ct)
    {
        var count = Math.Clamp(request.Count, 1, 500);

        var fields = request.Fields ?? [
            ExportField.Pace, ExportField.AvgHR, ExportField.MaxHR,
            ExportField.Elevation, ExportField.Calories
        ];
        bool incPace = fields.Contains(ExportField.Pace, StringComparer.OrdinalIgnoreCase);
        bool incAvgHR = fields.Contains(ExportField.AvgHR, StringComparer.OrdinalIgnoreCase);
        bool incMaxHR = fields.Contains(ExportField.MaxHR, StringComparer.OrdinalIgnoreCase);
        bool incElevation = fields.Contains(ExportField.Elevation, StringComparer.OrdinalIgnoreCase);
        bool incCalories = fields.Contains(ExportField.Calories, StringComparer.OrdinalIgnoreCase);
        bool incCadence = fields.Contains(ExportField.Cadence, StringComparer.OrdinalIgnoreCase);
        bool incTags = fields.Contains(ExportField.Tags, StringComparer.OrdinalIgnoreCase);
        bool incGear = fields.Contains(ExportField.Gear, StringComparer.OrdinalIgnoreCase);
        bool incHrZones = fields.Contains(ExportField.HrZones, StringComparer.OrdinalIgnoreCase)
                          && request.HrZones is { Length: > 0 };

        var query = _db.Activities.Where(a => a.UserId == request.UserId);
        if (request.From.HasValue) query = query.Where(a => a.StartDate >= request.From.Value);
        if (request.To.HasValue) query = query.Where(a => a.StartDate <= request.To.Value);

        var items = await query
            .OrderByDescending(a => a.StartDate)
            .Take(count)
            .Select(a => new
            {
                a.Id,
                a.StartDate,
                a.Name,
                a.SportType,
                a.Distance,
                a.MovingTime,
                a.TotalElevationGain,
                a.AverageHeartRate,
                a.MaxHeartRate,
                a.Calories,
                a.AverageCadence,
                Tags = incTags ? a.ActivityTags.Select(at => at.Tag.Name).ToList() : null,
                GearName = incGear ? (a.Gear != null ? a.Gear.Name : null) : null,
            })
            .ToListAsync(ct);

        // Compute HR zone times if requested
        var zoneTimesMap = new Dictionary<Guid, List<HrZoneTimeCalculator.ZoneTimeResult>>();
        if (incHrZones)
        {
            var activityIds = items.Select(a => a.Id).ToList();
            var allStreams = await _db.ActivityStreams
                .Where(s => activityIds.Contains(s.ActivityId))
                .OrderBy(s => s.ActivityId).ThenBy(s => s.PointIndex)
                .ToListAsync(ct);

            foreach (var group in allStreams.GroupBy(s => s.ActivityId))
            {
                var streams = group.ToList();
                if (streams.Any(s => s.HeartRate.HasValue))
                    zoneTimesMap[group.Key] = HrZoneTimeCalculator.Calculate(request.HrZones!, streams);
            }
        }

        var sb = new System.Text.StringBuilder();

        var headers = new List<string> { "Date", "Name", "Type", "Distance(km)", "Duration(hh:mm:ss)" };
        if (incPace) headers.Add("Pace(/km)");
        if (incAvgHR) headers.Add("AvgHR");
        if (incMaxHR) headers.Add("MaxHR");
        if (incElevation) headers.Add("Elevation(m)");
        if (incCalories) headers.Add("Calories");
        if (incCadence) headers.Add("Cadence(spm)");
        if (incTags) headers.Add("Tags");
        if (incGear) headers.Add("Gear");
        if (incHrZones)
            headers.AddRange(request.HrZones!.Select(z => $"Zone{z.Zone}_{z.Label}(sec)"));
        sb.AppendLine(string.Join(',', headers));

        foreach (var a in items)
        {
            var distKm = a.Distance / 1000.0;
            var pace = distKm > 0 && a.MovingTime > 0
                ? (a.MovingTime / 60.0) / distKm : 0;
            var paceMin = (int)pace;
            var paceSec = (int)Math.Round((pace - paceMin) * 60);

            var h = a.MovingTime / 3600;
            var m = (a.MovingTime % 3600) / 60;
            var s = a.MovingTime % 60;

            var row = new List<string>
            {
                a.StartDate.ToString("yyyy-MM-dd"),
                EscapeCsv(a.Name),
                a.SportType.ToString(),
                distKm.ToString("F2"),
                $"{h}:{m:D2}:{s:D2}",
            };
            if (incPace) row.Add(pace > 0 ? $"{paceMin}:{paceSec:D2}" : "");
            if (incAvgHR) row.Add(a.AverageHeartRate.HasValue ? ((int)a.AverageHeartRate.Value).ToString() : "");
            if (incMaxHR) row.Add(a.MaxHeartRate.HasValue ? a.MaxHeartRate.Value.ToString() : "");
            if (incElevation) row.Add(((int)a.TotalElevationGain).ToString());
            if (incCalories) row.Add(a.Calories.HasValue ? a.Calories.Value.ToString() : "");
            if (incCadence) row.Add(a.AverageCadence.HasValue ? Math.Round(a.AverageCadence.Value).ToString() : "");
            if (incTags) row.Add(EscapeCsv(string.Join("|", a.Tags ?? [])));
            if (incGear) row.Add(EscapeCsv(a.GearName ?? ""));
            if (incHrZones)
            {
                zoneTimesMap.TryGetValue(a.Id, out var zoneTimes);
                foreach (var zone in request.HrZones!)
                {
                    var time = zoneTimes?.FirstOrDefault(z => z.Zone == zone.Zone)?.TimeSeconds ?? 0;
                    row.Add(time.ToString());
                }
            }

            sb.AppendLine(string.Join(',', row));
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
