using RunTracker.Domain.Common;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class AbsenceDay : BaseEntity
{
    public string UserId { get; set; } = null!;
    public DateTime Date { get; set; }
    public AbsenceType AbsenceType { get; set; }
    public string? Notes { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
