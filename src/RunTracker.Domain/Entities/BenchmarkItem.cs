using RunTracker.Domain.Common;

namespace RunTracker.Domain.Entities;

public class BenchmarkItem : BaseEntity
{
    public string UserId { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public User User { get; set; } = null!;
    public ICollection<BenchmarkCompletion> Completions { get; set; } = [];
}
