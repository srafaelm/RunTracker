using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class GearConfiguration : IEntityTypeConfiguration<Gear>
{
    public void Configure(EntityTypeBuilder<Gear> builder)
    {
        builder.HasKey(g => g.Id);

        builder.Property(g => g.Name).HasMaxLength(200).IsRequired();
        builder.Property(g => g.Brand).HasMaxLength(100);
        builder.Property(g => g.Notes).HasMaxLength(1000);

        builder.HasOne(g => g.User)
            .WithMany()
            .HasForeignKey(g => g.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(g => g.Activities)
            .WithOne(a => a.Gear)
            .HasForeignKey(a => a.GearId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
