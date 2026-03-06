using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Activities.Queries;

public record IntervalRepDto(
    int RepNumber,
    double DistanceM,
    double DurationSec,
    double PaceMinPerKm,
    double? AvgHr,
    double RecoveryDurationSec,
    double? RecoveryPaceMinPerKm
);

public record PreviousIntervalSessionDto(
    Guid ActivityId,
    string ActivityName,
    string Date,
    string Structure,
    double AvgRepPace,
    double ConsistencyPct
);

public record IntervalAnalysisDto(
    bool HasIntervals,
    string? Structure,          // e.g. "8 × 400m"
    int RepCount,
    double AvgRepDistanceM,
    double AvgRepPaceMinPerKm,
    double ConsistencyPct,      // 100 = perfect; lower = more variable
    List<IntervalRepDto> Reps,
    List<PreviousIntervalSessionDto> PreviousSessions
);

public record GetIntervalAnalysisQuery(string UserId, Guid ActivityId) : IRequest<IntervalAnalysisDto?>;

public class GetIntervalAnalysisQueryHandler : IRequestHandler<GetIntervalAnalysisQuery, IntervalAnalysisDto?>
{
    private readonly IApplicationDbContext _db;
    public GetIntervalAnalysisQueryHandler(IApplicationDbContext db) => _db = db;

    /// <summary>Extracts interval reps from a list of ordered stream points.</summary>
    internal static List<IntervalRepDto> ComputeReps(List<Domain.Entities.ActivityStream> streams)
    {
        if (streams.Count < 10) return [];
        var movingSpeeds = streams.Where(s => s.Speed!.Value > 0.3).Select(s => s.Speed!.Value).ToList();
        if (movingSpeeds.Count == 0) return [];
        var avgSpeed = movingSpeeds.Average();
        const double fastThreshold = 1.15;
        var isFast = streams.Select(s => s.Speed!.Value >= avgSpeed * fastThreshold).ToArray();
        const int minRun = 8;
        var smoothed = (bool[])isFast.Clone();
        for (int i = 0; i < isFast.Length; i++)
        {
            if (i > 0 && smoothed[i] != smoothed[i - 1])
            {
                int runLen = 1;
                while (i + runLen < isFast.Length && isFast[i + runLen] == isFast[i]) runLen++;
                if (runLen < minRun)
                    for (int j = i; j < i + runLen && j < smoothed.Length; j++)
                        smoothed[j] = smoothed[i - 1];
            }
        }
        var segments = new List<(bool Fast, int Start, int End)>();
        int segStart = 0;
        for (int i = 1; i <= smoothed.Length; i++)
        {
            if (i == smoothed.Length || smoothed[i] != smoothed[segStart])
            { segments.Add((smoothed[segStart], segStart, i - 1)); segStart = i; }
        }
        var reps = new List<IntervalRepDto>();
        foreach (var (_, start, end) in segments.Where(s => s.Fast))
        {
            var pts = streams.Skip(start).Take(end - start + 1).ToList();
            if (pts.Count < 2) continue;
            var dist = pts.Last().Distance!.Value - pts.First().Distance!.Value;
            var dur = pts.Last().Time!.Value - pts.First().Time!.Value;
            if (dist < 80 || dur < 15) continue;
            var pace = dur > 0 ? (dur / 60.0) / (dist / 1000.0) : 0;
            var avgHr = pts.Any(p => p.HeartRate.HasValue)
                ? pts.Where(p => p.HeartRate.HasValue).Average(p => (double)p.HeartRate!.Value) : (double?)null;
            var nextSlowIdx = segments.FindIndex(s => !s.Fast && s.Start > end);
            double recDur = 0; double? recPace = null;
            if (nextSlowIdx >= 0)
            {
                var (_, rs, re) = segments[nextSlowIdx];
                var recPts = streams.Skip(rs).Take(re - rs + 1).ToList();
                if (recPts.Count >= 2)
                {
                    var recDist = recPts.Last().Distance!.Value - recPts.First().Distance!.Value;
                    recDur = recPts.Last().Time!.Value - recPts.First().Time!.Value;
                    recPace = recDist > 10 && recDur > 0 ? (recDur / 60.0) / (recDist / 1000.0) : null;
                }
            }
            reps.Add(new IntervalRepDto(reps.Count + 1, Math.Round(dist, 1), (double)dur, Math.Round(pace, 2),
                avgHr.HasValue ? Math.Round(avgHr.Value, 1) : null, (double)recDur,
                recPace.HasValue ? Math.Round(recPace.Value, 2) : null));
        }
        return reps;
    }

    public async Task<IntervalAnalysisDto?> Handle(GetIntervalAnalysisQuery request, CancellationToken ct)
    {
        var activity = await _db.Activities
            .Where(a => a.Id == request.ActivityId && a.UserId == request.UserId)
            .Include(a => a.Streams)
            .FirstOrDefaultAsync(ct);

        if (activity is null) return null;

        var streams = activity.Streams
            .Where(s => s.Speed.HasValue && s.Distance.HasValue && s.Time.HasValue)
            .OrderBy(s => s.PointIndex)
            .ToList();

        var reps = ComputeReps(streams);

        if (reps.Count < 2)
            return new IntervalAnalysisDto(false, null, 0, 0, 0, 0, [], []);

        // Compute consistency (100 - CV%)
        var avgRepPace = reps.Average(r => r.PaceMinPerKm);
        var variance = reps.Average(r => Math.Pow(r.PaceMinPerKm - avgRepPace, 2));
        var stddev = Math.Sqrt(variance);
        var cv = avgRepPace > 0 ? stddev / avgRepPace * 100 : 0;
        var consistency = Math.Round(Math.Max(0, 100 - cv), 1);

        // Structure string
        var avgDist = reps.Average(r => r.DistanceM);
        var roundedDist = avgDist >= 900 ? Math.Round(avgDist / 100.0) * 100 : Math.Round(avgDist / 50.0) * 50;
        var distLabel = roundedDist >= 1000 ? $"{roundedDist / 1000.0:F1}km" : $"{(int)roundedDist}m";
        var structure = $"{reps.Count} × {distLabel}";

        // Previous similar interval sessions — run full analysis on candidates to match structure
        var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
        var candidates = await _db.Activities
            .Where(a => a.UserId == request.UserId
                && a.Id != request.ActivityId
                && a.StartDate >= sixMonthsAgo
                && (a.SportType == SportType.Run || a.SportType == SportType.TrailRun))
            .OrderByDescending(a => a.StartDate)
            .Take(15)
            .Include(a => a.Streams)
            .ToListAsync(ct);

        var prevSessions = new List<PreviousIntervalSessionDto>();
        foreach (var cand in candidates)
        {
            var candReps = ComputeReps(cand.Streams
                .Where(s => s.Speed.HasValue && s.Distance.HasValue && s.Time.HasValue)
                .OrderBy(s => s.PointIndex).ToList());

            if (candReps.Count < 2) continue;
            var candAvgDist = candReps.Average(r => r.DistanceM);
            var candAvgPace = candReps.Average(r => r.PaceMinPerKm);

            // Structure match: ± 1 rep and ± 10% avg distance
            if (Math.Abs(candReps.Count - reps.Count) > 1) continue;
            if (Math.Abs(candAvgDist - avgDist) / avgDist > 0.10) continue;

            var candVariance = candReps.Average(r => Math.Pow(r.PaceMinPerKm - candAvgPace, 2));
            var candCv = candAvgPace > 0 ? Math.Sqrt(candVariance) / candAvgPace * 100 : 0;
            var candConsistency = Math.Round(Math.Max(0, 100 - candCv), 1);

            var candDist = candReps.Average(r => r.DistanceM);
            var candRounded = candDist >= 900 ? Math.Round(candDist / 100.0) * 100 : Math.Round(candDist / 50.0) * 50;
            var candLabel = candRounded >= 1000 ? $"{candRounded / 1000.0:F1}km" : $"{(int)candRounded}m";

            prevSessions.Add(new PreviousIntervalSessionDto(
                cand.Id, cand.Name, cand.StartDate.ToString("yyyy-MM-dd"),
                $"{candReps.Count} × {candLabel}",
                Math.Round(candAvgPace, 2),
                candConsistency
            ));
            if (prevSessions.Count >= 5) break;
        }

        return new IntervalAnalysisDto(
            true,
            structure,
            reps.Count,
            Math.Round(avgDist, 0),
            Math.Round(avgRepPace, 2),
            consistency,
            reps,
            prevSessions
        );
    }
}
