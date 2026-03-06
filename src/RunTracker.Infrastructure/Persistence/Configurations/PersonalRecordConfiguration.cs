using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence.Configurations;

public class PersonalRecordConfiguration : IEntityTypeConfiguration<PersonalRecord>
{
    public void Configure(EntityTypeBuilder<PersonalRecord> builder)
    {
        builder.HasKey(pr => pr.Id);

        builder.HasIndex(pr => new { pr.UserId, pr.RecordType }).IsUnique();

        builder.HasOne(pr => pr.User)
            .WithMany(u => u.PersonalRecords)
            .HasForeignKey(pr => pr.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(pr => pr.Activity)
            .WithMany()
            .HasForeignKey(pr => pr.ActivityId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
