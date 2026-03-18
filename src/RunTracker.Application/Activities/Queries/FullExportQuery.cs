using System.IO.Compression;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Application.Activities.Queries;

/// <summary>
/// Generates a ZIP archive containing:
/// - activities.csv  (all activities summary)
/// - activities.json (all activities as JSON array)
/// - gpx/  folder with one .gpx file per activity that has stream data
/// </summary>
public record GetFullExportQuery(string UserId, ZoneBoundary[]? HrZones = null) : IRequest<byte[]>;

public class GetFullExportQueryHandler : IRequestHandler<GetFullExportQuery, byte[]>
{
    private readonly IApplicationDbContext _db;

    public GetFullExportQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<byte[]> Handle(GetFullExportQuery request, CancellationToken ct)
    {
        var activities = await _db.Activities
            .Where(a => a.UserId == request.UserId)
            .OrderByDescending(a => a.StartDate)
            .ToListAsync(ct);

        // Pre-compute HR zone times per activity if zones are available
        var zoneTimesMap = new Dictionary<Guid, List<HrZoneTimeCalculator.ZoneTimeResult>>();
        if (request.HrZones is { Length: > 0 })
        {
            var activityIds = activities.Select(a => a.Id).ToList();
            var allStreams = await _db.ActivityStreams
                .Where(s => activityIds.Contains(s.ActivityId))
                .OrderBy(s => s.ActivityId).ThenBy(s => s.PointIndex)
                .ToListAsync(ct);

            foreach (var group in allStreams.GroupBy(s => s.ActivityId))
            {
                var streams = group.ToList();
                if (streams.Any(s => s.HeartRate.HasValue))
                    zoneTimesMap[group.Key] = HrZoneTimeCalculator.Calculate(request.HrZones, streams);
            }
        }

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            // activities.csv
            var csv = BuildCsv(activities, request.HrZones, zoneTimesMap);
            var csvEntry = zip.CreateEntry("activities.csv", CompressionLevel.Fastest);
            using (var w = new StreamWriter(csvEntry.Open(), Encoding.UTF8))
                await w.WriteAsync(csv);

            // activities.json
            var json = BuildJson(activities, request.HrZones, zoneTimesMap);
            var jsonEntry = zip.CreateEntry("activities.json", CompressionLevel.Fastest);
            using (var w = new StreamWriter(jsonEntry.Open(), Encoding.UTF8))
                await w.WriteAsync(json);

            // gpx/ per activity
            foreach (var activity in activities)
            {
                var streams = await _db.ActivityStreams
                    .Where(s => s.ActivityId == activity.Id)
                    .OrderBy(s => s.PointIndex)
                    .ToListAsync(ct);

                if (streams.Count == 0) continue;

                zoneTimesMap.TryGetValue(activity.Id, out var zoneTimes);
                var gpx = BuildGpx(activity, streams, zoneTimes);
                var safeName = MakeSafe(activity.Name, activity.Id.ToString()[..8]);
                var gpxEntry = zip.CreateEntry($"gpx/{safeName}.gpx", CompressionLevel.Fastest);
                using (var w = new StreamWriter(gpxEntry.Open(), Encoding.UTF8))
                    await w.WriteAsync(gpx);
            }
        }

        return ms.ToArray();
    }

    private static string BuildCsv(
        List<RunTracker.Domain.Entities.Activity> activities,
        ZoneBoundary[]? zones,
        Dictionary<Guid, List<HrZoneTimeCalculator.ZoneTimeResult>> zoneTimesMap)
    {
        var sb = new StringBuilder();
        var header = "id,name,sport_type,start_date,distance_km,moving_time_s,elevation_m,avg_hr,avg_pace_min_km";
        if (zones is { Length: > 0 })
            header += "," + string.Join(",", zones.Select(z => $"zone{z.Zone}_{z.Label}_sec"));
        sb.AppendLine(header);

        foreach (var a in activities)
        {
            var pace = a.Distance > 0 && a.MovingTime > 0
                ? Math.Round((a.MovingTime / 60.0) / (a.Distance / 1000.0), 2)
                : 0;
            sb.Append(string.Join(',',
                a.Id, $"\"{a.Name.Replace("\"", "\"\"")}\"",
                a.SportType, a.StartDate.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                Math.Round(a.Distance / 1000, 3),
                a.MovingTime, Math.Round(a.TotalElevationGain, 1),
                a.AverageHeartRate?.ToString("F0") ?? "",
                pace > 0 ? pace : ""));

            if (zones is { Length: > 0 })
            {
                zoneTimesMap.TryGetValue(a.Id, out var zoneTimes);
                foreach (var zone in zones)
                {
                    var time = zoneTimes?.FirstOrDefault(z => z.Zone == zone.Zone)?.TimeSeconds ?? 0;
                    sb.Append($",{time}");
                }
            }
            sb.AppendLine();
        }
        return sb.ToString();
    }

    private static string BuildJson(
        List<RunTracker.Domain.Entities.Activity> activities,
        ZoneBoundary[]? zones,
        Dictionary<Guid, List<HrZoneTimeCalculator.ZoneTimeResult>> zoneTimesMap)
    {
        var sb = new StringBuilder("[");
        for (int i = 0; i < activities.Count; i++)
        {
            var a = activities[i];
            if (i > 0) sb.Append(',');
            sb.Append($"{{\"id\":\"{a.Id}\",\"name\":{System.Text.Json.JsonSerializer.Serialize(a.Name)}," +
                      $"\"sportType\":{(int)a.SportType},\"startDate\":\"{a.StartDate:O}\"," +
                      $"\"distanceKm\":{Math.Round(a.Distance / 1000, 3)}," +
                      $"\"movingTimeSec\":{a.MovingTime},\"elevationM\":{Math.Round(a.TotalElevationGain, 1)}," +
                      $"\"avgHr\":{(a.AverageHeartRate.HasValue ? a.AverageHeartRate.Value.ToString("F0") : "null")}");

            if (zones is { Length: > 0 } && zoneTimesMap.TryGetValue(a.Id, out var zoneTimes))
            {
                sb.Append(",\"hrZones\":[");
                for (int j = 0; j < zoneTimes.Count; j++)
                {
                    if (j > 0) sb.Append(',');
                    var zt = zoneTimes[j];
                    sb.Append($"{{\"zone\":{zt.Zone},\"label\":\"{zt.Label}\"," +
                              $"\"lowerBpm\":{zt.LowerBpm},\"upperBpm\":{zt.UpperBpm}," +
                              $"\"timeSeconds\":{zt.TimeSeconds}}}");
                }
                sb.Append(']');
            }

            sb.Append('}');
        }
        sb.Append(']');
        return sb.ToString();
    }

    private static string BuildGpx(
        RunTracker.Domain.Entities.Activity activity,
        List<RunTracker.Domain.Entities.ActivityStream> streams,
        List<HrZoneTimeCalculator.ZoneTimeResult>? zoneTimes = null)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<gpx version=\"1.1\" creator=\"RunTracker\" xmlns=\"http://www.topografix.com/GPX/1/1\"" +
                      " xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\"" +
                      " xmlns:rt=\"http://runtracker.app/xmlschemas/Export/v1\">");
        sb.AppendLine($"  <metadata><name>{System.Security.SecurityElement.Escape(activity.Name)}</name>" +
                      $"<time>{activity.StartDate:O}</time></metadata>");
        sb.Append($"  <trk><name>{System.Security.SecurityElement.Escape(activity.Name)}</name>");

        if (zoneTimes is { Count: > 0 })
        {
            sb.AppendLine();
            sb.AppendLine("    <extensions>");
            foreach (var zt in zoneTimes)
            {
                sb.AppendLine($"      <rt:HrZone zone=\"{zt.Zone}\" label=\"{zt.Label}\"" +
                              $" lowerBpm=\"{zt.LowerBpm}\" upperBpm=\"{zt.UpperBpm}\"" +
                              $" timeSeconds=\"{zt.TimeSeconds}\" />");
            }
            sb.AppendLine("    </extensions>");
            sb.Append("  ");
        }

        sb.AppendLine("<trkseg>");

        foreach (var pt in streams)
        {
            var time = pt.Time.HasValue
                ? activity.StartDate.AddSeconds(pt.Time.Value).ToString("O")
                : activity.StartDate.ToString("O");

            sb.Append($"    <trkpt lat=\"{pt.Latitude:F7}\" lon=\"{pt.Longitude:F7}\">");
            if (pt.Altitude.HasValue)
                sb.Append($"<ele>{pt.Altitude:F2}</ele>");
            sb.Append($"<time>{time}</time>");
            if (pt.HeartRate.HasValue)
                sb.Append($"<extensions><gpxtpx:TrackPointExtension>" +
                          $"<gpxtpx:hr>{pt.HeartRate.Value}</gpxtpx:hr>" +
                          $"</gpxtpx:TrackPointExtension></extensions>");
            sb.AppendLine("</trkpt>");
        }

        sb.AppendLine("  </trkseg></trk></gpx>");
        return sb.ToString();
    }

    private static string MakeSafe(string name, string fallback)
    {
        var safe = new StringBuilder();
        foreach (var c in name)
        {
            if (char.IsLetterOrDigit(c) || c == '-' || c == '_' || c == ' ')
                safe.Append(c == ' ' ? '_' : c);
        }
        var result = safe.ToString().Trim('_');
        return string.IsNullOrEmpty(result) ? fallback : result[..Math.Min(result.Length, 60)];
    }
}
