using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Absence.DTOs;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Absence.Commands;

// Create
public record CreateAbsenceDayCommand(string UserId, string Date, AbsenceType AbsenceType, string? Notes)
    : IRequest<AbsenceDayDto>;

public class CreateAbsenceDayCommandHandler : IRequestHandler<CreateAbsenceDayCommand, AbsenceDayDto>
{
    private readonly IApplicationDbContext _db;
    public CreateAbsenceDayCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<AbsenceDayDto> Handle(CreateAbsenceDayCommand request, CancellationToken ct)
    {
        var entity = new AbsenceDay
        {
            UserId = request.UserId,
            Date = DateTime.Parse(request.Date),
            AbsenceType = request.AbsenceType,
            Notes = request.Notes,
        };
        _db.AbsenceDays.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new AbsenceDayDto(entity.Id, request.Date, entity.AbsenceType, entity.Notes);
    }
}

// Delete
public record DeleteAbsenceDayCommand(string UserId, Guid Id) : IRequest<bool>;

public class DeleteAbsenceDayCommandHandler : IRequestHandler<DeleteAbsenceDayCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteAbsenceDayCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteAbsenceDayCommand request, CancellationToken ct)
    {
        var entity = await _db.AbsenceDays
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.UserId == request.UserId, ct);
        if (entity is null) return false;
        _db.AbsenceDays.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
