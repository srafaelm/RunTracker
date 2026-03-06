using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Infrastructure.Services;

public class PersonalRecordService
{
    private readonly IApplicationDbContext _db;
    private readonly ILogger<PersonalRecordService> _logger;

    // Standard distances in meters — used for estimated fastest-time PRs (running only)
    private static readonly Dictionary<RecordType, double> DistanceThresholds = new()
    {
        [RecordType.Fastest100m]    = 100,
        [RecordType.Fastest400m]    = 400,
        [RecordType.Fastest800m]    = 800,
        [RecordType.Fastest1K]      = 1000,
        [RecordType.Fastest2K]      = 2000,
        [RecordType.Fastest3K]      = 3000,
        [RecordType.Fastest4K]      = 4000,
        [RecordType.Fastest5K]      = 5000,
        [RecordType.Fastest10K]     = 10000,
        [RecordType.Fastest15K]     = 15000,
        [RecordType.Fastest20K]     = 20000,
        [RecordType.FastestHalf]    = 21097.5,
        [RecordType.Fastest30K]     = 30000,
        [RecordType.FastestMarathon] = 42195,
    };

    public PersonalRecordService(IApplicationDbContext db, ILogger<PersonalRecordService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task EvaluateAsync(string userId, Activity activity, CancellationToken ct)
    {
        var isRun  = activity.SportType is SportType.Run or SportType.TrailRun;
        var isRide = activity.SportType is SportType.Ride or SportType.VirtualRide;
        var isSwim = activity.SportType == SportType.Swim;

        if (isRun)
        {
            await CheckHigherValue(userId, activity, RecordType.LongestRun, activity.Distance, ct);
            await CheckHigherValue(userId, activity, RecordType.LongestRunTime, activity.MovingTime, ct);

            foreach (var (recordType, distance) in DistanceThresholds)
            {
                if (activity.Distance >= distance)
                    await CheckFastestTime(userId, activity, recordType, distance, ct);
            }

            if (activity.AverageCadence is > 0)
                await CheckHigherValue(userId, activity, RecordType.BestRunCadence, activity.AverageCadence.Value, ct);
        }

        if (isRide)
        {
            await CheckHigherValue(userId, activity, RecordType.LongestRide, activity.Distance, ct);

            if (activity.AverageCadence is > 0)
                await CheckHigherValue(userId, activity, RecordType.BestRideCadence, activity.AverageCadence.Value, ct);
        }

        if (isSwim)
            await CheckHigherValue(userId, activity, RecordType.LongestSwim, activity.Distance, ct);

        if (activity.TotalElevationGain > 0)
            await CheckHigherValue(userId, activity, RecordType.MostElevation, activity.TotalElevationGain, ct);
    }

    /// <summary>Updates a "higher is better" PR (distance, elevation, cadence).</summary>
    private async Task CheckHigherValue(string userId, Activity activity, RecordType recordType, double value, CancellationToken ct)
    {
        var existing = await _db.PersonalRecords
            .FirstOrDefaultAsync(pr => pr.UserId == userId && pr.RecordType == recordType, ct);

        if (existing is null || value > existing.Value)
        {
            if (existing is not null)
                _db.PersonalRecords.Remove(existing);

            _db.PersonalRecords.Add(new PersonalRecord
            {
                UserId = userId,
                RecordType = recordType,
                Value = value,
                ActivityId = activity.Id,
                AchievedAt = activity.StartDate
            });

            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("New PR: {RecordType} = {Value} for user {UserId}", recordType, value, userId);
        }
    }

    /// <summary>Updates a "lower is better" PR (fastest time for a given distance).</summary>
    private async Task CheckFastestTime(string userId, Activity activity, RecordType recordType, double targetDistance, CancellationToken ct)
    {
        // Estimate time for the target distance based on average pace
        var estimatedTime = activity.MovingTime * (targetDistance / activity.Distance);

        var existing = await _db.PersonalRecords
            .FirstOrDefaultAsync(pr => pr.UserId == userId && pr.RecordType == recordType, ct);

        if (existing is null || estimatedTime < existing.Value)
        {
            if (existing is not null)
                _db.PersonalRecords.Remove(existing);

            _db.PersonalRecords.Add(new PersonalRecord
            {
                UserId = userId,
                RecordType = recordType,
                Value = estimatedTime,
                ActivityId = activity.Id,
                AchievedAt = activity.StartDate
            });

            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("New PR: {RecordType} in {Time}s for user {UserId}", recordType, estimatedTime, userId);
        }
    }
}
