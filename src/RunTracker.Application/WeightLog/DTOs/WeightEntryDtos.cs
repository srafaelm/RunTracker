namespace RunTracker.Application.WeightLog.DTOs;

public record WeightEntryDto(Guid Id, DateOnly Date, double WeightKg);
public record AddWeightEntryRequest(DateOnly Date, double WeightKg);
