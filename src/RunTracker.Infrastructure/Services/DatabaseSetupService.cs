using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;
using RunTracker.Infrastructure.Persistence;

namespace RunTracker.Infrastructure.Services;

public class DatabaseSetupService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DatabaseSetupService> _logger;

    public DatabaseSetupService(IServiceScopeFactory scopeFactory, ILogger<DatabaseSetupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task InitialiseAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        _logger.LogInformation("Applying database migrations…");
        await db.Database.MigrateAsync();
        _logger.LogInformation("Migrations applied.");

        await SeedBadgesAsync(db);

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        await SeedTestUsersAsync(db, userManager);
    }

    private async Task SeedBadgesAsync(AppDbContext db)
    {
        var definitions = BadgeSeedData.All;

        foreach (var def in definitions)
        {
            var existing = await db.BadgeDefinitions.FindAsync(def.Id);
            if (existing is null)
            {
                db.BadgeDefinitions.Add(def);
            }
            else
            {
                existing.Name        = def.Name;
                existing.Description = def.Description;
                existing.Icon        = def.Icon;
                existing.Category    = def.Category;
                existing.SortOrder   = def.SortOrder;
            }
        }

        var changed = await db.SaveChangesAsync();
        if (changed > 0)
            _logger.LogInformation("Badge definitions seeded/updated ({Count} rows).", changed);
    }

    private async Task SeedTestUsersAsync(AppDbContext db, UserManager<User> userManager)
    {
        var testUsers = new[]
        {
            new { Email = "alice@demo.com",   Name = "Alice Demo",   ActivityCount = 10  },
            new { Email = "bob@demo.com",     Name = "Bob Demo",     ActivityCount = 40  },
            new { Email = "charlie@demo.com", Name = "Charlie Demo", ActivityCount = 100 },
        };

        foreach (var def in testUsers)
        {
            var existing = await userManager.FindByEmailAsync(def.Email);
            if (existing is not null) continue;

            var user = new User
            {
                UserName = def.Email,
                Email = def.Email,
                DisplayName = def.Name,
                MaxHeartRate = 180,
                StravaHistoricalSyncComplete = true,
                EmailConfirmed = true,
                ProfilePictureUrl = $"https://api.dicebear.com/9.x/initials/svg?seed={Uri.EscapeDataString(def.Email)}",
            };

            var result = await userManager.CreateAsync(user, "demo");
            if (!result.Succeeded)
            {
                _logger.LogWarning("Failed to create test user {Email}: {Errors}", def.Email,
                    string.Join(", ", result.Errors.Select(e => e.Description)));
                continue;
            }

            var activities = TestActivityGenerator.Generate(user.Id, def.ActivityCount);
            db.Activities.AddRange(activities);
            await db.SaveChangesAsync();

            _logger.LogInformation("Created test user {Email} with {Count} activities.", def.Email, def.ActivityCount);
        }
    }
}

/// <summary>Generates realistic mock activities for test users.</summary>
file static class TestActivityGenerator
{
    private static readonly Random Rng = new(42);

    private static readonly string[] RunNames =
        ["Morning Run", "Easy Run", "Tempo Run", "Long Run", "Evening Run", "Trail Run", "Recovery Run", "Interval Session", "Weekend Long Run", "Fartlek Run"];
    private static readonly string[] RideNames =
        ["Morning Ride", "Easy Cycle", "Road Ride", "Evening Ride", "Weekend Cycle", "Recovery Ride"];
    private static readonly string[] SwimNames =
        ["Pool Swim", "Open Water Swim", "Morning Swim", "Swim Training"];
    private static readonly string[] OtherNames =
        ["Strength Training", "Gym Session", "Core Workout", "Yoga Session"];

    public static List<Activity> Generate(string userId, int count)
    {
        var activities = new List<Activity>();
        var baseDate = DateTime.UtcNow.Date;

        for (int i = 0; i < count; i++)
        {
            // Spread evenly over past 12 months with slight jitter
            var daysBack = (int)((double)i / count * 365) + Rng.Next(0, 4);
            var date = baseDate.AddDays(-daysBack).AddHours(6 + Rng.Next(0, 14));

            // Force last 3 activities (most recent) to be runs with GPS stream data
            if (i < 3)
            {
                var run = MakeRun(userId, date);
                run.Streams = GenerateRunStream(run).ToList();
                activities.Add(run);
            }
            else
            {
                var sport = PickSportType();
                activities.Add(MakeActivity(userId, sport, date));
            }
        }

        return activities;
    }

    // Netherlands GPS waypoints (Amsterdam/Utrecht area) for realistic-looking routes
    private static readonly (double Lat, double Lon)[] NlWaypoints =
    [
        (52.3676, 4.9041),  // Amsterdam centre
        (52.3588, 4.8810),  // Vondelpark
        (52.3480, 4.9025),  // Museum quarter
        (52.3400, 4.8895),  // Oud-Zuid
        (52.3320, 4.9100),  // Amsteldijk
        (52.3250, 4.9320),  // Duivendrecht
        (52.3150, 4.9500),  // Diemen
        (52.3080, 4.9700),  // towards Weesp
        (52.3200, 4.9550),  // return leg
        (52.3380, 4.9250),  // back towards city
        (52.3520, 4.9050),  // inner ring
        (52.3620, 4.9000),  // back north
    ];

    private static IEnumerable<ActivityStream> GenerateRunStream(Activity run)
    {
        // Determine number of points from activity duration (~1 point/sec)
        var totalSec = run.MovingTime;
        var totalDist = run.Distance > 0 ? run.Distance : 5000;
        // ~1 point every 5 seconds for manageability (200 pts for a 1000-sec run)
        var interval = 5;
        var pointCount = Math.Max(50, totalSec / interval);

        // Build a simple GPS track by interpolating through NL waypoints
        var waypoints = NlWaypoints;
        var wLen = waypoints.Length;

        // Base HR params from activity average
        var baseHr = run.AverageHeartRate ?? 150;
        var maxHr = run.MaxHeartRate ?? (baseHr + 15);

        double cumDist = 0;
        double cumTime = 0;

        for (int i = 0; i < pointCount; i++)
        {
            var fraction = (double)i / (pointCount - 1);
            // Interpolate through waypoints
            var wpFrac = fraction * (wLen - 1);
            var wpIdx = (int)wpFrac;
            var wpT = wpFrac - wpIdx;
            var from = waypoints[Math.Min(wpIdx, wLen - 1)];
            var to = waypoints[Math.Min(wpIdx + 1, wLen - 1)];
            var lat = from.Lat + (to.Lat - from.Lat) * wpT;
            var lon = from.Lon + (to.Lon - from.Lon) * wpT;
            // Small jitter so track isn't perfectly straight
            lat += (Rng.NextDouble() - 0.5) * 0.0004;
            lon += (Rng.NextDouble() - 0.5) * 0.0004;

            // HR: warm-up ramp in first 20%, cruise in middle 70%, cool-down last 10%
            int hr;
            if (fraction < 0.20)
                hr = (int)(baseHr - 15 + (maxHr - baseHr + 5) * (fraction / 0.20));
            else if (fraction > 0.90)
                hr = (int)(baseHr + (maxHr - baseHr) * (1 - (fraction - 0.90) / 0.10));
            else
                hr = (int)(baseHr + (maxHr - baseHr) * 0.6 + Rng.Next(-5, 6));
            hr = Math.Clamp(hr, 100, 210);

            var speed = run.AverageSpeed.HasValue ? run.AverageSpeed.Value * (0.9 + Rng.NextDouble() * 0.2) : 3.0;
            var dt = interval;
            cumTime += dt;
            cumDist += speed * dt;

            yield return new ActivityStream
            {
                ActivityId = run.Id,
                PointIndex = i,
                Latitude = lat,
                Longitude = lon,
                Altitude = 2 + Rng.NextDouble() * 8,
                Time = (int)cumTime,
                Distance = Math.Min(cumDist, totalDist),
                HeartRate = hr,
                Speed = speed,
                Cadence = 85 + Rng.Next(-5, 10),
                Location = new Point(lon, lat) { SRID = 4326 },
            };
        }
    }

    private static SportType PickSportType()
    {
        var roll = Rng.Next(100);
        return roll switch
        {
            < 70 => SportType.Run,
            < 90 => SportType.Ride,
            < 95 => SportType.Swim,
            _    => SportType.Other,
        };
    }

    private static Activity MakeActivity(string userId, SportType sport, DateTime date) => sport switch
    {
        SportType.Ride  => MakeRide(userId, date),
        SportType.Swim  => MakeSwim(userId, date),
        SportType.Other => MakeStrength(userId, date),
        _               => MakeRun(userId, date),
    };

    private static Activity MakeRun(string userId, DateTime date)
    {
        var distKm = 5 + Rng.NextDouble() * 20;
        var paceSecPerKm = 270 + Rng.Next(0, 120);
        var movingSec = (int)(distKm * paceSecPerKm);
        var avgHr = 140 + Rng.Next(-15, 20);
        var avgSpeed = 1000.0 / paceSecPerKm;
        return new Activity
        {
            UserId = userId, Source = ActivitySource.Manual,
            Name = RunNames[Rng.Next(RunNames.Length)], SportType = SportType.Run, StartDate = date,
            Distance = distKm * 1000, MovingTime = movingSec, ElapsedTime = movingSec + Rng.Next(30, 180),
            TotalElevationGain = distKm * (5 + Rng.NextDouble() * 15),
            AverageSpeed = avgSpeed, MaxSpeed = avgSpeed * 1.25,
            AverageHeartRate = avgHr, MaxHeartRate = avgHr + 10 + Rng.Next(0, 15),
            AverageCadence = 85 + Rng.Next(-5, 10),
            Calories = (int)(distKm * 65 + Rng.Next(-50, 50)),
        };
    }

    private static Activity MakeRide(string userId, DateTime date)
    {
        var distKm = 20 + Rng.NextDouble() * 60;
        var speedMs = 6.0 + Rng.NextDouble() * 4;
        var movingSec = (int)(distKm * 1000 / speedMs);
        var avgHr = 130 + Rng.Next(-10, 20);
        return new Activity
        {
            UserId = userId, Source = ActivitySource.Manual,
            Name = RideNames[Rng.Next(RideNames.Length)], SportType = SportType.Ride, StartDate = date,
            Distance = distKm * 1000, MovingTime = movingSec, ElapsedTime = movingSec + Rng.Next(60, 300),
            TotalElevationGain = distKm * (8 + Rng.NextDouble() * 20),
            AverageSpeed = speedMs, MaxSpeed = speedMs * 1.4,
            AverageHeartRate = avgHr, MaxHeartRate = avgHr + 15 + Rng.Next(0, 20),
            AverageCadence = 80 + Rng.Next(-5, 15),
            Calories = (int)(distKm * 30 + Rng.Next(-30, 30)),
        };
    }

    private static Activity MakeSwim(string userId, DateTime date)
    {
        var distM = 500 + Rng.Next(0, 2000);
        var movingSec = (int)(distM / (1.0 + Rng.NextDouble() * 0.5));
        var avgHr = 125 + Rng.Next(-10, 20);
        return new Activity
        {
            UserId = userId, Source = ActivitySource.Manual,
            Name = SwimNames[Rng.Next(SwimNames.Length)], SportType = SportType.Swim, StartDate = date,
            Distance = distM, MovingTime = movingSec, ElapsedTime = movingSec + Rng.Next(60, 180),
            TotalElevationGain = 0,
            AverageSpeed = (double)distM / movingSec,
            AverageHeartRate = avgHr, MaxHeartRate = avgHr + 10 + Rng.Next(0, 15),
            Calories = (int)(distM * 0.3 + Rng.Next(-20, 20)),
        };
    }

    private static Activity MakeStrength(string userId, DateTime date)
    {
        var movingSec = 1800 + Rng.Next(0, 3600);
        var avgHr = 110 + Rng.Next(-10, 20);
        return new Activity
        {
            UserId = userId, Source = ActivitySource.Manual,
            Name = OtherNames[Rng.Next(OtherNames.Length)], SportType = SportType.Other, StartDate = date,
            Distance = 0, MovingTime = movingSec, ElapsedTime = movingSec + Rng.Next(120, 600),
            TotalElevationGain = 0,
            AverageHeartRate = avgHr, MaxHeartRate = avgHr + 15 + Rng.Next(0, 25),
            Calories = (int)(movingSec / 60.0 * 6 + Rng.Next(-30, 30)),
        };
    }
}

/// <summary>
/// Single source of truth for badge metadata.
/// Id values must match the BadgeType enum.
/// </summary>
public static class BadgeSeedData
{
    public static readonly BadgeDefinition[] All =
    [
        // Distance Milestones (single run)
        new() { Id = 5,  Name = "First 1K",         Description = "Completed your first 1km run",                                    Icon = "🎽", Category = "Distance Milestones", SortOrder = 0 },
        new() { Id = 1,  Name = "First 5K",         Description = "Completed your first 5km run",                                    Icon = "🏅", Category = "Distance Milestones", SortOrder = 1 },
        new() { Id = 2,  Name = "First 10K",        Description = "Completed your first 10km run",                                   Icon = "🥈", Category = "Distance Milestones", SortOrder = 2 },
        new() { Id = 6,  Name = "First 15K",        Description = "Completed your first 15km run",                                   Icon = "🎖️", Category = "Distance Milestones", SortOrder = 3 },
        new() { Id = 3,  Name = "First Half",       Description = "Completed your first half marathon (21.1 km)",                    Icon = "🥇", Category = "Distance Milestones", SortOrder = 4 },
        new() { Id = 7,  Name = "First 50K",        Description = "Completed your first 50km ultra run",                             Icon = "🦁", Category = "Distance Milestones", SortOrder = 5 },
        new() { Id = 4,  Name = "First Marathon",   Description = "Completed your first full marathon (42.2 km)",                    Icon = "🏆", Category = "Distance Milestones", SortOrder = 6 },
        new() { Id = 8,  Name = "First 100K",       Description = "Completed your first 100km ultra run",                            Icon = "🔥", Category = "Distance Milestones", SortOrder = 7 },
        new() { Id = 9,  Name = "First 100 Miles",  Description = "Completed your first 100-mile (160.9 km) ultra run",              Icon = "💎", Category = "Distance Milestones", SortOrder = 8 },

        // Total Distance
        new() { Id = 10, Name = "Century",          Description = "Accumulated 100 km of total running distance",                    Icon = "💯", Category = "Total Distance",       SortOrder = 1 },
        new() { Id = 11, Name = "500 km Club",      Description = "Accumulated 500 km of total running distance",                    Icon = "⭐", Category = "Total Distance",       SortOrder = 2 },
        new() { Id = 12, Name = "1000 km Club",     Description = "Accumulated 1,000 km of total running distance",                  Icon = "🌟", Category = "Total Distance",       SortOrder = 3 },
        new() { Id = 13, Name = "Ultra Runner",     Description = "Accumulated 5,000 km of total running distance",                  Icon = "🚀", Category = "Total Distance",       SortOrder = 4 },

        // Runs
        new() { Id = 20, Name = "First Steps",      Description = "Logged your very first run",                                      Icon = "👟", Category = "Runs",                 SortOrder = 1 },
        new() { Id = 21, Name = "10 Runs",          Description = "Completed 10 runs",                                               Icon = "🔟", Category = "Runs",                 SortOrder = 2 },
        new() { Id = 22, Name = "50 Runs",          Description = "Completed 50 runs",                                               Icon = "🎯", Category = "Runs",                 SortOrder = 3 },
        new() { Id = 23, Name = "Century Runner",   Description = "Completed 100 runs",                                              Icon = "💪", Category = "Runs",                 SortOrder = 4 },
        new() { Id = 24, Name = "Full Year",        Description = "Completed 365 runs — one for every day of the year",              Icon = "📅", Category = "Runs",                 SortOrder = 5 },
        new() { Id = 25, Name = "1,000 Runs",       Description = "Completed 1,000 runs",                                            Icon = "🏟️", Category = "Runs",                 SortOrder = 6 },

        // Elevation (single run)
        new() { Id = 30, Name = "Everest",          Description = "Climbed 8,848 m elevation gain in a single run",                  Icon = "🏔️", Category = "Elevation",           SortOrder = 1 },
        new() { Id = 31, Name = "Kilimanjaro",      Description = "Climbed 5,895 m elevation gain in a single run",                  Icon = "🌋", Category = "Elevation",           SortOrder = 2 },
        new() { Id = 32, Name = "Mont Blanc",       Description = "Climbed 4,808 m elevation gain in a single run",                  Icon = "⛰️", Category = "Elevation",           SortOrder = 3 },
        new() { Id = 33, Name = "K2",               Description = "Climbed 8,611 m elevation gain in a single run",                  Icon = "🗻", Category = "Elevation",           SortOrder = 4 },

        // Cumulative Elevation
        new() { Id = 35, Name = "Cauberg",          Description = "Accumulated 157 m total elevation gain across all runs",          Icon = "🚵", Category = "Cumulative Elevation", SortOrder = 1 },
        new() { Id = 36, Name = "Vaalserberg",      Description = "Accumulated 322 m total elevation gain across all runs",          Icon = "🏕️", Category = "Cumulative Elevation", SortOrder = 2 },
        new() { Id = 37, Name = "Mont Ventoux",     Description = "Accumulated 1,912 m total elevation gain across all runs",        Icon = "🌬️", Category = "Cumulative Elevation", SortOrder = 3 },
        new() { Id = 38, Name = "Zugspitze",        Description = "Accumulated 2,962 m total elevation gain across all runs",        Icon = "🏔️", Category = "Cumulative Elevation", SortOrder = 4 },
        new() { Id = 39, Name = "Etna",             Description = "Accumulated 3,357 m total elevation gain across all runs",        Icon = "🌋", Category = "Cumulative Elevation", SortOrder = 5 },
        new() { Id = 34, Name = "Everest Climber",  Description = "Accumulated 8,848 m total elevation gain across all runs",        Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 6 },
        new() { Id = 61, Name = "Everest ×2",       Description = "Accumulated 17,696 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 7 },
        new() { Id = 62, Name = "Everest ×3",       Description = "Accumulated 26,544 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 8 },
        new() { Id = 63, Name = "Everest ×4",       Description = "Accumulated 35,392 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 9 },
        new() { Id = 64, Name = "Everest ×5",       Description = "Accumulated 44,240 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 10 },
        new() { Id = 65, Name = "Everest ×6",       Description = "Accumulated 53,088 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 11 },
        new() { Id = 66, Name = "Everest ×7",       Description = "Accumulated 61,936 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 12 },
        new() { Id = 67, Name = "Everest ×8",       Description = "Accumulated 70,784 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 13 },
        new() { Id = 68, Name = "Everest ×9",       Description = "Accumulated 79,632 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 14 },
        new() { Id = 69, Name = "Everest ×10",      Description = "Accumulated 88,480 m total elevation gain across all runs",       Icon = "🧗", Category = "Cumulative Elevation", SortOrder = 15 },

        // Exploration
        new() { Id = 40, Name = "Explorer",         Description = "Visited 100 map tiles",                                           Icon = "🗺️", Category = "Exploration",         SortOrder = 1 },
        new() { Id = 41, Name = "Adventurer",       Description = "Visited 500 map tiles",                                           Icon = "🧭", Category = "Exploration",         SortOrder = 2 },
        new() { Id = 42, Name = "Cartographer",     Description = "Visited 1,000 map tiles",                                         Icon = "📍", Category = "Exploration",         SortOrder = 3 },
        new() { Id = 43, Name = "World Traveller",  Description = "Visited 5,000 map tiles",                                         Icon = "🌍", Category = "Exploration",         SortOrder = 4 },
        new() { Id = 50, Name = "Street Explorer",  Description = "Completed 100% of all streets in any city",                       Icon = "🏙️", Category = "Exploration",         SortOrder = 5 },

        // Cycling
        new() { Id = 70, Name = "First Ride",       Description = "Logged your very first cycling activity",                          Icon = "🚴", Category = "Cycling",             SortOrder = 1 },
        new() { Id = 71, Name = "10 Rides",         Description = "Completed 10 cycling activities",                                  Icon = "🚵", Category = "Cycling",             SortOrder = 2 },
        new() { Id = 72, Name = "50 Rides",         Description = "Completed 50 cycling activities",                                  Icon = "🏅", Category = "Cycling",             SortOrder = 3 },
        new() { Id = 73, Name = "Century Ride",     Description = "Accumulated 100 km of total cycling distance",                     Icon = "💯", Category = "Cycling",             SortOrder = 4 },
        new() { Id = 74, Name = "500 km Cyclist",   Description = "Accumulated 500 km of total cycling distance",                     Icon = "⭐", Category = "Cycling",             SortOrder = 5 },
        new() { Id = 75, Name = "1000 km Cyclist",  Description = "Accumulated 1,000 km of total cycling distance",                   Icon = "🌟", Category = "Cycling",             SortOrder = 6 },

        // Swimming
        new() { Id = 76, Name = "First Swim",       Description = "Logged your very first swimming activity",                         Icon = "🏊", Category = "Swimming",            SortOrder = 1 },
        new() { Id = 77, Name = "10 Swims",         Description = "Completed 10 swimming activities",                                 Icon = "🌊", Category = "Swimming",            SortOrder = 2 },
        new() { Id = 78, Name = "10 km Swimmer",    Description = "Accumulated 10 km of total swimming distance",                     Icon = "🐬", Category = "Swimming",            SortOrder = 3 },
        new() { Id = 79, Name = "50 km Swimmer",    Description = "Accumulated 50 km of total swimming distance",                     Icon = "🦈", Category = "Swimming",            SortOrder = 4 },

        // Walking & Hiking
        new() { Id = 80, Name = "First Walk",           Description = "Logged your very first walk or hike",                              Icon = "🚶", Category = "Walking & Hiking",    SortOrder = 1 },
        new() { Id = 81, Name = "10 Walks",             Description = "Completed 10 walks or hikes",                                      Icon = "🥾", Category = "Walking & Hiking",    SortOrder = 2 },
        new() { Id = 82, Name = "100 km Walker",        Description = "Accumulated 100 km of total walking and hiking distance",          Icon = "🌿", Category = "Walking & Hiking",    SortOrder = 3 },

        // Running: Speed
        new() { Id = 83,  Name = "Sub-7 Pace",          Description = "Ran 5 km+ at a pace under 7:00 /km",                              Icon = "🏃", Category = "Speed",              SortOrder = 1  },
        new() { Id = 84,  Name = "Sub-6 Pace",          Description = "Ran 5 km+ at a pace under 6:00 /km",                              Icon = "⚡", Category = "Speed",              SortOrder = 2  },
        new() { Id = 85,  Name = "Sub-5 Pace",          Description = "Ran 5 km+ at a pace under 5:00 /km",                              Icon = "🔥", Category = "Speed",              SortOrder = 3  },
        new() { Id = 86,  Name = "Sub-4:30 5K",         Description = "Ran 5 km+ at a pace under 4:30 /km",                              Icon = "💨", Category = "Speed",              SortOrder = 4  },
        new() { Id = 87,  Name = "Sub-4 5K",            Description = "Ran 5 km+ at a pace under 4:00 /km — elite territory!",           Icon = "🚀", Category = "Speed",              SortOrder = 5  },
        new() { Id = 88,  Name = "Sub-6 10K",           Description = "Ran 10 km+ at a pace under 6:00 /km",                             Icon = "⚡", Category = "Speed",              SortOrder = 6  },
        new() { Id = 89,  Name = "Sub-5 10K",           Description = "Ran 10 km+ at a pace under 5:00 /km",                             Icon = "🔥", Category = "Speed",              SortOrder = 7  },
        new() { Id = 90,  Name = "Sub-4:30 10K",        Description = "Ran 10 km+ at a pace under 4:30 /km",                             Icon = "💨", Category = "Speed",              SortOrder = 8  },
        new() { Id = 91,  Name = "Sub-2:06 Half",       Description = "Ran a half marathon+ at a pace under 6:00 /km",                   Icon = "⚡", Category = "Speed",              SortOrder = 9  },
        new() { Id = 92,  Name = "Sub-1:56 Half",       Description = "Ran a half marathon+ at a pace under 5:30 /km",                   Icon = "🔥", Category = "Speed",              SortOrder = 10 },
        new() { Id = 93,  Name = "Sub-1:45 Half",       Description = "Ran a half marathon+ at a pace under 5:00 /km",                   Icon = "💨", Category = "Speed",              SortOrder = 11 },
        new() { Id = 94,  Name = "Sub-3:30 Marathon",   Description = "Ran a full marathon+ at a pace under 5:00 /km",                   Icon = "🚀", Category = "Speed",              SortOrder = 12 },

        // Running: Consistency / Streaks
        new() { Id = 95,  Name = "3-Day Streak",        Description = "Ran on 3 consecutive days",                                        Icon = "🔆", Category = "Consistency",        SortOrder = 1  },
        new() { Id = 96,  Name = "7-Day Streak",        Description = "Ran on 7 consecutive days",                                        Icon = "📅", Category = "Consistency",        SortOrder = 2  },
        new() { Id = 97,  Name = "2-Week Streak",       Description = "Ran on 14 consecutive days",                                       Icon = "🗓️", Category = "Consistency",        SortOrder = 3  },
        new() { Id = 98,  Name = "30-Day Streak",       Description = "Ran on 30 consecutive days",                                       Icon = "🌙", Category = "Consistency",        SortOrder = 4  },
        new() { Id = 99,  Name = "60-Day Streak",       Description = "Ran on 60 consecutive days",                                       Icon = "⭐", Category = "Consistency",        SortOrder = 5  },
        new() { Id = 100, Name = "100-Day Streak",      Description = "Ran on 100 consecutive days — incredible dedication!",             Icon = "💯", Category = "Consistency",        SortOrder = 6  },

        // Running: Cadence
        new() { Id = 101, Name = "Rhythm Runner",       Description = "Ran 5 km+ with an average cadence of at least 170 spm",           Icon = "🎵", Category = "Cadence",            SortOrder = 1  },
        new() { Id = 102, Name = "Metronome",           Description = "Ran 5 km+ with an average cadence of at least 180 spm",           Icon = "🎶", Category = "Cadence",            SortOrder = 2  },
        new() { Id = 103, Name = "Stride Master",       Description = "Ran 5 km+ with an average cadence of at least 185 spm",           Icon = "🎼", Category = "Cadence",            SortOrder = 3  },

        // Running: Calorie Burn
        new() { Id = 104, Name = "Calorie Burner",      Description = "Burned 500+ calories in a single run",                            Icon = "🍔", Category = "Calorie Burn",       SortOrder = 1  },
        new() { Id = 105, Name = "Inferno",             Description = "Burned 1,000+ calories in a single run",                          Icon = "🔥", Category = "Calorie Burn",       SortOrder = 2  },
        new() { Id = 106, Name = "10K Calories",        Description = "Burned a total of 10,000 calories across all runs",               Icon = "⚡", Category = "Calorie Burn",       SortOrder = 3  },
        new() { Id = 107, Name = "50K Calories",        Description = "Burned a total of 50,000 calories across all runs",               Icon = "🌟", Category = "Calorie Burn",       SortOrder = 4  },
        new() { Id = 108, Name = "100K Calories",       Description = "Burned a total of 100,000 calories across all runs",              Icon = "🏆", Category = "Calorie Burn",       SortOrder = 5  },

        // Running: Monthly Volume
        new() { Id = 109, Name = "50 km Month",         Description = "Ran at least 50 km in a single calendar month",                   Icon = "📆", Category = "Monthly Volume",     SortOrder = 1  },
        new() { Id = 110, Name = "100 km Month",        Description = "Ran at least 100 km in a single calendar month",                  Icon = "🗓️", Category = "Monthly Volume",     SortOrder = 2  },
        new() { Id = 111, Name = "200 km Month",        Description = "Ran at least 200 km in a single calendar month",                  Icon = "⭐", Category = "Monthly Volume",     SortOrder = 3  },
        new() { Id = 112, Name = "300 km Month",        Description = "Ran at least 300 km in a single calendar month — beast mode!",    Icon = "🔥", Category = "Monthly Volume",     SortOrder = 4  },

        // Running: More Distance Milestones
        new() { Id = 113, Name = "First 20K",           Description = "Completed your first 20 km run",                                  Icon = "🎯", Category = "Distance Milestones", SortOrder = 45 },
        new() { Id = 114, Name = "First 25K",           Description = "Completed your first 25 km run",                                  Icon = "🎯", Category = "Distance Milestones", SortOrder = 55 },
        new() { Id = 115, Name = "First 30K",           Description = "Completed your first 30 km run",                                  Icon = "🏅", Category = "Distance Milestones", SortOrder = 60 },
        new() { Id = 116, Name = "First 35K",           Description = "Completed your first 35 km run",                                  Icon = "🏅", Category = "Distance Milestones", SortOrder = 65 },
        new() { Id = 117, Name = "First 75K",           Description = "Completed your first 75 km ultra run",                            Icon = "🦅", Category = "Distance Milestones", SortOrder = 90 },
        new() { Id = 118, Name = "Double Marathon",     Description = "Ran 84.39 km+ — twice the marathon distance in one go!",         Icon = "💪", Category = "Distance Milestones", SortOrder = 100 },

        // Running: More Total Distance
        new() { Id = 119, Name = "250 km Club",         Description = "Accumulated 250 km of total running distance",                    Icon = "🌱", Category = "Total Distance",      SortOrder = 15 },
        new() { Id = 120, Name = "750 km Club",         Description = "Accumulated 750 km of total running distance",                    Icon = "🌿", Category = "Total Distance",      SortOrder = 25 },
        new() { Id = 121, Name = "2000 km Club",        Description = "Accumulated 2,000 km of total running distance",                  Icon = "🌍", Category = "Total Distance",      SortOrder = 45 },
        new() { Id = 122, Name = "3000 km Club",        Description = "Accumulated 3,000 km of total running distance",                  Icon = "🌎", Category = "Total Distance",      SortOrder = 55 },
        new() { Id = 123, Name = "10,000 km Club",      Description = "Accumulated 10,000 km of total running distance",                 Icon = "🏆", Category = "Total Distance",      SortOrder = 65 },
        new() { Id = 124, Name = "15,000 km Club",      Description = "Accumulated 15,000 km — the distance around the globe!",         Icon = "🌏", Category = "Total Distance",      SortOrder = 75 },

        // Running: More Run Count
        new() { Id = 125, Name = "25 Runs",             Description = "Completed 25 runs",                                               Icon = "🏃", Category = "Runs",                SortOrder = 15 },
        new() { Id = 126, Name = "75 Runs",             Description = "Completed 75 runs",                                               Icon = "🏃", Category = "Runs",                SortOrder = 25 },
        new() { Id = 127, Name = "150 Runs",            Description = "Completed 150 runs",                                              Icon = "🏅", Category = "Runs",                SortOrder = 35 },
        new() { Id = 128, Name = "200 Runs",            Description = "Completed 200 runs",                                              Icon = "🏅", Category = "Runs",                SortOrder = 45 },
        new() { Id = 129, Name = "500 Runs",            Description = "Completed 500 runs — half a thousand!",                           Icon = "⭐", Category = "Runs",                SortOrder = 55 },
        new() { Id = 140, Name = "300 Runs",            Description = "Completed 300 runs",                                              Icon = "🥇", Category = "Runs",                SortOrder = 50 },
        new() { Id = 141, Name = "750 Runs",            Description = "Completed 750 runs",                                              Icon = "🌟", Category = "Runs",                SortOrder = 60 },
        new() { Id = 142, Name = "1,500 Runs",          Description = "Completed 1,500 runs",                                            Icon = "🚀", Category = "Runs",                SortOrder = 70 },
        new() { Id = 143, Name = "2,000 Runs",          Description = "Completed 2,000 runs",                                            Icon = "💎", Category = "Runs",                SortOrder = 80 },
        new() { Id = 144, Name = "2,500 Runs",          Description = "Completed 2,500 runs — legendary!",                              Icon = "👑", Category = "Runs",                SortOrder = 90 },

        // Running: Habits
        new() { Id = 130, Name = "Weekend Warrior",     Description = "Logged runs on 20 different Saturday or Sunday dates",            Icon = "🌅", Category = "Habits",              SortOrder = 1  },
        new() { Id = 131, Name = "5-Day Week",          Description = "Ran on 5 different days in a single calendar week",               Icon = "📅", Category = "Habits",              SortOrder = 2  },
        new() { Id = 132, Name = "6-Day Week",          Description = "Ran on 6 different days in a single calendar week",               Icon = "🗓️", Category = "Habits",              SortOrder = 3  },
        new() { Id = 133, Name = "Daily Double",        Description = "Logged 2 or more runs on the same day",                           Icon = "✌️", Category = "Habits",              SortOrder = 4  },
        new() { Id = 134, Name = "Long Runner",         Description = "Completed 10 runs of 21 km or more",                              Icon = "🦁", Category = "Habits",              SortOrder = 5  },

        // Running: More Single-Run Elevation
        new() { Id = 135, Name = "Hill Starter",        Description = "Gained 200 m of elevation in a single run",                       Icon = "⛰️", Category = "Elevation",          SortOrder = 5  },
        new() { Id = 136, Name = "Hill Climber",        Description = "Gained 500 m of elevation in a single run",                       Icon = "🏕️", Category = "Elevation",          SortOrder = 6  },
        new() { Id = 137, Name = "Mountain Runner",     Description = "Gained 1,000 m of elevation in a single run",                     Icon = "🏔️", Category = "Elevation",          SortOrder = 7  },
        new() { Id = 138, Name = "Alpine Master",       Description = "Gained 2,000 m of elevation in a single run",                     Icon = "🗻", Category = "Elevation",          SortOrder = 8  },
        new() { Id = 139, Name = "High Peaks",          Description = "Gained 3,000 m of elevation in a single run",                     Icon = "🌨️", Category = "Elevation",          SortOrder = 9  },
    ];
}
