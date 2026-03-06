using System.Security.Claims;
using MediatR;
using RunTracker.Application.Badges.Queries;

namespace RunTracker.Web.Endpoints;

public static class BadgeEndpoints
{
    public static void MapBadgeEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/badges").RequireAuthorization();

        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetUserBadgesQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/all", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetAllBadgesQuery(userId));
            return Results.Ok(result);
        });
    }
}
