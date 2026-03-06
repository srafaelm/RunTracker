using System.Xml.Linq;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Infrastructure.Services;

public record ParsedGpxActivity(
    string Name,
    DateTime StartDate,
    double DistanceMeters,
    int ElapsedSeconds,
    int MovingSeconds,
    double TotalElevationGain,
    double? AverageHeartRate,
    int? MaxHeartRate,
    double? AverageCadence,
    double? AverageSpeed,
    string? SummaryPolyline,
    List<GpxStreamPoint> StreamPoints
);

public record GpxStreamPoint(
    int Index,
    double Lat,
    double Lon,
    double? Altitude,
    int? TimeOffset,
    double? CumulativeDistance,
    int? HeartRate,
    int? Cadence,
    double? Speed
);

public class GpxImportService
{
    private static readonly XNamespace GpxNs = "http://www.topografix.com/GPX/1/1";
    private static readonly XNamespace GarminExt = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1";
    private static readonly XNamespace NsExt = "http://www.garmin.com/xmlschemas/TrackPointExtension/v2";

    public ParsedGpxActivity Parse(Stream gpxStream, string? nameFallback = null)
    {
        var doc = XDocument.Load(gpxStream);
        var root = doc.Root!;

        // Support both namespaced and non-namespaced GPX
        var ns = root.Name.Namespace;

        var trackName = root.Descendants(ns + "name").FirstOrDefault()?.Value
                     ?? root.Descendants(ns + "trk").FirstOrDefault()
                            ?.Element(ns + "name")?.Value
                     ?? nameFallback
                     ?? "Imported Activity";

        var trackPoints = root
            .Descendants(ns + "trkpt")
            .ToList();

        if (trackPoints.Count == 0)
            throw new InvalidOperationException("No track points found in GPX file.");

        var points = new List<(double lat, double lon, double? ele, DateTime? time, int? hr, int? cad)>();
        foreach (var pt in trackPoints)
        {
            var lat = double.Parse(pt.Attribute("lat")!.Value, System.Globalization.CultureInfo.InvariantCulture);
            var lon = double.Parse(pt.Attribute("lon")!.Value, System.Globalization.CultureInfo.InvariantCulture);
            var ele = double.TryParse(pt.Element(ns + "ele")?.Value, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var e) ? e : (double?)null;
            DateTime? time = DateTime.TryParse(pt.Element(ns + "time")?.Value,
                null, System.Globalization.DateTimeStyles.RoundtripKind, out var t) ? t.ToUniversalTime() : null;

            int? hr = null, cad = null;

            // Try Garmin TrackPointExtension (most common)
            var extensions = pt.Element(ns + "extensions");
            if (extensions != null)
            {
                // Try multiple namespace variants
                foreach (var extNs in new[] { GarminExt, NsExt, XNamespace.None })
                {
                    var tpe = extensions.Element(extNs + "TrackPointExtension") ?? extensions;
                    if (!hr.HasValue && int.TryParse(tpe.Element(extNs + "hr")?.Value, out var h)) hr = h;
                    if (!cad.HasValue && int.TryParse(tpe.Element(extNs + "cad")?.Value, out var c)) cad = c;
                }
            }

            points.Add((lat, lon, ele, time, hr, cad));
        }

        var startDate = points.FirstOrDefault(p => p.time.HasValue).time ?? DateTime.UtcNow;
        var endDate = points.LastOrDefault(p => p.time.HasValue).time;
        var elapsed = endDate.HasValue ? (int)(endDate.Value - startDate).TotalSeconds : 0;

        // Compute cumulative distance via Haversine
        double totalDist = 0;
        var cumDist = new double[points.Count];
        for (int i = 1; i < points.Count; i++)
        {
            totalDist += Haversine(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
            cumDist[i] = totalDist;
        }

        // Elevation gain (sum of positive deltas)
        double elevGain = 0;
        for (int i = 1; i < points.Count; i++)
        {
            if (points[i].ele.HasValue && points[i - 1].ele.HasValue)
            {
                var delta = points[i].ele!.Value - points[i - 1].ele!.Value;
                if (delta > 0) elevGain += delta;
            }
        }

        // Heart rate stats
        var hrValues = points.Where(p => p.hr.HasValue).Select(p => p.hr!.Value).ToList();
        double? avgHr = hrValues.Count > 0 ? hrValues.Average() : null;
        int? maxHr = hrValues.Count > 0 ? hrValues.Max() : null;

        // Cadence
        var cadValues = points.Where(p => p.cad.HasValue).Select(p => p.cad!.Value).ToList();
        double? avgCad = cadValues.Count > 0 ? cadValues.Average() : null;

        double? avgSpeed = elapsed > 0 ? totalDist / elapsed : null;

        // Build stream points
        var streamPoints = new List<GpxStreamPoint>(points.Count);
        for (int i = 0; i < points.Count; i++)
        {
            var p = points[i];
            int? timeOffset = p.time.HasValue ? (int)(p.time.Value - startDate).TotalSeconds : null;
            double? speed = null;
            if (i > 0 && p.time.HasValue && points[i - 1].time.HasValue)
            {
                var segTime = (p.time!.Value - points[i - 1].time!.Value).TotalSeconds;
                var segDist = cumDist[i] - cumDist[i - 1];
                speed = segTime > 0 ? segDist / segTime : null;
            }
            streamPoints.Add(new GpxStreamPoint(i, p.lat, p.lon, p.ele, timeOffset,
                cumDist[i] > 0 ? cumDist[i] : null, p.hr, p.cad, speed));
        }

        // Encode summary polyline (every ~10th point for performance)
        var polylinePoints = new List<(double, double)>();
        for (int i = 0; i < points.Count; i += Math.Max(1, points.Count / 500))
            polylinePoints.Add((points[i].lat, points[i].lon));
        if (polylinePoints.LastOrDefault() != (points[^1].lat, points[^1].lon))
            polylinePoints.Add((points[^1].lat, points[^1].lon));
        var polyline = EncodePolyline(polylinePoints);

        return new ParsedGpxActivity(
            trackName, startDate, totalDist, elapsed, elapsed, elevGain,
            avgHr, maxHr, avgCad, avgSpeed, polyline, streamPoints);
    }

    private static double Haversine(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth radius in meters
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static string EncodePolyline(IEnumerable<(double lat, double lon)> coords)
    {
        var sb = new System.Text.StringBuilder();
        int prevLat = 0, prevLon = 0;
        foreach (var (lat, lon) in coords)
        {
            sb.Append(EncodeValue((int)Math.Round(lat * 1e5) - prevLat));
            sb.Append(EncodeValue((int)Math.Round(lon * 1e5) - prevLon));
            prevLat = (int)Math.Round(lat * 1e5);
            prevLon = (int)Math.Round(lon * 1e5);
        }
        return sb.ToString();
    }

    private static string EncodeValue(int value)
    {
        value <<= 1;
        if (value < 0) value = ~value;
        var sb = new System.Text.StringBuilder();
        while (value >= 0x20)
        {
            sb.Append((char)((0x20 | (value & 0x1f)) + 63));
            value >>= 5;
        }
        sb.Append((char)(value + 63));
        return sb.ToString();
    }
}
