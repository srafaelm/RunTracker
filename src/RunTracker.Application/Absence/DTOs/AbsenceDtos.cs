using RunTracker.Domain.Enums;

namespace RunTracker.Application.Absence.DTOs;

public record AbsenceDayDto(
    Guid Id,
    string Date,       // "YYYY-MM-DD"
    AbsenceType AbsenceType,
    string? Notes
);
