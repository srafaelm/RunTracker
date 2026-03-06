namespace RunTracker.Application.Benchmarks;

public record BenchmarkItemDto(
    Guid Id,
    string Name,
    string? Category,
    int SortOrder,
    int TotalCompletions,
    DateTime? LastCompletedAt,
    Guid? LastCompletionId,
    bool IsActive);

public record BenchmarkCompletionDto(
    Guid Id,
    Guid BenchmarkItemId,
    string ItemName,
    DateTime CompletedAt,
    string? Notes);

public record BenchmarkHistoryEntryDto(
    DateOnly Date,
    int CompletedCount,
    int TotalActive,
    List<string> CompletedItemNames);
