using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class StreetNodeConfiguration : IEntityTypeConfiguration<StreetNode>
{
    public void Configure(EntityTypeBuilder<StreetNode> builder)
    {
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Location)
            .HasColumnType("geography")
            .IsRequired();

        builder.HasIndex(n => n.StreetId);
        builder.HasIndex(n => n.OsmNodeId);
    }
}
