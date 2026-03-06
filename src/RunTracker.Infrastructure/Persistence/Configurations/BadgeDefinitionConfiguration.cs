using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class BadgeDefinitionConfiguration : IEntityTypeConfiguration<BadgeDefinition>
{
    public void Configure(EntityTypeBuilder<BadgeDefinition> builder)
    {
        builder.HasKey(b => b.Id);
        // Id maps to BadgeType enum values — never auto-generated
        builder.Property(b => b.Id).ValueGeneratedNever();
        builder.Property(b => b.Name).HasMaxLength(100).IsRequired();
        builder.Property(b => b.Description).HasMaxLength(500).IsRequired();
        builder.Property(b => b.Icon).HasMaxLength(50).IsRequired();
        builder.Property(b => b.Category).HasMaxLength(100).IsRequired();
    }
}
