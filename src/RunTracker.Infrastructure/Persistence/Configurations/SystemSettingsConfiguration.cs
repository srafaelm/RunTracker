using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class SystemSettingsConfiguration : IEntityTypeConfiguration<SystemSettings>
{
    public void Configure(EntityTypeBuilder<SystemSettings> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.StravaClientId).HasMaxLength(100);
        builder.Property(s => s.StravaClientSecret).HasMaxLength(200);

        // Seed a single row so the app always has a settings record to update
        builder.HasData(new SystemSettings { Id = 1 });
    }
}
