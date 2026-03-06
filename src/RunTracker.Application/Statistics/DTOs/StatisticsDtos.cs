using RunTracker.Application.Statistics;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Statistics.DTOs;

public record YearlyStatsDto(
    int Year,
    double TotalDistance,
    int TotalRuns,
    int TotalTimeSeconds,
    double AveragePaceMinPerKm,
    double TotalElevationGain,
    double LongestRunDistance,
    List<MonthlyBreakdownDto> MonthlyBreakdown
);

public record MonthlyBreakdownDto(
    int Month,
    string MonthName,
    double TotalDistance,
    int TotalRuns,
    int TotalTimeSeconds,
    double AveragePaceMinPerKm
);

public record WeeklyStatsDto(
    int Year,
    List<WeekBreakdownDto> Weeks
);

public record WeekBreakdownDto(
    int WeekNumber,
    DateTime WeekStart,
    double TotalDistance,
    int TotalRuns,
    int TotalTimeSeconds,
    double AveragePaceMinPerKm
);

public record AllTimeStatsDto(
    double TotalDistance,
    int TotalRuns,
    int TotalTimeSeconds,
    double AveragePaceMinPerKm,
    double TotalElevationGain,
    double LongestRunDistance,
    DateTime? FirstRunDate,
    DateTime? LastRunDate,
    List<PersonalRecordDto> PersonalRecords,
    int? BestYear,
    double BestYearDistance,
    string? BestMonthLabel,
    double BestMonthDistance,
    int CurrentDayStreak,
    int LongestDayStreak,
    int CurrentWeekStreak,
    int LongestWeekStreak
);

public record PersonalRecordDto(
    RecordType RecordType,
    double Value,
    Guid ActivityId,
    DateTime AchievedAt,
    string DisplayValue
);

public record PaceTrendDto(
    List<PaceTrendPointDto> Points
);

public record PaceTrendPointDto(
    DateTime PeriodStart,
    string PeriodLabel,
    double AveragePaceMinPerKm,
    int RunCount
);

public record MultiYearMonthDto(int Month, double TotalDistance, int TotalRuns);

public record MultiYearDto(int Year, double TotalDistance, int TotalRuns, List<MultiYearMonthDto> Monthly);

public record ActivityDaySummaryDto(string Date, double DistanceKm);

// --- Exploration Stats ---
public record ExplorationStatsDto(
    int CountriesCount,
    int CitiesWithProgress,
    int CompletedStreetsTotal,
    int ExplorerTilesCount,
    double TripsToMoon,
    double TripsAroundEarth
);

// --- Running Level / Percentile ---
public record RunningLevelDistanceDto(
    string Distance,          // "5K", "10K", etc.
    int DistanceMeters,
    string? UserTimeDisplay,  // null if no PR
    double? UserTimeSec,
    RunningLevelStandardDto[] Standards
);

public record RunningLevelStandardDto(
    string Level,             // Beginner, Novice, Intermediate, Advanced, Elite, WR
    string TimeDisplay,
    bool UserMeetsOrBeats
);

public record RunningLevelDto(
    List<RunningLevelDistanceDto> Distances,
    string? UserAgeGroup,     // "Age 30" or null if unknown
    bool HasData
);

// --- Recent Predictions ---
public record RecentBasePrDto(string Distance, double TimeSec, string DisplayTime, DateTime AchievedAt);
public record RecentPredictedTimeDto(string Distance, int DistanceMeters, double PredictedSec, string DisplayTime, string Pace);
public record RecentPredictionsDto(int PeriodDays, RecentBasePrDto? BasedOn, List<RecentPredictedTimeDto> PredictedTimes);

// --- Time of Day / Day of Week ---
public record TimeOfDayStatsDto(List<HourBucketDto> ByHour, List<DayOfWeekBucketDto> ByDayOfWeek);
public record HourBucketDto(int Hour, string Label, int Count, double AvgPaceMinPerKm, double AvgDistanceM);
public record DayOfWeekBucketDto(int DayOfWeek, string DayName, int Count, double AvgPaceMinPerKm, double AvgDistanceM);

// --- Training Load (CTL/ATL/TSB) ---
public record TrainingLoadPointDto(string Date, double Ctl, double Atl, double Tsb, double DailyLoad);
public record TrainingLoadDto(List<TrainingLoadPointDto> Points, double CurrentCtl, double CurrentAtl, double CurrentTsb);

// --- VO2max Estimation ---
public record Vo2maxTrendPointDto(string MonthLabel, double Vo2max);
public record Vo2maxSnapshotDto(string Date, double Value);
public record Vo2maxDto(
    double? Vo2max,
    string? BasedOn,
    string Level,
    string Classification,
    List<Vo2maxTrendPointDto> Trend
);

// --- Year Infographic ---
public record DailyActivitySummaryDto(string Date, int SportType, double DistanceKm);
public record MonthlyBySportTypeDto(int Month, int SportType, double DistanceKm);
public record YearInfographicDto(
    int Year,
    string DisplayName,
    string? Username,
    string? ProfilePictureUrl,
    double TotalDistanceKm,
    int ActiveDays,
    int MaxStreakDays,
    double TotalHours,
    double TotalElevationM,
    double EverestMultiple,
    double MaxRunDistance,
    double MaxRideDistance,
    double MaxRideElevation,
    double MaxSwimDistance,
    double MaxSwimTimeSec,
    double MaxWalkDistance,
    List<DailyActivitySummaryDto> DailyActivitySummaries,
    List<MonthlyBySportTypeDto> MonthlyBreakdownBySportType
);
