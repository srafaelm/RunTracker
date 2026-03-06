using System.Security.Claims;
using MediatR;
using RunTracker.Application.Dashboard.Commands;
using RunTracker.Application.Dashboard.Queries;

namespace RunTracker.Web.Endpoints;

public static class DashboardEndpoints
{
    public static void MapDashboardEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/dashboard").RequireAuthorization();

        // GET /api/dashboard/templates
        group.MapGet("/templates", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetDashboardTemplatesQuery(userId));
            return Results.Ok(result);
        });

        // POST /api/dashboard/templates
        group.MapPost("/templates", async (ISender mediator, ClaimsPrincipal user, CreateTemplateRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateDashboardTemplateCommand(userId, request.Name, request.Widgets));
            return Results.Created($"/api/dashboard/templates/{result.Id}", result);
        });

        // PUT /api/dashboard/templates/{id}
        group.MapPut("/templates/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id, UpdateTemplateRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new UpdateDashboardTemplateCommand(userId, id, request.Name, request.Widgets));
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        // DELETE /api/dashboard/templates/{id}
        group.MapDelete("/templates/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var (success, error) = await mediator.Send(new DeleteDashboardTemplateCommand(userId, id));
            if (!success && error != null) return Results.BadRequest(new { error });
            return success ? Results.NoContent() : Results.NotFound();
        });

        // POST /api/dashboard/templates/{id}/activate
        group.MapPost("/templates/{id:guid}/activate", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new SetActiveDashboardTemplateCommand(userId, id));
            return ok ? Results.NoContent() : Results.NotFound();
        });
    }
}

public record CreateTemplateRequest(string Name, string[] Widgets);
public record UpdateTemplateRequest(string Name, string[] Widgets);
