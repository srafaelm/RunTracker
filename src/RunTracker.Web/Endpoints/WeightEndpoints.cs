using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using RunTracker.Application.WeightLog.Commands;
using RunTracker.Application.WeightLog.DTOs;
using RunTracker.Application.WeightLog.Queries;

namespace RunTracker.Web.Endpoints;

public static class WeightEndpoints
{
    public static void MapWeightEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/weight-log").RequireAuthorization();

        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetWeightLogQuery(userId)));
        });

        group.MapPost("/", async (ISender mediator, ClaimsPrincipal user, [FromBody] AddWeightEntryRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new AddWeightEntryCommand(userId, req.Date, req.WeightKg));
            return Results.Ok(result);
        });

        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await mediator.Send(new DeleteWeightEntryCommand(userId, id));
            return Results.NoContent();
        });
    }
}
