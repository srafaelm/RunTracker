using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.Routes;

// --- DTOs ---

public record PlannedRouteDto(
    Guid Id,
    string Name,
    string? Description,
    double DistanceM,
    string? EncodedPolyline,
    DateTime CreatedAt);

public record CreatePlannedRouteRequest(
    string Name,
    string? Description,
    double DistanceM,
    string? EncodedPolyline);

// --- List ---

public record GetPlannedRoutesQuery(string UserId) : IRequest<List<PlannedRouteDto>>;

public class GetPlannedRoutesQueryHandler : IRequestHandler<GetPlannedRoutesQuery, List<PlannedRouteDto>>
{
    private readonly IApplicationDbContext _db;
    public GetPlannedRoutesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<PlannedRouteDto>> Handle(GetPlannedRoutesQuery request, CancellationToken ct)
    {
        return await _db.PlannedRoutes
            .Where(r => r.UserId == request.UserId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new PlannedRouteDto(r.Id, r.Name, r.Description, r.DistanceM, r.EncodedPolyline, r.CreatedAt))
            .ToListAsync(ct);
    }
}

// --- Get single ---

public record GetPlannedRouteQuery(string UserId, Guid Id) : IRequest<PlannedRouteDto?>;

public class GetPlannedRouteQueryHandler : IRequestHandler<GetPlannedRouteQuery, PlannedRouteDto?>
{
    private readonly IApplicationDbContext _db;
    public GetPlannedRouteQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PlannedRouteDto?> Handle(GetPlannedRouteQuery request, CancellationToken ct)
    {
        var r = await _db.PlannedRoutes
            .FirstOrDefaultAsync(r => r.Id == request.Id && r.UserId == request.UserId, ct);
        if (r is null) return null;
        return new PlannedRouteDto(r.Id, r.Name, r.Description, r.DistanceM, r.EncodedPolyline, r.CreatedAt);
    }
}

// --- Create ---

public record CreatePlannedRouteCommand(string UserId, CreatePlannedRouteRequest Data) : IRequest<PlannedRouteDto>;

public class CreatePlannedRouteCommandHandler : IRequestHandler<CreatePlannedRouteCommand, PlannedRouteDto>
{
    private readonly IApplicationDbContext _db;
    public CreatePlannedRouteCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<PlannedRouteDto> Handle(CreatePlannedRouteCommand request, CancellationToken ct)
    {
        var route = new PlannedRoute
        {
            UserId = request.UserId,
            Name = request.Data.Name,
            Description = request.Data.Description,
            DistanceM = request.Data.DistanceM,
            EncodedPolyline = request.Data.EncodedPolyline,
        };
        _db.PlannedRoutes.Add(route);
        await _db.SaveChangesAsync(ct);
        return new PlannedRouteDto(route.Id, route.Name, route.Description, route.DistanceM, route.EncodedPolyline, route.CreatedAt);
    }
}

// --- Delete ---

public record DeletePlannedRouteCommand(string UserId, Guid Id) : IRequest<bool>;

public class DeletePlannedRouteCommandHandler : IRequestHandler<DeletePlannedRouteCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeletePlannedRouteCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeletePlannedRouteCommand request, CancellationToken ct)
    {
        var route = await _db.PlannedRoutes
            .FirstOrDefaultAsync(r => r.Id == request.Id && r.UserId == request.UserId, ct);
        if (route is null) return false;
        _db.PlannedRoutes.Remove(route);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
