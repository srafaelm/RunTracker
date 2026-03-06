using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using RunTracker.Application.Gear;
using RunTracker.Application.GearTracking;

namespace RunTracker.Web.Endpoints;

public static class GearEndpoints
{
    public static void MapGearEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/gear").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetGearListQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/{id:guid}", async (ClaimsPrincipal user, Guid id, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetGearQuery(userId, id));
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/", async (ClaimsPrincipal user, [FromBody] CreateGearRequest request, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateGearCommand(userId, request));
            return Results.Created($"/api/gear/{result.Id}", result);
        });

        group.MapPut("/{id:guid}", async (ClaimsPrincipal user, Guid id, [FromBody] UpdateGearRequest request, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new UpdateGearCommand(userId, id, request));
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapDelete("/{id:guid}", async (ClaimsPrincipal user, Guid id, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new DeleteGearCommand(userId, id));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // Assign/unassign gear to an activity
        group.MapPost("/assign", async (ClaimsPrincipal user, [FromBody] AssignGearRequest request, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new AssignGearToActivityCommand(userId, request.ActivityId, request.GearId));
            return ok ? Results.Ok() : Results.NotFound();
        });

        // GET /api/gear/{id}/shoe-analysis
        group.MapGet("/{id:guid}/shoe-analysis", async (ClaimsPrincipal user, Guid id, IMediator mediator) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetShoeAnalysisQuery(userId, id));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });
    }
}

public record AssignGearRequest(Guid ActivityId, Guid? GearId);
