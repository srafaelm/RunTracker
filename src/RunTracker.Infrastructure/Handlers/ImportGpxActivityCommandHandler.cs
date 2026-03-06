using MediatR;
using NetTopologySuite.Geometries;
using RunTracker.Application.Activities.Commands;
using RunTracker.Application.Activities.DTOs;
using RunTracker.Application.Activities.Queries;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;
using RunTracker.Infrastructure.Services;

namespace RunTracker.Infrastructure.Handlers;

public class ImportGpxActivityCommandHandler : IRequestHandler<ImportGpxActivityCommand, ActivityDetailDto>
{
    private readonly IApplicationDbContext _db;
    private readonly GpxImportService _gpxImportService;
    private readonly PersonalRecordService _prService;
    private readonly IStreetMatchingService _streetMatchingService;
    private readonly ITileService _tileService;
    private readonly IBadgeService _badgeService;
    private readonly Vo2maxSnapshotService _vo2maxSnapshotService;
    private readonly ISender _mediator;
    private static readonly GeometryFactory GeomFactory =
        NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(4326);

    public ImportGpxActivityCommandHandler(
        IApplicationDbContext db,
        GpxImportService gpxImportService,
        PersonalRecordService prService,
        IStreetMatchingService streetMatchingService,
        ITileService tileService,
        IBadgeService badgeService,
        Vo2maxSnapshotService vo2maxSnapshotService,
        ISender mediator)
    {
        _db = db;
        _gpxImportService = gpxImportService;
        _prService = prService;
        _streetMatchingService = streetMatchingService;
        _tileService = tileService;
        _badgeService = badgeService;
        _vo2maxSnapshotService = vo2maxSnapshotService;
        _mediator = mediator;
    }

    public async Task<ActivityDetailDto> Handle(ImportGpxActivityCommand request, CancellationToken ct)
    {
        var parsed = _gpxImportService.Parse(request.GpxStream, request.Name);

        var activity = new Activity
        {
            UserId = request.UserId,
            Source = ActivitySource.GpxImport,
            Name = request.Name ?? parsed.Name,
            SportType = request.SportType ?? SportType.Run,
            StartDate = parsed.StartDate,
            Distance = parsed.DistanceMeters,
            MovingTime = parsed.MovingSeconds,
            ElapsedTime = parsed.ElapsedSeconds,
            TotalElevationGain = parsed.TotalElevationGain,
            AverageHeartRate = parsed.AverageHeartRate,
            MaxHeartRate = parsed.MaxHeartRate,
            AverageCadence = parsed.AverageCadence,
            AverageSpeed = parsed.AverageSpeed,
            SummaryPolyline = parsed.SummaryPolyline,
            DetailedPolyline = parsed.SummaryPolyline,
        };

        _db.Activities.Add(activity);
        await _db.SaveChangesAsync(ct);

        foreach (var sp in parsed.StreamPoints)
        {
            _db.ActivityStreams.Add(new ActivityStream
            {
                ActivityId = activity.Id,
                PointIndex = sp.Index,
                Latitude = sp.Lat,
                Longitude = sp.Lon,
                Altitude = sp.Altitude,
                Time = sp.TimeOffset,
                Distance = sp.CumulativeDistance,
                HeartRate = sp.HeartRate,
                Cadence = sp.Cadence,
                Speed = sp.Speed,
                Location = GeomFactory.CreatePoint(new Coordinate(sp.Lon, sp.Lat))
            });
        }
        await _db.SaveChangesAsync(ct);

        await _prService.EvaluateAsync(request.UserId, activity, ct);
        try { await _vo2maxSnapshotService.RecordAsync(request.UserId, activity, ct); } catch { /* non-critical */ }

        try { await _streetMatchingService.MatchActivityAsync(request.UserId, activity.Id, ct); }
        catch { /* non-critical */ }

        try { await _tileService.ProcessActivityTilesAsync(request.UserId, activity.Id, ct); }
        catch { /* non-critical */ }

        try { await _badgeService.CheckAndAwardBadgesAsync(request.UserId, ct); }
        catch { /* non-critical */ }

        var detail = await _mediator.Send(new GetActivityDetailQuery(request.UserId, activity.Id), ct);
        return detail!;
    }
}
