using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Application.Benchmarks.Queries;

// ── Get Items ─────────────────────────────────────────────────────────────────

public record GetBenchmarkItemsQuery(string UserId) : IRequest<List<BenchmarkItemDto>>;

public class GetBenchmarkItemsQueryHandler : IRequestHandler<GetBenchmarkItemsQuery, List<BenchmarkItemDto>>
{
    private readonly IApplicationDbContext _db;
    public GetBenchmarkItemsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BenchmarkItemDto>> Handle(GetBenchmarkItemsQuery request, CancellationToken ct)
    {
        var items = await _db.BenchmarkItems
            .Where(b => b.UserId == request.UserId)
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.CreatedAt)
            .ToListAsync(ct);

        var itemIds = items.Select(i => i.Id).ToList();

        // Get latest completion per item
        var latestCompletions = await _db.BenchmarkCompletions
            .Where(c => itemIds.Contains(c.BenchmarkItemId))
            .GroupBy(c => c.BenchmarkItemId)
            .Select(g => new
            {
                ItemId = g.Key,
                Count = g.Count(),
                LatestCompletion = g.OrderByDescending(c => c.CompletedAt).First(),
            })
            .ToListAsync(ct);

        var completionMap = latestCompletions.ToDictionary(x => x.ItemId);

        return items.Select(b =>
        {
            completionMap.TryGetValue(b.Id, out var comp);
            return new BenchmarkItemDto(
                b.Id, b.Name, b.Category, b.SortOrder,
                comp?.Count ?? 0,
                comp?.LatestCompletion.CompletedAt,
                comp?.LatestCompletion.Id,
                b.IsActive);
        }).ToList();
    }
}

// ── Get History ───────────────────────────────────────────────────────────────

public record GetBenchmarkHistoryQuery(string UserId, DateTime From, DateTime To)
    : IRequest<List<BenchmarkHistoryEntryDto>>;

public class GetBenchmarkHistoryQueryHandler : IRequestHandler<GetBenchmarkHistoryQuery, List<BenchmarkHistoryEntryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetBenchmarkHistoryQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<BenchmarkHistoryEntryDto>> Handle(GetBenchmarkHistoryQuery request, CancellationToken ct)
    {
        var totalActive = await _db.BenchmarkItems
            .CountAsync(b => b.UserId == request.UserId && b.IsActive, ct);

        var completions = await _db.BenchmarkCompletions
            .Where(c => c.UserId == request.UserId
                     && c.CompletedAt >= request.From
                     && c.CompletedAt <= request.To)
            .Select(c => new { c.BenchmarkItemId, c.CompletedAt, c.BenchmarkItem.Name })
            .ToListAsync(ct);

        // Group by date, deduplicate items per day
        var grouped = completions
            .GroupBy(c => DateOnly.FromDateTime(c.CompletedAt.ToLocalTime()))
            .Select(g =>
            {
                var distinctItems = g
                    .GroupBy(x => x.BenchmarkItemId)
                    .Select(x => x.First().Name)
                    .OrderBy(n => n)
                    .ToList();
                return new BenchmarkHistoryEntryDto(
                    g.Key,
                    distinctItems.Count,
                    totalActive,
                    distinctItems);
            })
            .OrderByDescending(e => e.Date)
            .ToList();

        return grouped;
    }
}
