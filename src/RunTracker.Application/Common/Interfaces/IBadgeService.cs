namespace RunTracker.Application.Common.Interfaces;

public interface IBadgeService
{
    /// <summary>Evaluate all badge conditions for a user and award any not yet earned.</summary>
    Task CheckAndAwardBadgesAsync(string userId, CancellationToken ct = default);
}
