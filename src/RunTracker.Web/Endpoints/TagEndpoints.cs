using System.Security.Claims;
using MediatR;
using RunTracker.Application.Tags;

namespace RunTracker.Web.Endpoints;

public static class TagEndpoints
{
    public static void MapTagEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/tags").RequireAuthorization();

        // GET /api/tags — list user's tags
        group.MapGet("", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetTagsQuery(userId)));
        });

        // POST /api/tags — create tag
        group.MapPost("", async (ISender mediator, ClaimsPrincipal user, CreateTagRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var tag = await mediator.Send(new CreateTagCommand(userId, req.Name, req.Color));
            return Results.Created($"/api/tags/{tag.Id}", tag);
        });

        // DELETE /api/tags/{id}
        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await mediator.Send(new DeleteTagCommand(userId, id));
            return Results.NoContent();
        });

        // GET /api/tags/activity/{activityId}
        group.MapGet("/activity/{activityId:guid}", async (ISender mediator, ClaimsPrincipal user, Guid activityId) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetActivityTagsQuery(userId, activityId)));
        });

        // POST /api/tags/activity/{activityId}/{tagId}
        group.MapPost("/activity/{activityId:guid}/{tagId:guid}", async (ISender mediator, ClaimsPrincipal user, Guid activityId, Guid tagId) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new AddTagToActivityCommand(userId, activityId, tagId));
            return ok ? Results.Ok() : Results.NotFound();
        });

        // DELETE /api/tags/activity/{activityId}/{tagId}
        group.MapDelete("/activity/{activityId:guid}/{tagId:guid}", async (ISender mediator, ClaimsPrincipal user, Guid activityId, Guid tagId) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await mediator.Send(new RemoveTagFromActivityCommand(userId, activityId, tagId));
            return Results.NoContent();
        });
    }
}

public record CreateTagRequest(string Name, string? Color);
