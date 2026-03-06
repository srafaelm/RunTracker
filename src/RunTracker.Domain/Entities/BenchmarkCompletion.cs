using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class BenchmarkCompletion : BaseEntity
{
    public string UserId { get; set; } = null!;
    public Guid BenchmarkItemId { get; set; }
    public DateTime CompletedAt { get; set; }
    public string? Notes { get; set; }

    public BenchmarkItem BenchmarkItem { get; set; } = null!;
}
