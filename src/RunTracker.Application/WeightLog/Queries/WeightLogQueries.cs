using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.WeightLog.DTOs;

namespace RunTracker.Application.WeightLog.Queries;

public record GetWeightLogQuery(string UserId) : IRequest<List<WeightEntryDto>>;

public class GetWeightLogQueryHandler : IRequestHandler<GetWeightLogQuery, List<WeightEntryDto>>
{
    private readonly IApplicationDbContext _db;
    public GetWeightLogQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<WeightEntryDto>> Handle(GetWeightLogQuery request, CancellationToken ct) =>
        await _db.WeightEntries
            .Where(w => w.UserId == request.UserId)
            .OrderBy(w => w.Date)
            .Select(w => new WeightEntryDto(w.Id, w.Date, w.WeightKg))
            .ToListAsync(ct);
}
