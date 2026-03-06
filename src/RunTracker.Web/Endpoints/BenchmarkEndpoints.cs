using System.Security.Claims;
using MediatR;
using RunTracker.Application.Benchmarks.Commands;
using RunTracker.Application.Benchmarks.Queries;

namespace RunTracker.Web.Endpoints;

public static class BenchmarkEndpoints
{
    public static void MapBenchmarkEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/benchmarks").RequireAuthorization();

        // List items
        group.MapGet("/items", async (ISender mediator, ClaimsPrincipal user) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new GetBenchmarkItemsQuery(userId));
            return Results.Ok(result);
        });

        // Create item
        group.MapPost("/items", async (ISender mediator, ClaimsPrincipal user, CreateBenchmarkItemRequest body) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new CreateBenchmarkItemCommand(userId, body.Name, body.Category, body.SortOrder));
            return Results.Created($"/api/benchmarks/items/{result.Id}", result);
        });

        // Update item
        group.MapPut("/items/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id, UpdateBenchmarkItemRequest body) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new UpdateBenchmarkItemCommand(userId, id, body.Name, body.Category, body.SortOrder, body.IsActive));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // Delete item
        group.MapDelete("/items/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var deleted = await mediator.Send(new DeleteBenchmarkItemCommand(userId, id));
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        // Log completion
        group.MapPost("/items/{id:guid}/complete", async (ISender mediator, ClaimsPrincipal user, Guid id, LogCompletionRequest body) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await mediator.Send(new LogBenchmarkCompletionCommand(userId, id, body.Date, body.Notes));
            return result is not null ? Results.Ok(result) : Results.NotFound();
        });

        // Delete completion
        group.MapDelete("/completions/{id:guid}", async (ISender mediator, ClaimsPrincipal user, Guid id) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var deleted = await mediator.Send(new DeleteBenchmarkCompletionCommand(userId, id));
            return deleted ? Results.NoContent() : Results.NotFound();
        });

        // History
        group.MapGet("/history", async (ISender mediator, ClaimsPrincipal user,
            DateTime? from, DateTime? to) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var fromDate = from ?? DateTime.UtcNow.AddYears(-1);
            var toDate = to ?? DateTime.UtcNow;
            var result = await mediator.Send(new GetBenchmarkHistoryQuery(userId, fromDate, toDate));
            return Results.Ok(result);
        });
    }
}

public record CreateBenchmarkItemRequest(string Name, string? Category, int SortOrder = 0);
public record UpdateBenchmarkItemRequest(string Name, string? Category, int SortOrder, bool IsActive);
public record LogCompletionRequest(DateTime? Date, string? Notes);
