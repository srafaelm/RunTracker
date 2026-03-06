namespace RunTracker.Application.Streets.DTOs;

public record CityListItemDto(
    Guid Id,
    string Name,
    string? Region,
    string Country,
    int TotalStreets,
    int TotalNodes,
    int CompletedStreets,
    int CompletedNodes,
    double CompletionPercentage
);

public record CityDetailDto(
    Guid Id,
    string Name,
    string? Region,
    string Country,
    long OsmRelationId,
    int TotalStreets,
    int TotalNodes,
    int CompletedStreets,
    int CompletedNodes,
    double CompletionPercentage
);

public record StreetDto(
    Guid Id,
    string Name,
    string HighwayType,
    int NodeCount,
    double TotalLengthMeters,
    int CompletedNodes,
    bool IsCompleted,
    double CompletionPercentage
);

public record CityGeoJsonFeatureDto(
    Guid StreetId,
    string Name,
    string HighwayType,
    double[][] Coordinates,
    bool IsCompleted,
    double CompletionPercentage
);

public record ImportCityRequest(
    long OsmRelationId,
    string Name,
    string? Region,
    string Country
);

public record RouteSuggestionDto(
    string? EncodedPolyline,
    double DistanceM,
    int StreetCount,
    int NodeCount
);
