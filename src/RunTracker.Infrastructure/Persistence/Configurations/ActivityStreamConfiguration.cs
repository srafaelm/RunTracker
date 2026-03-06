using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class ActivityStreamConfiguration : IEntityTypeConfiguration<ActivityStream>
{
    public void Configure(EntityTypeBuilder<ActivityStream> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Location)
            .HasColumnType("geography");

        builder.HasIndex(s => s.ActivityId);

        /*// Spatial index on Location
        builder.HasIndex(s => s.Location)
            .HasDatabaseName("IX_ActivityStreams_Location");*/
    }
}
