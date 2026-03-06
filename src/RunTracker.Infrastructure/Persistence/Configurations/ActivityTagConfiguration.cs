using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class ActivityTagConfiguration : IEntityTypeConfiguration<ActivityTag>
{
    public void Configure(EntityTypeBuilder<ActivityTag> builder)
    {
        builder.HasKey(at => new { at.ActivityId, at.TagId });

        builder.HasOne(at => at.Activity)
            .WithMany(a => a.ActivityTags)
            .HasForeignKey(at => at.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(at => at.Tag)
            .WithMany(t => t.ActivityTags)
            .HasForeignKey(at => at.TagId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
