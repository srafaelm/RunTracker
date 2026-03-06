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
                existing.BadgeType   = def.BadgeType;
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
/// Id equals the integer value of the BadgeType enum.
/// </summary>
public static class BadgeSeedData
{
    private static BadgeDefinition B(BadgeType type, string name, string description, string icon, string category, int sortOrder)
        => new() { Id = (int)type, BadgeType = type, Name = name, Description = description, Icon = icon, Category = category, SortOrder = sortOrder };

    public static readonly BadgeDefinition[] All =
    [
        // Distance Milestones (single run) — SortOrder matches ascending distance order
        B(BadgeType.First1K,            "First 1K",          "Completed your first 1km run",                                    "🎽", "Distance Milestones", 10 ),
        B(BadgeType.First5K,            "First 5K",          "Completed your first 5km run",                                    "🏅", "Distance Milestones", 20 ),
        B(BadgeType.First10K,           "First 10K",         "Completed your first 10km run",                                   "🥈", "Distance Milestones", 30 ),
        B(BadgeType.First15K,           "First 15K",         "Completed your first 15km run",                                   "🎖️", "Distance Milestones", 40 ),
        B(BadgeType.First21K,           "First Half",        "Completed your first half marathon (21.1 km)",                    "🥇", "Distance Milestones", 50 ),
        B(BadgeType.First42K,           "First Marathon",    "Completed your first full marathon (42.2 km)",                    "🏆", "Distance Milestones", 70 ),
        B(BadgeType.First50K,           "First 50K",         "Completed your first 50km ultra run",                             "🦁", "Distance Milestones", 80 ),
        B(BadgeType.First100K,          "First 100K",        "Completed your first 100km ultra run",                            "🔥", "Distance Milestones", 110),
        B(BadgeType.First100Mile,       "First 100 Miles",   "Completed your first 100-mile (160.9 km) ultra run",              "💎", "Distance Milestones", 120),
        B(BadgeType.First20K,           "First 20K",         "Completed your first 20 km run",                                  "🎯", "Distance Milestones", 45 ),
        B(BadgeType.First25K,           "First 25K",         "Completed your first 25 km run",                                  "🎯", "Distance Milestones", 55 ),
        B(BadgeType.First30K,           "First 30K",         "Completed your first 30 km run",                                  "🏅", "Distance Milestones", 60 ),
        B(BadgeType.First35K,           "First 35K",         "Completed your first 35 km run",                                  "🏅", "Distance Milestones", 65 ),
        B(BadgeType.First75K,           "First 75K",         "Completed your first 75 km ultra run",                            "🦅", "Distance Milestones", 90 ),
        B(BadgeType.FirstDoubleMarathon,"Double Marathon",   "Ran 84.39 km+ — twice the marathon distance in one go!",         "💪", "Distance Milestones", 100),

        // Total Distance
        B(BadgeType.Total100km,         "Century",           "Accumulated 100 km of total running distance",                    "💯", "Total Distance",  1 ),
        B(BadgeType.Total250km,         "250 km Club",       "Accumulated 250 km of total running distance",                    "🌱", "Total Distance",  15),
        B(BadgeType.Total500km,         "500 km Club",       "Accumulated 500 km of total running distance",                    "⭐", "Total Distance",  2 ),
        B(BadgeType.Total750km,         "750 km Club",       "Accumulated 750 km of total running distance",                    "🌿", "Total Distance",  25),
        B(BadgeType.Total1000km,        "1000 km Club",      "Accumulated 1,000 km of total running distance",                  "🌟", "Total Distance",  3 ),
        B(BadgeType.Total2000km,        "2000 km Club",      "Accumulated 2,000 km of total running distance",                  "🌍", "Total Distance",  45),
        B(BadgeType.Total3000km,        "3000 km Club",      "Accumulated 3,000 km of total running distance",                  "🌎", "Total Distance",  55),
        B(BadgeType.Total5000km,        "Ultra Runner",      "Accumulated 5,000 km of total running distance",                  "🚀", "Total Distance",  4 ),
        B(BadgeType.Total10000km,       "10,000 km Club",    "Accumulated 10,000 km of total running distance",                 "🏆", "Total Distance",  65),
        B(BadgeType.Total15000km,       "15,000 km Club",    "Accumulated 15,000 km — the distance around the globe!",         "🌏", "Total Distance",  75),

        // Runs
        B(BadgeType.FirstRun,           "First Steps",       "Logged your very first run",                                      "👟", "Runs", 1 ),
        B(BadgeType.Runs10,             "10 Runs",           "Completed 10 runs",                                               "🔟", "Runs", 2 ),
        B(BadgeType.Runs25,             "25 Runs",           "Completed 25 runs",                                               "🏃", "Runs", 15),
        B(BadgeType.Runs50,             "50 Runs",           "Completed 50 runs",                                               "🎯", "Runs", 3 ),
        B(BadgeType.Runs75,             "75 Runs",           "Completed 75 runs",                                               "🏃", "Runs", 25),
        B(BadgeType.Runs100,            "Century Runner",    "Completed 100 runs",                                              "💪", "Runs", 4 ),
        B(BadgeType.Runs150,            "150 Runs",          "Completed 150 runs",                                              "🏅", "Runs", 35),
        B(BadgeType.Runs200,            "200 Runs",          "Completed 200 runs",                                              "🏅", "Runs", 45),
        B(BadgeType.Runs300,            "300 Runs",          "Completed 300 runs",                                              "🥇", "Runs", 50),
        B(BadgeType.Runs365,            "Full Year",         "Completed 365 runs — one for every day of the year",              "📅", "Runs", 5 ),
        B(BadgeType.Runs500,            "500 Runs",          "Completed 500 runs — half a thousand!",                           "⭐", "Runs", 55),
        B(BadgeType.Runs750,            "750 Runs",          "Completed 750 runs",                                              "🌟", "Runs", 60),
        B(BadgeType.Runs1000,           "1,000 Runs",        "Completed 1,000 runs",                                            "🏟️", "Runs", 6 ),
        B(BadgeType.Runs1500,           "1,500 Runs",        "Completed 1,500 runs",                                            "🚀", "Runs", 70),
        B(BadgeType.Runs2000,           "2,000 Runs",        "Completed 2,000 runs",                                            "💎", "Runs", 80),
        B(BadgeType.Runs2500,           "2,500 Runs",        "Completed 2,500 runs — legendary!",                              "👑", "Runs", 90),

        // Elevation (single run)
        B(BadgeType.HillStarter,        "Hill Starter",      "Gained 200 m of elevation in a single run",                       "⛰️", "Elevation", 1),
        B(BadgeType.HillClimber,        "Hill Climber",      "Gained 500 m of elevation in a single run",                       "🏕️", "Elevation", 2),
        B(BadgeType.MountainRunner,     "Mountain Runner",   "Gained 1,000 m of elevation in a single run",                     "🏔️", "Elevation", 3),
        B(BadgeType.AlpineMaster,       "Alpine Master",     "Gained 2,000 m of elevation in a single run",                     "🗻", "Elevation", 4),
        B(BadgeType.HighPeaks,          "High Peaks",        "Gained 3,000 m of elevation in a single run",                     "🌨️", "Elevation", 5),
        B(BadgeType.MontBlancRun,       "Mont Blanc",        "Climbed 4,808 m elevation gain in a single run",                  "⛰️", "Elevation", 6),
        B(BadgeType.KilimanjaroRun,     "Kilimanjaro",       "Climbed 5,895 m elevation gain in a single run",                  "🌋", "Elevation", 7),
        B(BadgeType.K2Run,              "K2",                "Climbed 8,611 m elevation gain in a single run",                  "🗻", "Elevation", 8),
        B(BadgeType.EverestRun,         "Everest",           "Climbed 8,848 m elevation gain in a single run",                  "🏔️", "Elevation", 9),

        // Cumulative Elevation
        B(BadgeType.Cauberg,            "Cauberg",           "Accumulated 157 m total elevation gain across all runs",          "🚵", "Cumulative Elevation", 1 ),
        B(BadgeType.Vaalserberg,        "Vaalserberg",       "Accumulated 322 m total elevation gain across all runs",          "🏕️", "Cumulative Elevation", 2 ),
        B(BadgeType.MontVentoux,        "Mont Ventoux",      "Accumulated 1,912 m total elevation gain across all runs",        "🌬️", "Cumulative Elevation", 3 ),
        B(BadgeType.Zugspitze,          "Zugspitze",         "Accumulated 2,962 m total elevation gain across all runs",        "🏔️", "Cumulative Elevation", 4 ),
        B(BadgeType.Etna,               "Etna",              "Accumulated 3,357 m total elevation gain across all runs",        "🌋", "Cumulative Elevation", 5 ),
        B(BadgeType.EverestCumulative,  "Everest Climber",   "Accumulated 8,848 m total elevation gain across all runs",        "🧗", "Cumulative Elevation", 6 ),
        B(BadgeType.EverestLevel2,      "Everest ×2",        "Accumulated 17,696 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 7 ),
        B(BadgeType.EverestLevel3,      "Everest ×3",        "Accumulated 26,544 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 8 ),
        B(BadgeType.EverestLevel4,      "Everest ×4",        "Accumulated 35,392 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 9 ),
        B(BadgeType.EverestLevel5,      "Everest ×5",        "Accumulated 44,240 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 10),
        B(BadgeType.EverestLevel6,      "Everest ×6",        "Accumulated 53,088 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 11),
        B(BadgeType.EverestLevel7,      "Everest ×7",        "Accumulated 61,936 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 12),
        B(BadgeType.EverestLevel8,      "Everest ×8",        "Accumulated 70,784 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 13),
        B(BadgeType.EverestLevel9,      "Everest ×9",        "Accumulated 79,632 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 14),
        B(BadgeType.EverestLevel10,     "Everest ×10",       "Accumulated 88,480 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 15),

        // Exploration
        B(BadgeType.Tiles100,           "Explorer",          "Visited 100 map tiles",                                           "🗺️", "Exploration", 1),
        B(BadgeType.Tiles500,           "Adventurer",        "Visited 500 map tiles",                                           "🧭", "Exploration", 2),
        B(BadgeType.Tiles1000,          "Cartographer",      "Visited 1,000 map tiles",                                         "📍", "Exploration", 3),
        B(BadgeType.Tiles5000,          "World Traveller",   "Visited 5,000 map tiles",                                         "🌍", "Exploration", 4),
        B(BadgeType.StreetExplorer,     "Street Explorer",   "Completed 100% of all streets in any city",                       "🏙️", "Exploration", 5),

        // Cycling
        B(BadgeType.FirstRide,          "First Ride",        "Logged your very first cycling activity",                          "🚴", "Cycling", 1),
        B(BadgeType.Rides10,            "10 Rides",          "Completed 10 cycling activities",                                  "🚵", "Cycling", 2),
        B(BadgeType.Rides50,            "50 Rides",          "Completed 50 cycling activities",                                  "🏅", "Cycling", 3),
        B(BadgeType.CyclingTotal100km,  "Century Ride",      "Accumulated 100 km of total cycling distance",                     "💯", "Cycling", 4),
        B(BadgeType.CyclingTotal500km,  "500 km Cyclist",    "Accumulated 500 km of total cycling distance",                     "⭐", "Cycling", 5),
        B(BadgeType.CyclingTotal1000km, "1000 km Cyclist",   "Accumulated 1,000 km of total cycling distance",                   "🌟", "Cycling", 6),

        // Swimming
        B(BadgeType.FirstSwim,          "First Swim",        "Logged your very first swimming activity",                         "🏊", "Swimming", 1),
        B(BadgeType.Swims10,            "10 Swims",          "Completed 10 swimming activities",                                 "🌊", "Swimming", 2),
        B(BadgeType.SwimTotal10km,      "10 km Swimmer",     "Accumulated 10 km of total swimming distance",                     "🐬", "Swimming", 3),
        B(BadgeType.SwimTotal50km,      "50 km Swimmer",     "Accumulated 50 km of total swimming distance",                     "🦈", "Swimming", 4),

        // Walking & Hiking
        B(BadgeType.FirstWalk,          "First Walk",        "Logged your very first walk or hike",                              "🚶", "Walking & Hiking", 1),
        B(BadgeType.Walks10,            "10 Walks",          "Completed 10 walks or hikes",                                      "🥾", "Walking & Hiking", 2),
        B(BadgeType.WalkingTotal100km,  "100 km Walker",     "Accumulated 100 km of total walking and hiking distance",          "🌿", "Walking & Hiking", 3),

        // Speed
        B(BadgeType.Sub75K,             "Sub-7 Pace",        "Ran 5 km+ at a pace under 7:00 /km",                              "🏃", "Speed", 1 ),
        B(BadgeType.Sub65K,             "Sub-6 Pace",        "Ran 5 km+ at a pace under 6:00 /km",                              "⚡", "Speed", 2 ),
        B(BadgeType.Sub55K,             "Sub-5 Pace",        "Ran 5 km+ at a pace under 5:00 /km",                              "🔥", "Speed", 3 ),
        B(BadgeType.Sub4305K,           "Sub-4:30 5K",       "Ran 5 km+ at a pace under 4:30 /km",                              "💨", "Speed", 4 ),
        B(BadgeType.Sub45K,             "Sub-4 5K",          "Ran 5 km+ at a pace under 4:00 /km — elite territory!",           "🚀", "Speed", 5 ),
        B(BadgeType.Sub610K,            "Sub-6 10K",         "Ran 10 km+ at a pace under 6:00 /km",                             "⚡", "Speed", 6 ),
        B(BadgeType.Sub510K,            "Sub-5 10K",         "Ran 10 km+ at a pace under 5:00 /km",                             "🔥", "Speed", 7 ),
        B(BadgeType.Sub43010K,          "Sub-4:30 10K",      "Ran 10 km+ at a pace under 4:30 /km",                             "💨", "Speed", 8 ),
        B(BadgeType.Sub6Half,           "Sub-2:06 Half",     "Ran a half marathon+ at a pace under 6:00 /km",                   "⚡", "Speed", 9 ),
        B(BadgeType.Sub530Half,         "Sub-1:56 Half",     "Ran a half marathon+ at a pace under 5:30 /km",                   "🔥", "Speed", 10),
        B(BadgeType.Sub5Half,           "Sub-1:45 Half",     "Ran a half marathon+ at a pace under 5:00 /km",                   "💨", "Speed", 11),
        B(BadgeType.Sub5Marathon,       "Sub-3:30 Marathon", "Ran a full marathon+ at a pace under 5:00 /km",                   "🚀", "Speed", 12),

        // Consistency / Streaks
        B(BadgeType.Streak3,            "3-Day Streak",      "Ran on 3 consecutive days",                                        "🔆", "Consistency", 1),
        B(BadgeType.Streak7,            "7-Day Streak",      "Ran on 7 consecutive days",                                        "📅", "Consistency", 2),
        B(BadgeType.Streak14,           "2-Week Streak",     "Ran on 14 consecutive days",                                       "🗓️", "Consistency", 3),
        B(BadgeType.Streak30,           "30-Day Streak",     "Ran on 30 consecutive days",                                       "🌙", "Consistency", 4),
        B(BadgeType.Streak60,           "60-Day Streak",     "Ran on 60 consecutive days",                                       "⭐", "Consistency", 5),
        B(BadgeType.Streak100,          "100-Day Streak",    "Ran on 100 consecutive days — incredible dedication!",             "💯", "Consistency", 6),

        // Cadence
        B(BadgeType.RhythmRunner,       "Rhythm Runner",     "Ran 5 km+ with an average cadence of at least 170 spm",           "🎵", "Cadence", 1),
        B(BadgeType.MetronomeRunner,    "Metronome",         "Ran 5 km+ with an average cadence of at least 180 spm",           "🎶", "Cadence", 2),
        B(BadgeType.StrideMaster,       "Stride Master",     "Ran 5 km+ with an average cadence of at least 185 spm",           "🎼", "Cadence", 3),

        // Calorie Burn
        B(BadgeType.CalorieBurner500,   "Calorie Burner",    "Burned 500+ calories in a single run",                            "🍔", "Calorie Burn", 1),
        B(BadgeType.Inferno,            "Inferno",           "Burned 1,000+ calories in a single run",                          "🔥", "Calorie Burn", 2),
        B(BadgeType.TotalCal10K,        "10K Calories",      "Burned a total of 10,000 calories across all runs",               "⚡", "Calorie Burn", 3),
        B(BadgeType.TotalCal50K,        "50K Calories",      "Burned a total of 50,000 calories across all runs",               "🌟", "Calorie Burn", 4),
        B(BadgeType.TotalCal100K,       "100K Calories",     "Burned a total of 100,000 calories across all runs",              "🏆", "Calorie Burn", 5),

        // Monthly Volume
        B(BadgeType.Month50km,          "50 km Month",       "Ran at least 50 km in a single calendar month",                   "📆", "Monthly Volume", 1),
        B(BadgeType.Month100km,         "100 km Month",      "Ran at least 100 km in a single calendar month",                  "🗓️", "Monthly Volume", 2),
        B(BadgeType.Month200km,         "200 km Month",      "Ran at least 200 km in a single calendar month",                  "⭐", "Monthly Volume", 3),
        B(BadgeType.Month300km,         "300 km Month",      "Ran at least 300 km in a single calendar month — beast mode!",    "🔥", "Monthly Volume", 4),

        // Habits
        B(BadgeType.WeekendWarrior,     "Weekend Warrior",   "Logged runs on 20 different Saturday or Sunday dates",            "🌅", "Habits", 1),
        B(BadgeType.FiveDayWeek,        "5-Day Week",        "Ran on 5 different days in a single calendar week",               "📅", "Habits", 2),
        B(BadgeType.SixDayWeek,         "6-Day Week",        "Ran on 6 different days in a single calendar week",               "🗓️", "Habits", 3),
        B(BadgeType.DailyDouble,        "Daily Double",      "Logged 2 or more runs on the same day",                           "✌️", "Habits", 4),
        B(BadgeType.LongRunner10,       "Long Runner",       "Completed 10 runs of 21 km or more",                              "🦁", "Habits", 5),
    ];
}
