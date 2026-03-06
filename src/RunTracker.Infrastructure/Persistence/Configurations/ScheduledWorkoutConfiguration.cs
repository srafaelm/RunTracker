using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class ScheduledWorkoutConfiguration : IEntityTypeConfiguration<ScheduledWorkout>
{
    public void Configure(EntityTypeBuilder<ScheduledWorkout> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Title).HasMaxLength(200).IsRequired();
        builder.Property(w => w.Notes).HasColumnType("nvarchar(max)");

        builder.HasIndex(w => w.UserId);
        builder.HasIndex(w => w.Date);
        builder.HasIndex(w => new { w.UserId, w.Date });

        builder.HasOne(w => w.User)
            .WithMany(u => u.ScheduledWorkouts)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
