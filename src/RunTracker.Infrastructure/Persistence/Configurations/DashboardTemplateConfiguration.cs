using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class DashboardTemplateConfiguration : IEntityTypeConfiguration<DashboardTemplate>
{
    public void Configure(EntityTypeBuilder<DashboardTemplate> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Widgets).HasMaxLength(2000).IsRequired();
        builder.HasIndex(t => new { t.UserId, t.Name }).IsUnique();
        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
