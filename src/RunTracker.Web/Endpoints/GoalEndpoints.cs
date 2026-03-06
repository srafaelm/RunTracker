using System.Security.Claims;
using MediatR;
using RunTracker.Application.Goals;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class GoalEndpoints
{
    public static void MapGoalEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/goals").RequireAuthorization();

        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetGoalsQuery(userId)));
        });

        group.MapPost("/", async (
            ISender mediator,
            ClaimsPrincipal user,
            CreateGoalRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateGoalCommand(
                userId, req.SportType, req.Period, req.TargetDistanceKm));
            return Results.Ok(result);
        });

        group.MapPut("/{id:guid}", async (
            ISender mediator,
            ClaimsPrincipal user,
            Guid id,
            UpdateGoalRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new UpdateGoalCommand(userId, id, req.TargetDistanceKm));
            return ok ? Results.Ok() : Results.NotFound();
        });

        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new DeleteGoalCommand(userId, id));
            return ok ? Results.Ok() : Results.NotFound();
        });

        // GET /api/goals/history — last 12 months achievement rate (monthly goals)
        group.MapGet("/history", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetGoalHistoryQuery(userId)));
        });
    }
}

public record CreateGoalRequest(SportType? SportType, GoalPeriod Period, double TargetDistanceKm);
public record UpdateGoalRequest(double TargetDistanceKm);
