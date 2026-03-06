using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class CityConfiguration : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Region).HasMaxLength(200);
        builder.Property(c => c.Country).HasMaxLength(100).IsRequired();

        builder.Property(c => c.Boundary)
            .HasColumnType("geography");

        builder.HasIndex(c => c.OsmRelationId).IsUnique();

        builder.HasMany(c => c.Streets)
            .WithOne(s => s.City)
            .HasForeignKey(s => s.CityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
