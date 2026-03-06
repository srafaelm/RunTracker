using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class StreetConfiguration : IEntityTypeConfiguration<Street>
{
    public void Configure(EntityTypeBuilder<Street> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).HasMaxLength(300);
        builder.Property(s => s.HighwayType).HasMaxLength(50).IsRequired();

        builder.Property(s => s.Geometry)
            .HasColumnType("geography");

        builder.HasIndex(s => s.CityId);
        builder.HasIndex(s => s.OsmWayId);

        builder.HasMany(s => s.Nodes)
            .WithOne(n => n.Street)
            .HasForeignKey(n => n.StreetId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
