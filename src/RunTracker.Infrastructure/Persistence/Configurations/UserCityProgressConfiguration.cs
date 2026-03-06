using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class UserCityProgressConfiguration : IEntityTypeConfiguration<UserCityProgress>
{
    public void Configure(EntityTypeBuilder<UserCityProgress> builder)
    {
        builder.HasKey(p => new { p.UserId, p.CityId });

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.City)
            .WithMany()
            .HasForeignKey(p => p.CityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
