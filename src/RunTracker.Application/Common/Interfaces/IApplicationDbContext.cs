using Microsoft.EntityFrameworkCore;
using RunTracker.Domain.Entities;
using GearEntity = RunTracker.Domain.Entities.Gear;

namespace RunTracker.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Activity> Activities { get; }
    DbSet<ActivityStream> ActivityStreams { get; }
    DbSet<PersonalRecord> PersonalRecords { get; }
    DbSet<City> Cities { get; }
    DbSet<Street> Streets { get; }
    DbSet<StreetNode> StreetNodes { get; }
    DbSet<UserStreetNode> UserStreetNodes { get; }
    DbSet<UserCityProgress> UserCityProgress { get; }
    DbSet<ScheduledWorkout> ScheduledWorkouts { get; }
    DbSet<UserTile> UserTiles { get; }
    DbSet<UserBadge> UserBadges { get; }
    DbSet<BadgeDefinition> BadgeDefinitions { get; }
    DbSet<Tag> Tags { get; }
    DbSet<ActivityTag> ActivityTags { get; }
    DbSet<UserFollow> UserFollows { get; }
    DbSet<PlannedRoute> PlannedRoutes { get; }
    DbSet<GearEntity> Gear { get; }
    DbSet<AbsenceDay> AbsenceDays { get; }
    DbSet<DashboardTemplate> DashboardTemplates { get; }
    DbSet<BenchmarkItem> BenchmarkItems { get; }
    DbSet<BenchmarkCompletion> BenchmarkCompletions { get; }
    DbSet<SystemSettings> SystemSettings { get; }
    DbSet<UserGoal> UserGoals { get; }
    DbSet<WeightEntry> WeightEntries { get; }
    DbSet<Vo2maxSnapshot> Vo2maxSnapshots { get; }
    DbSet<UserTrainingTemplate> UserTrainingTemplates { get; }
    DbSet<UserTemplateWorkout> UserTemplateWorkouts { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
