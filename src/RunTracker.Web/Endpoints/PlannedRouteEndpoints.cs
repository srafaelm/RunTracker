using System.Security.Claims;
using MediatR;
using RunTracker.Application.Routes;
using RunTracker.Infrastructure.Services;

namespace RunTracker.Web.Endpoints;

public static class PlannedRouteEndpoints
{
    public static void MapPlannedRouteEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/routes").RequireAuthorization();

        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetPlannedRoutesQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetPlannedRouteQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        group.MapPost("/", async (ISender mediator, ClaimsPrincipal user, CreatePlannedRouteRequest body) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreatePlannedRouteCommand(userId, body));
            return Results.Created($"/api/routes/{result.Id}", result);
        });

        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var deleted = await mediator.Send(new DeletePlannedRouteCommand(userId, id));
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        group.MapPost("/generate", async (
            IRouteGenerationService generator,
            GenerateRouteRequest body,
            CancellationToken ct) =>
        {
            var result = await generator.GenerateAsync(
                body.StartLat, body.StartLng, body.TargetDistanceM, body.Seed, ct);

            return Results.Ok(new
            {
                waypoints = result.Waypoints.Select(w => new[] { w.Lat, w.Lng }).ToArray(),
                actualDistanceM = result.ActualDistanceM,
                source = result.Source,
            });
        });
    }
}

public record GenerateRouteRequest(
    double StartLat,
    double StartLng,
    double TargetDistanceM,
    int Seed = 0);
