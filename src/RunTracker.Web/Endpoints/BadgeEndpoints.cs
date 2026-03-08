using System.Security.Claims;
using MediatR;
using RunTracker.Application.Badges.Commands;
using RunTracker.Application.Badges.Queries;
using RunTracker.Application.Common.Interfaces;

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

        group.MapPost("/recalculate", async (IBadgeService badgeService, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            await badgeService.CheckAndAwardBadgesAsync(userId, ct);
            return Results.Ok(new { message = "Badge recalculation complete." });
        });

        // ── Admin routes ─────────────────────────────────────────────────────

        var admin = routes.MapGroup("/api/admin/badges").RequireAuthorization();

        admin.MapGet("/", async (ISender mediator) =>
        {
            var result = await mediator.Send(new GetAllBadgesAdminQuery());
            return Results.Ok(result);
        });

        admin.MapPut("/{id:int}/archive", async (int id, ISender mediator) =>
        {
            var ok = await mediator.Send(new ArchiveBadgeCommand(id));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        admin.MapPut("/{id:int}/unarchive", async (int id, ISender mediator) =>
        {
            var ok = await mediator.Send(new UnarchiveBadgeCommand(id));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        admin.MapPatch("/{id:int}/sort-order", async (int id, SortOrderRequest req, ISender mediator) =>
        {
            var ok = await mediator.Send(new UpdateBadgeSortOrderCommand(id, req.SortOrder));
            return ok ? Results.NoContent() : Results.NotFound();
        });
    }

    private record SortOrderRequest(int SortOrder);
}
