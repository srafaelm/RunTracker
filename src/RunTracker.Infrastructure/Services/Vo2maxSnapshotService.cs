using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Infrastructure.Services;

public class Vo2maxSnapshotService
{
    private readonly IApplicationDbContext _db;

    public Vo2maxSnapshotService(IApplicationDbContext db) => _db = db;

    private static double CalcVdot(double distanceMeters, double timeSecs)
    {
        var t = timeSecs / 60.0;
        var v = distanceMeters / t;
        var pct = 0.8 + 0.1894393 * Math.Exp(-0.012778 * t) + 0.2989558 * Math.Exp(-0.1932605 * t);
        var vo2AtV = -4.60 + 0.182258 * v + 0.000104 * v * v;
        return vo2AtV / pct;
    }

    /// <summary>
    /// Records a VO2max snapshot for the given activity if it qualifies (run >= 3 km).
    /// Only records if the value is higher than any existing snapshot on the same date.
    /// </summary>
    public async Task RecordAsync(string userId, Activity activity, CancellationToken ct = default)
    {
        if (activity.SportType is not (SportType.Run or SportType.TrailRun)) return;
        if (activity.Distance < 3000 || activity.MovingTime <= 0) return;

        var vo2max = CalcVdot(activity.Distance, activity.MovingTime);
        if (vo2max <= 0 || double.IsNaN(vo2max)) return;

        var dateOnly = activity.StartDate.Date;

        var existing = await _db.Vo2maxSnapshots
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Date == dateOnly, ct);

        if (existing is null)
        {
            _db.Vo2maxSnapshots.Add(new Vo2maxSnapshot
            {
                UserId = userId,
                Date = dateOnly,
                Value = Math.Round(vo2max, 2),
            });
            await _db.SaveChangesAsync(ct);
        }
        else if (vo2max > existing.Value)
        {
            existing.Value = Math.Round(vo2max, 2);
            await _db.SaveChangesAsync(ct);
        }
    }
}
