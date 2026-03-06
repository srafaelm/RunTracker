using RunTracker.Domain.Enums;

namespace RunTracker.Application.Goals;

public record GoalDto(
    Guid Id,
    SportType? SportType,
    GoalPeriod Period,
    double TargetDistanceKm,
    bool IsActive,
    double CurrentDistanceKm,
    double ProgressPct
);

public record GoalHistoryMonthDto(
    string Month,      // 'YYYY-MM'
    int GoalsTotal,
    int GoalsMet,
    double Pct
);

public record GoalHistoryDto(
    List<GoalHistoryMonthDto> Months,
    int ConsecutiveStreak
);
