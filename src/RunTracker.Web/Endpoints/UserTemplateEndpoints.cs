using System.Security.Claims;
using MediatR;
using RunTracker.Application.Training.UserTemplates;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class UserTemplateEndpoints
{
    public static void MapUserTemplateEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/training-templates").RequireAuthorization();

        // GET /api/training-templates
        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await mediator.Send(new GetUserTemplatesQuery(userId)));
        });

        // POST /api/training-templates
        group.MapPost("/", async (ISender mediator, ClaimsPrincipal user, CreateUserTemplateRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateUserTemplateCommand(
                userId, req.Name, req.Description,
                req.Workouts.Select(w => new UserTemplateWorkoutRequest(w.DaysFromRace, w.Title, w.WorkoutType, w.DistanceMeters, w.Notes)).ToList()
            ));
            return Results.Created($"/api/training-templates/{result.Id}", result);
        });

        // PUT /api/training-templates/{id}
        group.MapPut("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id, CreateUserTemplateRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new UpdateUserTemplateCommand(
                userId, id, req.Name, req.Description,
                req.Workouts.Select(w => new UserTemplateWorkoutRequest(w.DaysFromRace, w.Title, w.WorkoutType, w.DistanceMeters, w.Notes)).ToList()
            ));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // DELETE /api/training-templates/{id}
        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new DeleteUserTemplateCommand(userId, id));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // POST /api/training-templates/{id}/apply
        group.MapPost("/{id:guid}/apply", async (ISender mediator, ClaimsPrincipal user, Guid id, ApplyUserTemplateRequest req) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var multiplier = Math.Clamp(req.IntensityMultiplier ?? 1.0, 0.7, 1.2);
            var count = await mediator.Send(new ApplyUserTemplateCommand(userId, id, req.RaceDate, multiplier));
            return Results.Ok(new { created = count });
        });
    }
}

public record TemplateWorkoutRequest(
    int DaysFromRace,
    string Title,
    WorkoutType WorkoutType,
    double? DistanceMeters = null,
    string? Notes = null
);

public record CreateUserTemplateRequest(
    string Name,
    string? Description,
    List<TemplateWorkoutRequest> Workouts
);

public record ApplyUserTemplateRequest(DateTime RaceDate, double? IntensityMultiplier = null);
