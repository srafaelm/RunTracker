using System.Security.Claims;
using MediatR;
using RunTracker.Application.Absence.Commands;
using RunTracker.Application.Absence.Queries;
using RunTracker.Domain.Enums;

namespace RunTracker.Web.Endpoints;

public static class AbsenceEndpoints
{
    public static void MapAbsenceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/absence").RequireAuthorization();

        // GET /api/absence?from=YYYY-MM-DD&to=YYYY-MM-DD
        group.MapGet("/", async (ISender mediator, ClaimsPrincipal user, string? from, string? to) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fromDate = from != null ? DateTime.Parse(from) : DateTime.Today.AddMonths(-1);
            var toDate = to != null ? DateTime.Parse(to) : DateTime.Today.AddMonths(1);
            var result = await mediator.Send(new GetAbsenceDaysQuery(userId, fromDate, toDate));
            return Results.Ok(result);
        });

        // POST /api/absence
        group.MapPost("/", async (ISender mediator, ClaimsPrincipal user, CreateAbsenceDayRequest request) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateAbsenceDayCommand(userId, request.Date, request.AbsenceType, request.Notes));
            return Results.Created($"/api/absence/{result.Id}", result);
        });

        // DELETE /api/absence/{id}
        group.MapDelete("/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await mediator.Send(new DeleteAbsenceDayCommand(userId, id));
            return ok ? Results.NoContent() : Results.NotFound();
        });
    }
}

public record CreateAbsenceDayRequest(string Date, AbsenceType AbsenceType, string? Notes = null);
