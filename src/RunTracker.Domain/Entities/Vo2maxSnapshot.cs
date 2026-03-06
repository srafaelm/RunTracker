namespace RunTracker.Domain.Entities;

public class Vo2maxSnapshot
{
    public int Id { get; set; }
    public string UserId { get; set; } = default!;
    public DateTime Date { get; set; }
    public double Value { get; set; }
}
