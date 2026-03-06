using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class AbsenceDayConfiguration : IEntityTypeConfiguration<AbsenceDay>
{
    public void Configure(EntityTypeBuilder<AbsenceDay> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Notes).HasMaxLength(500);
        builder.HasIndex(a => new { a.UserId, a.Date });
        builder.HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
