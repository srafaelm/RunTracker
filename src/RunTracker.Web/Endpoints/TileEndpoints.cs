using System.Security.Claims;
using MediatR;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Tiles.Queries;

namespace RunTracker.Web.Endpoints;

public static class TileEndpoints
{
    public static void MapTileEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/tiles").RequireAuthorization();

        group.MapGet("/stats", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetTileStatsQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/geojson", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var features = await mediator.Send(new GetTileGeoJsonQuery(userId));

            var featureCollection = new
            {
                type = "FeatureCollection",
                features = features.Select(f => new
                {
                    type = "Feature",
                    geometry = new
                    {
                        type = "Polygon",
                        coordinates = new[]
                        {
                            new[]
                            {
                                new[] { f.LonWest, f.LatSouth },
                                new[] { f.LonEast, f.LatSouth },
                                new[] { f.LonEast, f.LatNorth },
                                new[] { f.LonWest, f.LatNorth },
                                new[] { f.LonWest, f.LatSouth },
                            }
                        }
                    },
                    properties = new { f.TileX, f.TileY },
                }),
            };

            return Results.Ok(featureCollection);
        });

        group.MapPost("/reprocess", async (ITileService tileService, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await tileService.ProcessAllActivitiesAsync(userId);
            return Results.Ok(new { message = "Tile reprocess complete" });
        });

        group.MapGet("/advanced-stats", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetAdvancedExplorationQuery(userId));
            return Results.Ok(result);
        });
    }
}
