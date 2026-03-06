using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.Property(u => u.StravaAccessToken).HasMaxLength(500);
        builder.Property(u => u.StravaRefreshToken).HasMaxLength(500);

        builder.HasIndex(u => u.StravaAthleteId)
            .IsUnique()
            .HasFilter("[StravaAthleteId] IS NOT NULL");
    }
}
