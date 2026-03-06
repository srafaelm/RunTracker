using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class UserTileConfiguration : IEntityTypeConfiguration<UserTile>
{
    public void Configure(EntityTypeBuilder<UserTile> builder)
    {
        builder.HasKey(t => new { t.UserId, t.TileX, t.TileY });

        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Activity)
            .WithMany()
            .HasForeignKey(t => t.ActivityId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(t => t.UserId);
    }
}
