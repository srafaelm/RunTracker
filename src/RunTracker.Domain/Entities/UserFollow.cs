namespace RunTracker.Domain.Entities;

public class UserFollow
{
    public string FollowerId { get; set; } = "";
    public string FolloweeId { get; set; } = "";
    public DateTime FollowedAt { get; set; } = DateTime.UtcNow;

    public User? Follower { get; set; }
    public User? Followee { get; set; }
}
