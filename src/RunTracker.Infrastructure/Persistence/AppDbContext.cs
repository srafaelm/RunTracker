using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Persistence;

// dotnet ef migrations add InitialCreate -p src/RunTracker.Infrastructure -s src/RunTracker.Web
public class AppDbContext : IdentityDbContext<User>, IApplicationDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<ActivityStream> ActivityStreams => Set<ActivityStream>();
    public DbSet<PersonalRecord> PersonalRecords => Set<PersonalRecord>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Street> Streets => Set<Street>();
    public DbSet<StreetNode> StreetNodes => Set<StreetNode>();
    public DbSet<UserStreetNode> UserStreetNodes => Set<UserStreetNode>();
    public DbSet<UserCityProgress> UserCityProgress => Set<UserCityProgress>();
    public DbSet<ScheduledWorkout> ScheduledWorkouts => Set<ScheduledWorkout>();
    public DbSet<UserTile> UserTiles => Set<UserTile>();
    public DbSet<UserBadge> UserBadges => Set<UserBadge>();
    public DbSet<BadgeDefinition> BadgeDefinitions => Set<BadgeDefinition>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<ActivityTag> ActivityTags => Set<ActivityTag>();
    public DbSet<UserFollow> UserFollows => Set<UserFollow>();
    public DbSet<PlannedRoute> PlannedRoutes => Set<PlannedRoute>();
    public DbSet<Gear> Gear => Set<Gear>();
    public DbSet<AbsenceDay> AbsenceDays => Set<AbsenceDay>();
    public DbSet<DashboardTemplate> DashboardTemplates => Set<DashboardTemplate>();
    public DbSet<BenchmarkItem> BenchmarkItems => Set<BenchmarkItem>();
    public DbSet<BenchmarkCompletion> BenchmarkCompletions => Set<BenchmarkCompletion>();
    public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();
    public DbSet<UserGoal> UserGoals => Set<UserGoal>();
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<Vo2maxSnapshot> Vo2maxSnapshots => Set<Vo2maxSnapshot>();
    public DbSet<UserTrainingTemplate> UserTrainingTemplates => Set<UserTrainingTemplate>();
    public DbSet<UserTemplateWorkout> UserTemplateWorkouts => Set<UserTemplateWorkout>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<Domain.Common.BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTime.UtcNow;
        }

        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTime.UtcNow;
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
