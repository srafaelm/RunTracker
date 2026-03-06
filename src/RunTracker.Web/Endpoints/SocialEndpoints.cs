using System.Security.Claims;
using MediatR;
using RunTracker.Application.Social;

namespace RunTracker.Web.Endpoints;

public static class SocialEndpoints
{
    public static void MapSocialEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/social").RequireAuthorization();

        group.MapPost("/follow/{targetUserId}", async (ISender mediator, ClaimsPrincipal user, string targetUserId) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await mediator.Send(new FollowUserCommand(userId, targetUserId));
            return Results.Ok();
        });

        group.MapDelete("/follow/{targetUserId}", async (ISender mediator, ClaimsPrincipal user, string targetUserId) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await mediator.Send(new UnfollowUserCommand(userId, targetUserId));
            return Results.Ok();
        });

        group.MapGet("/following", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetFollowingQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/followers", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetFollowersQuery(userId));
            return Results.Ok(result);
        });

        group.MapGet("/leaderboard", async (ISender mediator, ClaimsPrincipal user, string? period) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetLeaderboardQuery(userId, period ?? "weekly"));
            return Results.Ok(result);
        });

        group.MapGet("/feed", async (ISender mediator, ClaimsPrincipal user, int? page, int? pageSize) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetFriendFeedQuery(userId, page ?? 1, pageSize ?? 20));
            return Results.Ok(result);
        });

        group.MapGet("/users/search", async (ISender mediator, ClaimsPrincipal user, string q) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new FindUsersQuery(userId, q));
            return Results.Ok(result);
        });
    }
}
