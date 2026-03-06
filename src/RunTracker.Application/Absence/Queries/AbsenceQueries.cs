using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Absence.DTOs;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Application.Absence.Queries;

public record GetAbsenceDaysQuery(string UserId, DateTime From, DateTime To)
    : IRequest<List<AbsenceDayDto>>;

public class GetAbsenceDaysQueryHandler : IRequestHandler<GetAbsenceDaysQuery, List<AbsenceDayDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAbsenceDaysQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<AbsenceDayDto>> Handle(GetAbsenceDaysQuery request, CancellationToken ct)
    {
        return await _db.AbsenceDays
            .Where(a => a.UserId == request.UserId
                     && a.Date >= request.From
                     && a.Date <= request.To)
            .OrderBy(a => a.Date)
            .Select(a => new AbsenceDayDto(
                a.Id,
                a.Date.ToString("yyyy-MM-dd"),
                a.AbsenceType,
                a.Notes))
            .ToListAsync(ct);
    }
}
