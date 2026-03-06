using System.Security.Claims;
using MediatR;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Streets.DTOs;
using RunTracker.Application.Streets.Queries;

namespace RunTracker.Web.Endpoints;

public static class StreetEndpoints
{
    public static void MapStreetEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/cities").RequireAuthorization();

        // List all imported cities with user progress
        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetCityListQuery(userId));
            return Results.Ok(result);
        });

        // Get city detail
        group.MapGet("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetCityDetailQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // Get streets for a city (paginated)
        group.MapGet("/{id:guid}/streets", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id,
            int? page,
            int? pageSize) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetCityStreetsQuery(userId, id, page ?? 1, pageSize ?? 50));
            return Results.Ok(result);
        });

        // Get GeoJSON for a city's streets with completion status
        group.MapGet("/{id:guid}/geojson", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var features = await mediator.Send(new GetCityGeoJsonQuery(userId, id));

            // Build GeoJSON FeatureCollection
            var featureCollection = new
            {
                type = "FeatureCollection",
                features = features.Select(f => new
                {
                    type = "Feature",
                    geometry = new
                    {
                        type = "LineString",
                        coordinates = f.Coordinates,
                    },
                    properties = new
                    {
                        streetId = f.StreetId,
                        name = f.Name,
                        highwayType = f.HighwayType,
                        isCompleted = f.IsCompleted,
                        completionPercentage = f.CompletionPercentage,
                    },
                }),
            };
            return Results.Ok(featureCollection);
        });

        // Get a suggested route for uncompleted streets near a given location
        group.MapGet("/{id:guid}/route-suggestion", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id,
            double? lat,
            double? lon,
            double? radiusKm) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetRouteSuggestionQuery(userId, id, lat, lon, radiusKm ?? 8));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // Reprocess all activities for street matching
        group.MapPost("/reprocess", async (IStreetMatchingService matchingService, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var matched = await matchingService.MatchAllActivitiesAsync(userId);
            return Results.Ok(new { matchedNodes = matched, message = $"Matched {matched} new street nodes" });
        });

        // Import a city from OSM (admin-style endpoint)
        group.MapPost("/import", async (IOsmService osmService, ImportCityRequest request) =>
        {
            try
            {
                var city = await osmService.ImportCityAsync(
                    request.OsmRelationId, request.Name, request.Region, request.Country);
                return Results.Ok(new
                {
                    city.Id,
                    city.Name,
                    city.TotalStreets,
                    city.TotalNodes,
                    message = $"Imported {city.TotalStreets} streets with {city.TotalNodes} nodes"
                });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }
}
