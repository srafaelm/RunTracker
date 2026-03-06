using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.GearTracking;

// --- DTOs ---

public record GearDto(
    Guid Id,
    string Name,
    string? Brand,
    GearType Type,
    DateTime? PurchaseDate,
    string? Notes,
    double StartingDistanceM,
    double? RetirementDistanceM,
    bool IsRetired,
    double TotalDistanceM,
    int ActivityCount,
    DateTime CreatedAt);

public record CreateGearRequest(
    string Name,
    string? Brand,
    GearType Type,
    DateTime? PurchaseDate,
    string? Notes,
    double StartingDistanceM,
    double? RetirementDistanceM);

public record UpdateGearRequest(
    string Name,
    string? Brand,
    GearType Type,
    DateTime? PurchaseDate,
    string? Notes,
    double StartingDistanceM,
    double? RetirementDistanceM,
    bool IsRetired);

// --- List ---

public record GetGearListQuery(string UserId) : IRequest<List<GearDto>>;

public class GetGearListQueryHandler : IRequestHandler<GetGearListQuery, List<GearDto>>
{
    private readonly IApplicationDbContext _db;
    public GetGearListQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<GearDto>> Handle(GetGearListQuery request, CancellationToken ct)
    {
        var gearItems = await _db.Gear
            .Where(g => g.UserId == request.UserId)
            .OrderByDescending(g => g.CreatedAt)
            .Select(g => new
            {
                g.Id, g.Name, g.Brand, g.Type, g.PurchaseDate, g.Notes,
                g.StartingDistanceM, g.RetirementDistanceM, g.IsRetired, g.CreatedAt,
                TotalActivity = g.Activities.Where(a => a.Distance > 0).Sum(a => (double?)a.Distance) ?? 0,
                ActivityCount = g.Activities.Count(),
            })
            .ToListAsync(ct);

        return gearItems.Select(g => new GearDto(
            g.Id, g.Name, g.Brand, g.Type, g.PurchaseDate, g.Notes,
            g.StartingDistanceM, g.RetirementDistanceM, g.IsRetired,
            g.StartingDistanceM + g.TotalActivity,
            g.ActivityCount,
            g.CreatedAt)).ToList();
    }
}

// --- Get single ---

public record GetGearQuery(string UserId, Guid Id) : IRequest<GearDto?>;

public class GetGearQueryHandler : IRequestHandler<GetGearQuery, GearDto?>
{
    private readonly IApplicationDbContext _db;
    public GetGearQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<GearDto?> Handle(GetGearQuery request, CancellationToken ct)
    {
        var g = await _db.Gear
            .Where(g => g.Id == request.Id && g.UserId == request.UserId)
            .Select(g => new
            {
                g.Id, g.Name, g.Brand, g.Type, g.PurchaseDate, g.Notes,
                g.StartingDistanceM, g.RetirementDistanceM, g.IsRetired, g.CreatedAt,
                TotalActivity = g.Activities.Where(a => a.Distance > 0).Sum(a => (double?)a.Distance) ?? 0,
                ActivityCount = g.Activities.Count(),
            })
            .FirstOrDefaultAsync(ct);

        if (g is null) return null;
        return new GearDto(g.Id, g.Name, g.Brand, g.Type, g.PurchaseDate, g.Notes,
            g.StartingDistanceM, g.RetirementDistanceM, g.IsRetired,
            g.StartingDistanceM + g.TotalActivity, g.ActivityCount, g.CreatedAt);
    }
}

// --- Create ---

public record CreateGearCommand(string UserId, CreateGearRequest Data) : IRequest<GearDto>;

public class CreateGearCommandHandler : IRequestHandler<CreateGearCommand, GearDto>
{
    private readonly IApplicationDbContext _db;
    public CreateGearCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<GearDto> Handle(CreateGearCommand request, CancellationToken ct)
    {
        var gear = new Domain.Entities.Gear
        {
            UserId = request.UserId,
            Name = request.Data.Name,
            Brand = request.Data.Brand,
            Type = request.Data.Type,
            PurchaseDate = request.Data.PurchaseDate,
            Notes = request.Data.Notes,
            StartingDistanceM = request.Data.StartingDistanceM,
            RetirementDistanceM = request.Data.RetirementDistanceM,
        };
        _db.Gear.Add(gear);
        await _db.SaveChangesAsync(ct);
        return new GearDto(gear.Id, gear.Name, gear.Brand, gear.Type, gear.PurchaseDate,
            gear.Notes, gear.StartingDistanceM, gear.RetirementDistanceM, gear.IsRetired,
            gear.StartingDistanceM, 0, gear.CreatedAt);
    }
}

// --- Update ---

public record UpdateGearCommand(string UserId, Guid Id, UpdateGearRequest Data) : IRequest<GearDto?>;

public class UpdateGearCommandHandler : IRequestHandler<UpdateGearCommand, GearDto?>
{
    private readonly IApplicationDbContext _db;
    public UpdateGearCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<GearDto?> Handle(UpdateGearCommand request, CancellationToken ct)
    {
        var gear = await _db.Gear
            .Include(g => g.Activities)
            .FirstOrDefaultAsync(g => g.Id == request.Id && g.UserId == request.UserId, ct);
        if (gear is null) return null;

        gear.Name = request.Data.Name;
        gear.Brand = request.Data.Brand;
        gear.Type = request.Data.Type;
        gear.PurchaseDate = request.Data.PurchaseDate;
        gear.Notes = request.Data.Notes;
        gear.StartingDistanceM = request.Data.StartingDistanceM;
        gear.RetirementDistanceM = request.Data.RetirementDistanceM;
        gear.IsRetired = request.Data.IsRetired;

        await _db.SaveChangesAsync(ct);

        var activityTotal = gear.Activities.Sum(a => a.Distance);
        var activityCount = gear.Activities.Count;
        return new GearDto(gear.Id, gear.Name, gear.Brand, gear.Type, gear.PurchaseDate,
            gear.Notes, gear.StartingDistanceM, gear.RetirementDistanceM, gear.IsRetired,
            gear.StartingDistanceM + activityTotal, activityCount, gear.CreatedAt);
    }
}

// --- Delete ---

public record DeleteGearCommand(string UserId, Guid Id) : IRequest<bool>;

public class DeleteGearCommandHandler : IRequestHandler<DeleteGearCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteGearCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteGearCommand request, CancellationToken ct)
    {
        var gear = await _db.Gear
            .FirstOrDefaultAsync(g => g.Id == request.Id && g.UserId == request.UserId, ct);
        if (gear is null) return false;
        _db.Gear.Remove(gear);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// --- Assign gear to activity ---

public record AssignGearToActivityCommand(string UserId, Guid ActivityId, Guid? GearId) : IRequest<bool>;

public class AssignGearToActivityCommandHandler : IRequestHandler<AssignGearToActivityCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public AssignGearToActivityCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(AssignGearToActivityCommand request, CancellationToken ct)
    {
        var activity = await _db.Activities
            .FirstOrDefaultAsync(a => a.Id == request.ActivityId && a.UserId == request.UserId, ct);
        if (activity is null) return false;

        // Validate gear belongs to user if provided
        if (request.GearId.HasValue)
        {
            var gearExists = await _db.Gear.AnyAsync(g => g.Id == request.GearId.Value && g.UserId == request.UserId, ct);
            if (!gearExists) return false;
        }

        activity.GearId = request.GearId;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
