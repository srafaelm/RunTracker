using RunTracker.Domain.Enums;

namespace RunTracker.Application.Common;

/// <summary>
/// Calculates heart rate zone boundaries in bpm for various algorithms.
/// Returns an array of (lower, upper) bpm pairs — one per zone.
/// </summary>
public static class HrZoneCalculator
{
    public static ZoneBoundary[] GetZones(HrZoneAlgorithm algorithm, int maxHr, int restingHr = 60, string? customZonesJson = null)
    {
        if (algorithm == HrZoneAlgorithm.Custom && customZonesJson is not null)
        {
            try
            {
                var uppers = System.Text.Json.JsonSerializer.Deserialize<int[]>(customZonesJson);
                if (uppers is { Length: 5 })
                {
                    var labels = new[] { "Easy", "Aerobic", "Tempo", "Threshold", "Max" };
                    return Enumerable.Range(0, 5).Select(i => new ZoneBoundary(
                        Zone: i + 1,
                        Label: labels[i],
                        Lower: i == 0 ? 0 : uppers[i - 1] + 1,
                        Upper: uppers[i]
                    )).ToArray();
                }
            }
            catch { /* fall through to default */ }
        }

        return algorithm switch
        {
            HrZoneAlgorithm.FiveZoneKarvonen    => KarvonenZones(maxHr, restingHr),
            HrZoneAlgorithm.GarminFiveZone      => GarminZones(maxHr),
            HrZoneAlgorithm.SevenZonePolarized  => PolarizedSevenZones(maxHr),
            _                                   => PercentMaxZones(maxHr),
        };
    }

    // Zone 1-5 as straight % of MaxHR: 50-60 / 60-70 / 70-80 / 80-90 / 90-100
    private static ZoneBoundary[] PercentMaxZones(int maxHr) =>
    [
        new(Zone: 1, Label: "Easy",     Lower: (int)(maxHr * 0.50), Upper: (int)(maxHr * 0.60)),
        new(Zone: 2, Label: "Aerobic",  Lower: (int)(maxHr * 0.60), Upper: (int)(maxHr * 0.70)),
        new(Zone: 3, Label: "Tempo",    Lower: (int)(maxHr * 0.70), Upper: (int)(maxHr * 0.80)),
        new(Zone: 4, Label: "Threshold",Lower: (int)(maxHr * 0.80), Upper: (int)(maxHr * 0.90)),
        new(Zone: 5, Label: "Max",      Lower: (int)(maxHr * 0.90), Upper: maxHr),
    ];

    // Karvonen: uses Heart Rate Reserve (HRR = MaxHR − RestingHR)
    private static ZoneBoundary[] KarvonenZones(int maxHr, int restingHr)
    {
        var hrr = maxHr - restingHr;
        int Bpm(double pct) => (int)(pct * hrr + restingHr);
        return
        [
            new(Zone: 1, Label: "Easy",      Lower: Bpm(0.50), Upper: Bpm(0.60)),
            new(Zone: 2, Label: "Aerobic",   Lower: Bpm(0.60), Upper: Bpm(0.70)),
            new(Zone: 3, Label: "Tempo",     Lower: Bpm(0.70), Upper: Bpm(0.80)),
            new(Zone: 4, Label: "Threshold", Lower: Bpm(0.80), Upper: Bpm(0.90)),
            new(Zone: 5, Label: "Max",       Lower: Bpm(0.90), Upper: maxHr),
        ];
    }

    // Garmin default: <60 / 60-70 / 70-80 / 80-90 / >90
    private static ZoneBoundary[] GarminZones(int maxHr) =>
    [
        new(Zone: 1, Label: "Warm Up",   Lower: 0,                    Upper: (int)(maxHr * 0.60)),
        new(Zone: 2, Label: "Easy",      Lower: (int)(maxHr * 0.60),  Upper: (int)(maxHr * 0.70)),
        new(Zone: 3, Label: "Aerobic",   Lower: (int)(maxHr * 0.70),  Upper: (int)(maxHr * 0.80)),
        new(Zone: 4, Label: "Threshold", Lower: (int)(maxHr * 0.80),  Upper: (int)(maxHr * 0.90)),
        new(Zone: 5, Label: "Max",       Lower: (int)(maxHr * 0.90),  Upper: maxHr),
    ];

    // 7-zone polarized model
    private static ZoneBoundary[] PolarizedSevenZones(int maxHr) =>
    [
        new(Zone: 1, Label: "Recovery",      Lower: 0,                    Upper: (int)(maxHr * 0.60)),
        new(Zone: 2, Label: "Easy",          Lower: (int)(maxHr * 0.60),  Upper: (int)(maxHr * 0.65)),
        new(Zone: 3, Label: "Aerobic",       Lower: (int)(maxHr * 0.65),  Upper: (int)(maxHr * 0.70)),
        new(Zone: 4, Label: "Tempo",         Lower: (int)(maxHr * 0.70),  Upper: (int)(maxHr * 0.75)),
        new(Zone: 5, Label: "SubThreshold",  Lower: (int)(maxHr * 0.75),  Upper: (int)(maxHr * 0.80)),
        new(Zone: 6, Label: "Threshold",     Lower: (int)(maxHr * 0.80),  Upper: (int)(maxHr * 0.90)),
        new(Zone: 7, Label: "Max",           Lower: (int)(maxHr * 0.90),  Upper: maxHr),
    ];
}

public record ZoneBoundary(int Zone, string Label, int Lower, int Upper);
