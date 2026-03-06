using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class UserStreetNodeConfiguration : IEntityTypeConfiguration<UserStreetNode>
{
    public void Configure(EntityTypeBuilder<UserStreetNode> builder)
    {
        builder.HasKey(usn => new { usn.UserId, usn.StreetNodeId });

        builder.HasIndex(usn => usn.UserId);
        builder.HasIndex(usn => usn.StreetNodeId);

        builder.HasOne(usn => usn.User)
            .WithMany()
            .HasForeignKey(usn => usn.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(usn => usn.StreetNode)
            .WithMany(sn => sn.UserCompletions)
            .HasForeignKey(usn => usn.StreetNodeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(usn => usn.Activity)
            .WithMany()
            .HasForeignKey(usn => usn.ActivityId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
