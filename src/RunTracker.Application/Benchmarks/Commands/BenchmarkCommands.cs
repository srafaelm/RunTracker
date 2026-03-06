using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Benchmarks;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.Benchmarks.Commands;

// ── Create Item ───────────────────────────────────────────────────────────────

public record CreateBenchmarkItemCommand(string UserId, string Name, string? Category, int SortOrder)
    : IRequest<BenchmarkItemDto>;

public class CreateBenchmarkItemCommandHandler : IRequestHandler<CreateBenchmarkItemCommand, BenchmarkItemDto>
{
    private readonly IApplicationDbContext _db;
    public CreateBenchmarkItemCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<BenchmarkItemDto> Handle(CreateBenchmarkItemCommand request, CancellationToken ct)
    {
        var entity = new BenchmarkItem
        {
            UserId = request.UserId,
            Name = request.Name,
            Category = request.Category,
            SortOrder = request.SortOrder,
            IsActive = true,
        };
        _db.BenchmarkItems.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new BenchmarkItemDto(entity.Id, entity.Name, entity.Category, entity.SortOrder, 0, null, null, entity.IsActive);
    }
}

// ── Update Item ───────────────────────────────────────────────────────────────

public record UpdateBenchmarkItemCommand(string UserId, Guid Id, string Name, string? Category, int SortOrder, bool IsActive)
    : IRequest<BenchmarkItemDto?>;

public class UpdateBenchmarkItemCommandHandler : IRequestHandler<UpdateBenchmarkItemCommand, BenchmarkItemDto?>
{
    private readonly IApplicationDbContext _db;
    public UpdateBenchmarkItemCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<BenchmarkItemDto?> Handle(UpdateBenchmarkItemCommand request, CancellationToken ct)
    {
        var entity = await _db.BenchmarkItems
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == request.UserId, ct);
        if (entity is null) return null;

        entity.Name = request.Name;
        entity.Category = request.Category;
        entity.SortOrder = request.SortOrder;
        entity.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);

        var completionCount = await _db.BenchmarkCompletions.CountAsync(c => c.BenchmarkItemId == entity.Id, ct);
        var lastCompletion = await _db.BenchmarkCompletions
            .Where(c => c.BenchmarkItemId == entity.Id)
            .OrderByDescending(c => c.CompletedAt)
            .Select(c => new { c.Id, c.CompletedAt })
            .FirstOrDefaultAsync(ct);

        return new BenchmarkItemDto(entity.Id, entity.Name, entity.Category, entity.SortOrder,
            completionCount,
            lastCompletion?.CompletedAt,
            lastCompletion?.Id,
            entity.IsActive);
    }
}

// ── Delete Item ───────────────────────────────────────────────────────────────

public record DeleteBenchmarkItemCommand(string UserId, Guid Id) : IRequest<bool>;

public class DeleteBenchmarkItemCommandHandler : IRequestHandler<DeleteBenchmarkItemCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteBenchmarkItemCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteBenchmarkItemCommand request, CancellationToken ct)
    {
        var entity = await _db.BenchmarkItems
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == request.UserId, ct);
        if (entity is null) return false;

        // Remove completions first (cascade)
        var completions = await _db.BenchmarkCompletions
            .Where(c => c.BenchmarkItemId == entity.Id)
            .ToListAsync(ct);
        _db.BenchmarkCompletions.RemoveRange(completions);
        _db.BenchmarkItems.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// ── Log Completion ────────────────────────────────────────────────────────────

public record LogBenchmarkCompletionCommand(string UserId, Guid ItemId, DateTime? Date, string? Notes)
    : IRequest<BenchmarkCompletionDto?>;

public class LogBenchmarkCompletionCommandHandler : IRequestHandler<LogBenchmarkCompletionCommand, BenchmarkCompletionDto?>
{
    private readonly IApplicationDbContext _db;
    public LogBenchmarkCompletionCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<BenchmarkCompletionDto?> Handle(LogBenchmarkCompletionCommand request, CancellationToken ct)
    {
        var item = await _db.BenchmarkItems
            .FirstOrDefaultAsync(b => b.Id == request.ItemId && b.UserId == request.UserId, ct);
        if (item is null) return null;

        var completion = new BenchmarkCompletion
        {
            UserId = request.UserId,
            BenchmarkItemId = request.ItemId,
            CompletedAt = request.Date?.ToUniversalTime() ?? DateTime.UtcNow,
            Notes = request.Notes,
        };
        _db.BenchmarkCompletions.Add(completion);
        await _db.SaveChangesAsync(ct);
        return new BenchmarkCompletionDto(completion.Id, completion.BenchmarkItemId, item.Name, completion.CompletedAt, completion.Notes);
    }
}

// ── Delete Completion ─────────────────────────────────────────────────────────

public record DeleteBenchmarkCompletionCommand(string UserId, Guid CompletionId) : IRequest<bool>;

public class DeleteBenchmarkCompletionCommandHandler : IRequestHandler<DeleteBenchmarkCompletionCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteBenchmarkCompletionCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteBenchmarkCompletionCommand request, CancellationToken ct)
    {
        var completion = await _db.BenchmarkCompletions
            .FirstOrDefaultAsync(c => c.Id == request.CompletionId && c.UserId == request.UserId, ct);
        if (completion is null) return false;
        _db.BenchmarkCompletions.Remove(completion);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
