using RunTracker.Application.Tags;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Activities.DTOs;

public record ActivitySummaryDto(
    Guid Id,
    string Name,
    SportType SportType,
    DateTime StartDate,
    double Distance,
    int MovingTime,
    int ElapsedTime,
    double TotalElevationGain,
    double? AverageSpeed,
    double? MaxSpeed,
    double? AverageHeartRate,
    int? MaxHeartRate,
    double? AverageCadence,
    int? Calories,
    string? SummaryPolyline,
    double AveragePaceMinPerKm
);

public record ActivityDetailDto(
    Guid Id,
    string Name,
    SportType SportType,
    DateTime StartDate,
    double Distance,
    int MovingTime,
    int ElapsedTime,
    double TotalElevationGain,
    double? AverageSpeed,
    double? MaxSpeed,
    double? AverageHeartRate,
    int? MaxHeartRate,
    double? AverageCadence,
    int? Calories,
    string? SummaryPolyline,
    string? DetailedPolyline,
    double AveragePaceMinPerKm,
    List<ActivityStreamPointDto> Streams,
    List<TagDto> Tags,
    Guid? GearId,
    int NewStreetsDiscovered = 0,
    double? WeatherTempC = null,
    int? WeatherHumidityPct = null,
    double? WeatherWindSpeedKmh = null,
    string? WeatherCondition = null
);

public record ActivityStreamPointDto(
    int PointIndex,
    double Latitude,
    double Longitude,
    double? Altitude,
    int? Time,
    double? Distance,
    int? HeartRate,
    double? Speed,
    int? Cadence
);
