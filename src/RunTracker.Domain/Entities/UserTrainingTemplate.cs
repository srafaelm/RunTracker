using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Entities;

public class UserTrainingTemplate
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<UserTemplateWorkout> Workouts { get; set; } = new();
}

public class UserTemplateWorkout
{
    public Guid Id { get; set; }
    public Guid TemplateId { get; set; }
    public UserTrainingTemplate Template { get; set; } = default!;
    public int DaysFromRace { get; set; }
    public string Title { get; set; } = default!;
    public WorkoutType WorkoutType { get; set; }
    public double? DistanceMeters { get; set; }
    public string? Notes { get; set; }
}
