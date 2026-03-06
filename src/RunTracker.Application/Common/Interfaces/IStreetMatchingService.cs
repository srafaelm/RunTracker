namespace RunTracker.Application.Common.Interfaces;

public interface IStreetMatchingService
{
    /// <summary>
    /// Match activity GPS points against street nodes and update user progress.
    /// </summary>
    Task MatchActivityAsync(string userId, Guid activityId, CancellationToken ct = default);

    /// <summary>
    /// Match all existing activities for a user against street nodes.
    /// Used to backfill street progress for activities synced before street import.
    /// </summary>
    Task<int> MatchAllActivitiesAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Recalculate a user's city progress after node matching.
    /// </summary>
    Task RecalculateCityProgressAsync(string userId, CancellationToken ct = default);
}
