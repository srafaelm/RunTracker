using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Common.Models;
using RunTracker.Application.Streets.DTOs;

namespace RunTracker.Application.Streets.Queries;

// --- GetCityList ---
public record GetCityListQuery(string UserId) : IRequest<List<CityListItemDto>>;

public class GetCityListQueryHandler : IRequestHandler<GetCityListQuery, List<CityListItemDto>>
{
    private readonly IApplicationDbContext _db;

    public GetCityListQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<CityListItemDto>> Handle(GetCityListQuery request, CancellationToken ct)
    {
        var cities = await _db.Cities
            .OrderBy(c => c.Country).ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Region,
                c.Country,
                c.TotalStreets,
                c.TotalNodes,
            })
            .ToListAsync(ct);

        // Get user progress for all cities
        var progressMap = await _db.UserCityProgress
            .Where(p => p.UserId == request.UserId)
            .ToDictionaryAsync(p => p.CityId, ct);

        return cities.Select(c =>
        {
            progressMap.TryGetValue(c.Id, out var progress);
            return new CityListItemDto(
                c.Id, c.Name, c.Region, c.Country,
                c.TotalStreets, c.TotalNodes,
                progress?.CompletedStreets ?? 0,
                progress?.CompletedNodes ?? 0,
                progress?.CompletionPercentage ?? 0
            );
        }).ToList();
    }
}

// --- GetCityDetail ---
public record GetCityDetailQuery(string UserId, Guid CityId) : IRequest<CityDetailDto?>;

public class GetCityDetailQueryHandler : IRequestHandler<GetCityDetailQuery, CityDetailDto?>
{
    private readonly IApplicationDbContext _db;

    public GetCityDetailQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<CityDetailDto?> Handle(GetCityDetailQuery request, CancellationToken ct)
    {
        var city = await _db.Cities.FirstOrDefaultAsync(c => c.Id == request.CityId, ct);
        if (city is null) return null;

        var progress = await _db.UserCityProgress
            .FirstOrDefaultAsync(p => p.UserId == request.UserId && p.CityId == city.Id, ct);

        return new CityDetailDto(
            city.Id, city.Name, city.Region, city.Country, city.OsmRelationId,
            city.TotalStreets, city.TotalNodes,
            progress?.CompletedStreets ?? 0,
            progress?.CompletedNodes ?? 0,
            progress?.CompletionPercentage ?? 0
        );
    }
}

// --- GetCityStreets ---
public record GetCityStreetsQuery(string UserId, Guid CityId, int Page = 1, int PageSize = 50)
    : IRequest<PaginatedList<StreetDto>>;

public class GetCityStreetsQueryHandler : IRequestHandler<GetCityStreetsQuery, PaginatedList<StreetDto>>
{
    private readonly IApplicationDbContext _db;

    public GetCityStreetsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PaginatedList<StreetDto>> Handle(GetCityStreetsQuery request, CancellationToken ct)
    {
        var query = _db.Streets.Where(s => s.CityId == request.CityId);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderBy(s => s.Name)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.HighwayType,
                s.NodeCount,
                s.TotalLengthMeters,
                CompletedNodes = _db.UserStreetNodes
                    .Count(usn => usn.UserId == request.UserId && usn.StreetNode.StreetId == s.Id),
            })
            .ToListAsync(ct);

        var dtos = items.Select(s =>
        {
            var completionPct = s.NodeCount > 0 ? (double)s.CompletedNodes / s.NodeCount * 100 : 0;
            var isCompleted = s.NodeCount > 0 && (double)s.CompletedNodes / s.NodeCount >= 0.9;
            return new StreetDto(
                s.Id, s.Name, s.HighwayType, s.NodeCount, s.TotalLengthMeters,
                s.CompletedNodes, isCompleted, Math.Round(completionPct, 1)
            );
        }).ToList();

        return new PaginatedList<StreetDto>(dtos, totalCount, request.Page, request.PageSize);
    }
}

// --- GetCityGeoJson ---
public record GetCityGeoJsonQuery(string UserId, Guid CityId) : IRequest<List<CityGeoJsonFeatureDto>>;

public class GetCityGeoJsonQueryHandler : IRequestHandler<GetCityGeoJsonQuery, List<CityGeoJsonFeatureDto>>
{
    private readonly IApplicationDbContext _db;

    public GetCityGeoJsonQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<CityGeoJsonFeatureDto>> Handle(GetCityGeoJsonQuery request, CancellationToken ct)
    {
        var streets = await _db.Streets
            .Where(s => s.CityId == request.CityId && s.Geometry != null)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.HighwayType,
                s.NodeCount,
                s.Geometry,
                CompletedNodes = _db.UserStreetNodes
                    .Count(usn => usn.UserId == request.UserId && usn.StreetNode.StreetId == s.Id),
            })
            .ToListAsync(ct);

        return streets.Select(s =>
        {
            var coordinates = s.Geometry!.Coordinates
                .Select(c => new[] { c.X, c.Y }) // [lng, lat]
                .ToArray();
            var completionPct = s.NodeCount > 0 ? (double)s.CompletedNodes / s.NodeCount * 100 : 0;
            var isCompleted = s.NodeCount > 0 && (double)s.CompletedNodes / s.NodeCount >= 0.9;
            return new CityGeoJsonFeatureDto(
                s.Id, s.Name, s.HighwayType, coordinates,
                isCompleted, Math.Round(completionPct, 1)
            );
        }).ToList();
    }
}

// --- GetRouteSuggestion ---
public record GetRouteSuggestionQuery(
    string UserId,
    Guid CityId,
    double? NearLat,
    double? NearLon,
    double RadiusKm = 8
) : IRequest<RouteSuggestionDto?>;

public class GetRouteSuggestionQueryHandler : IRequestHandler<GetRouteSuggestionQuery, RouteSuggestionDto?>
{
    private readonly IApplicationDbContext _db;

    public GetRouteSuggestionQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<RouteSuggestionDto?> Handle(GetRouteSuggestionQuery request, CancellationToken ct)
    {
        var cityExists = await _db.Cities.AnyAsync(c => c.Id == request.CityId, ct);
        if (!cityExists) return null;

        // Get uncompleted street nodes (not yet visited by user)
        var allNodes = await _db.StreetNodes
            .Where(sn => sn.Street.CityId == request.CityId && sn.Location != null)
            .Where(sn => !_db.UserStreetNodes.Any(usn => usn.UserId == request.UserId && usn.StreetNodeId == sn.Id))
            .Select(sn => new { sn.Id, sn.StreetId, Lat = sn.Location!.Y, Lon = sn.Location!.X })
            .Take(2000)
            .ToListAsync(ct);

        if (allNodes.Count == 0) return null;

        // Determine start point
        double startLat = request.NearLat ?? allNodes.Average(n => n.Lat);
        double startLon = request.NearLon ?? allNodes.Average(n => n.Lon);

        // Filter to nodes within the radius
        double radiusM = request.RadiusKm * 1000;
        var nearby = allNodes
            .Where(n => HaversineM(startLat, startLon, n.Lat, n.Lon) <= radiusM)
            .ToList();

        if (nearby.Count == 0) nearby = allNodes.Take(100).ToList();

        // Greedy nearest-neighbour route (cap at 10 km)
        const double MaxRouteM = 10_000;
        var visited = new HashSet<int>();
        var route = new List<(double lat, double lon)> { (startLat, startLon) };
        var streetIds = new HashSet<Guid>();
        double totalM = 0;
        double curLat = startLat, curLon = startLon;

        while (visited.Count < nearby.Count && totalM < MaxRouteM)
        {
            int bestIdx = -1;
            double bestDist = double.MaxValue;
            for (int i = 0; i < nearby.Count; i++)
            {
                if (visited.Contains(i)) continue;
                var d = HaversineM(curLat, curLon, nearby[i].Lat, nearby[i].Lon);
                if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            if (bestIdx < 0 || totalM + bestDist > MaxRouteM) break;
            totalM += bestDist;
            var node = nearby[bestIdx];
            route.Add((node.Lat, node.Lon));
            streetIds.Add(node.StreetId);
            visited.Add(bestIdx);
            curLat = node.Lat;
            curLon = node.Lon;
        }

        // Close loop back to start
        totalM += HaversineM(curLat, curLon, startLat, startLon);
        route.Add((startLat, startLon));

        var polyline = EncodePolyline(route);
        return new RouteSuggestionDto(polyline, Math.Round(totalM, 0), streetIds.Count, route.Count - 2);
    }

    private static double HaversineM(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static string EncodePolyline(IEnumerable<(double lat, double lon)> coords)
    {
        var sb = new StringBuilder();
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
        var sb = new StringBuilder();
        while (value >= 0x20)
        {
            sb.Append((char)((0x20 | (value & 0x1f)) + 63));
            value >>= 5;
        }
        sb.Append((char)(value + 63));
        return sb.ToString();
    }
}
