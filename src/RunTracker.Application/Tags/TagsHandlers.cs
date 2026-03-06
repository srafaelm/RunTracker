using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.Tags;

// --- DTOs ---
public record TagDto(Guid Id, string Name, string? Color);

// --- Queries ---
public record GetTagsQuery(string UserId) : IRequest<List<TagDto>>;

public class GetTagsQueryHandler : IRequestHandler<GetTagsQuery, List<TagDto>>
{
    private readonly IApplicationDbContext _db;
    public GetTagsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<TagDto>> Handle(GetTagsQuery request, CancellationToken ct) =>
        await _db.Tags
            .Where(t => t.UserId == request.UserId)
            .OrderBy(t => t.Name)
            .Select(t => new TagDto(t.Id, t.Name, t.Color))
            .ToListAsync(ct);
}

public record GetActivityTagsQuery(string UserId, Guid ActivityId) : IRequest<List<TagDto>>;

public class GetActivityTagsQueryHandler : IRequestHandler<GetActivityTagsQuery, List<TagDto>>
{
    private readonly IApplicationDbContext _db;
    public GetActivityTagsQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<TagDto>> Handle(GetActivityTagsQuery request, CancellationToken ct) =>
        await _db.ActivityTags
            .Where(at => at.ActivityId == request.ActivityId && at.Tag.UserId == request.UserId)
            .Select(at => new TagDto(at.Tag.Id, at.Tag.Name, at.Tag.Color))
            .ToListAsync(ct);
}

// --- Commands ---
public record CreateTagCommand(string UserId, string Name, string? Color) : IRequest<TagDto>;

public class CreateTagCommandHandler : IRequestHandler<CreateTagCommand, TagDto>
{
    private readonly IApplicationDbContext _db;
    public CreateTagCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<TagDto> Handle(CreateTagCommand request, CancellationToken ct)
    {
        var tag = new Tag { UserId = request.UserId, Name = request.Name.Trim(), Color = request.Color };
        _db.Tags.Add(tag);
        await _db.SaveChangesAsync(ct);
        return new TagDto(tag.Id, tag.Name, tag.Color);
    }
}

public record DeleteTagCommand(string UserId, Guid TagId) : IRequest;

public class DeleteTagCommandHandler : IRequestHandler<DeleteTagCommand>
{
    private readonly IApplicationDbContext _db;
    public DeleteTagCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task Handle(DeleteTagCommand request, CancellationToken ct)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Id == request.TagId && t.UserId == request.UserId, ct);
        if (tag is null) return;
        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync(ct);
    }
}

public record AddTagToActivityCommand(string UserId, Guid ActivityId, Guid TagId) : IRequest<bool>;

public class AddTagToActivityCommandHandler : IRequestHandler<AddTagToActivityCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public AddTagToActivityCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(AddTagToActivityCommand request, CancellationToken ct)
    {
        // Verify tag belongs to user
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Id == request.TagId && t.UserId == request.UserId, ct);
        if (tag is null) return false;

        var exists = await _db.ActivityTags.AnyAsync(at => at.ActivityId == request.ActivityId && at.TagId == request.TagId, ct);
        if (exists) return true;

        _db.ActivityTags.Add(new ActivityTag { ActivityId = request.ActivityId, TagId = request.TagId });
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

public record RemoveTagFromActivityCommand(string UserId, Guid ActivityId, Guid TagId) : IRequest;

public class RemoveTagFromActivityCommandHandler : IRequestHandler<RemoveTagFromActivityCommand>
{
    private readonly IApplicationDbContext _db;
    public RemoveTagFromActivityCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task Handle(RemoveTagFromActivityCommand request, CancellationToken ct)
    {
        var at = await _db.ActivityTags.FirstOrDefaultAsync(
            x => x.ActivityId == request.ActivityId && x.TagId == request.TagId && x.Tag.UserId == request.UserId, ct);
        if (at is null) return;
        _db.ActivityTags.Remove(at);
        await _db.SaveChangesAsync(ct);
    }
}
