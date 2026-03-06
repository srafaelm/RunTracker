using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.WeightLog.DTOs;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.WeightLog.Commands;

public record AddWeightEntryCommand(string UserId, DateOnly Date, double WeightKg) : IRequest<WeightEntryDto>;

public class AddWeightEntryCommandHandler : IRequestHandler<AddWeightEntryCommand, WeightEntryDto>
{
    private readonly IApplicationDbContext _db;
    public AddWeightEntryCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<WeightEntryDto> Handle(AddWeightEntryCommand request, CancellationToken ct)
    {
        var existing = await _db.WeightEntries
            .FirstOrDefaultAsync(w => w.UserId == request.UserId && w.Date == request.Date, ct);

        if (existing is not null)
        {
            existing.WeightKg = request.WeightKg;
        }
        else
        {
            existing = new WeightEntry
            {
                UserId = request.UserId,
                Date = request.Date,
                WeightKg = request.WeightKg,
            };
            _db.WeightEntries.Add(existing);
        }

        await _db.SaveChangesAsync(ct);
        return new WeightEntryDto(existing.Id, existing.Date, existing.WeightKg);
    }
}

public record DeleteWeightEntryCommand(string UserId, Guid EntryId) : IRequest;

public class DeleteWeightEntryCommandHandler : IRequestHandler<DeleteWeightEntryCommand>
{
    private readonly IApplicationDbContext _db;
    public DeleteWeightEntryCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task Handle(DeleteWeightEntryCommand request, CancellationToken ct)
    {
        var entry = await _db.WeightEntries
            .FirstOrDefaultAsync(w => w.UserId == request.UserId && w.Id == request.EntryId, ct);
        if (entry is null) return;
        _db.WeightEntries.Remove(entry);
        await _db.SaveChangesAsync(ct);
    }
}
