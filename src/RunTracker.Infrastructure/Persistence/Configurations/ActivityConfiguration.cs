using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class ActivityConfiguration : IEntityTypeConfiguration<Activity>
{
    public void Configure(EntityTypeBuilder<Activity> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name).HasMaxLength(500);
        builder.Property(a => a.SummaryPolyline).HasColumnType("nvarchar(max)");
        builder.Property(a => a.DetailedPolyline).HasColumnType("nvarchar(max)");

        builder.HasIndex(a => a.UserId);
        builder.HasIndex(a => a.StartDate);
        builder.HasIndex(a => new { a.UserId, a.ExternalId, a.Source }).IsUnique().HasFilter("[ExternalId] IS NOT NULL");

        builder.HasOne(a => a.User)
            .WithMany(u => u.Activities)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(a => a.Streams)
            .WithOne(s => s.Activity)
            .HasForeignKey(s => s.ActivityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
