using RunTracker.Domain.Entities;

namespace RunTracker.Application.Common;

public static class HrZoneTimeCalculator
{
    public record ZoneTimeResult(int Zone, string Label, int LowerBpm, int UpperBpm, int TimeSeconds);

    /// <summary>
    /// Calculates time spent in each HR zone from activity stream data.
    /// Time between consecutive points is attributed to the zone matching the first point's heart rate.
    /// </summary>
    public static List<ZoneTimeResult> Calculate(ZoneBoundary[] zones, List<ActivityStream> streams)
    {
        var timesPerZone = new int[zones.Length];

        for (int i = 0; i < streams.Count - 1; i++)
        {
            var current = streams[i];
            var next = streams[i + 1];

            if (!current.HeartRate.HasValue || !current.Time.HasValue || !next.Time.HasValue)
                continue;

            var delta = next.Time.Value - current.Time.Value;
            if (delta <= 0) continue;

            var hr = current.HeartRate.Value;
            var zoneIndex = FindZoneIndex(zones, hr);
            if (zoneIndex >= 0)
                timesPerZone[zoneIndex] += delta;
        }

        return zones.Select((z, i) => new ZoneTimeResult(z.Zone, z.Label, z.Lower, z.Upper, timesPerZone[i])).ToList();
    }

    private static int FindZoneIndex(ZoneBoundary[] zones, int hr)
    {
        for (int i = 0; i < zones.Length; i++)
        {
            if (hr >= zones[i].Lower && hr <= zones[i].Upper)
                return i;
        }
        // HR below all zones -> zone 1, above all zones -> last zone
        if (hr < zones[0].Lower) return 0;
        return zones.Length - 1;
    }
}
