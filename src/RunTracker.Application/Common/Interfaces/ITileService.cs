namespace RunTracker.Application.Common.Interfaces;

public interface ITileService
{
    /// <summary>Compute slippy-map tile coordinates at zoom 15 for a GPS point.</summary>
    (int x, int y) ComputeTile(double lat, double lon);

    /// <summary>Process GPS points from an activity and record newly visited tiles.</summary>
    Task ProcessActivityTilesAsync(string userId, Guid activityId, CancellationToken ct = default);

    /// <summary>Reprocess all activities for a user.</summary>
    Task ProcessAllActivitiesAsync(string userId, CancellationToken ct = default);
}
