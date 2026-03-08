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
        await SeedUser(db, userManager,
            email: "alice@demo.com",
            displayName: "Alice Demo",
            bio: "Beginner runner based in Amsterdam. Started running last year and loving it!",
            gender: Gender.Female,
            birthYear: 1994, birthMonth: 6, birthDay: 12,
            heightCm: 168,
            weightKg: 62.5, goalWeightKg: 60.0,
            maxHr: 192, restingHr: 62,
            activityCount: 10,
            badges:
            [
                BadgeType.FirstRun, BadgeType.First1K, BadgeType.First5K, BadgeType.First10K,
                BadgeType.Total100km,
                BadgeType.Runs10,
                BadgeType.Sub75K, BadgeType.Sub65K,
                BadgeType.Streak3,
                BadgeType.ElevationSprint50,
            ],
            weightStart: 63.8, weightEnd: 62.5,
            workouts:
            [
                (1, "Easy 5K", WorkoutType.Easy,      SportType.Run,  5000,  null,   360, null),
                (3, "Recovery Run", WorkoutType.Recovery, SportType.Run, 4000, null,  420, null),
                (5, "Tempo 3K",    WorkoutType.Tempo,    SportType.Run, 3000, null,   300, null),
                (7, "Long Run",    WorkoutType.Long,      SportType.Run, 10000, null,  390, null),
                (9, "Easy Run",    WorkoutType.Easy,      SportType.Run, 5000, null,   370, null),
                (11, "Strength",   WorkoutType.Strength,  null,          null, 3600,  null, null),
                (13, "5K Race",    WorkoutType.Race,      SportType.Run, 5000, null,   330, null),
            ]);

        await SeedUser(db, userManager,
            email: "bob@demo.com",
            displayName: "Bob Demo",
            bio: "Marathon runner chasing a sub-3:30 finish. Training 5 days a week.",
            gender: Gender.Male,
            birthYear: 1988, birthMonth: 3, birthDay: 22,
            heightCm: 182,
            weightKg: 78.5, goalWeightKg: 75.0,
            maxHr: 185, restingHr: 52,
            activityCount: 40,
            badges:
            [
                BadgeType.FirstRun, BadgeType.First1K, BadgeType.First5K, BadgeType.First10K,
                BadgeType.First15K, BadgeType.First20K, BadgeType.First21K,
                BadgeType.Total100km, BadgeType.Total250km, BadgeType.Total500km,
                BadgeType.Runs10, BadgeType.Runs25, BadgeType.Runs50,
                BadgeType.Sub75K, BadgeType.Sub65K, BadgeType.Sub55K, BadgeType.Sub4305K,
                BadgeType.Sub610K, BadgeType.Sub510K, BadgeType.Sub43010K,
                BadgeType.Sub6Half, BadgeType.Sub530Half,
                BadgeType.ElevationSprint50, BadgeType.ElevationSprint100, BadgeType.HillStarter,
                BadgeType.Cauberg, BadgeType.Vaalserberg, BadgeType.CumElev500, BadgeType.CumElev1000,
                BadgeType.Streak3, BadgeType.Streak7,
                BadgeType.Month50km, BadgeType.Month100km,
                BadgeType.CalorieBurner500,
                BadgeType.WeekendWarrior,
            ],
            weightStart: 80.2, weightEnd: 78.5,
            workouts:
            [
                (1,  "Easy Recovery",    WorkoutType.Easy,      SportType.Run, 8000,  null,   390, null),
                (2,  "Strength",         WorkoutType.Strength,  null,          null,  3600,  null, null),
                (3,  "Tempo Run 8K",     WorkoutType.Tempo,     SportType.Run, 8000,  null,   295, null),
                (5,  "Interval 5×1K",   WorkoutType.Intervals, SportType.Run, 5000,  null,   265, null),
                (6,  "Easy Run",         WorkoutType.Easy,      SportType.Run, 10000, null,   380, null),
                (7,  "Long Run 18K",     WorkoutType.Long,      SportType.Run, 18000, null,   360, null),
                (8,  "Rest",             WorkoutType.Rest,      null,          null,  null,  null, null),
                (9,  "Easy 6K",          WorkoutType.Easy,      SportType.Run, 6000,  null,   390, null),
                (10, "Tempo 10K",        WorkoutType.Tempo,     SportType.Run, 10000, null,   295, null),
                (12, "Interval 8×400m", WorkoutType.Intervals, SportType.Run, 3200,  null,   240, null),
                (13, "Easy Run",         WorkoutType.Easy,      SportType.Run, 8000,  null,   380, null),
                (14, "Long Run 22K",     WorkoutType.Long,      SportType.Run, 22000, null,   355, null),
            ]);

        await SeedUser(db, userManager,
            email: "charlie@demo.com",
            displayName: "Charlie Demo",
            bio: "Ultra trail runner. Completed multiple 100K races. Mountains are my home.",
            gender: Gender.Male,
            birthYear: 1982, birthMonth: 11, birthDay: 5,
            heightCm: 178,
            weightKg: 72.0, goalWeightKg: 70.0,
            maxHr: 178, restingHr: 44,
            activityCount: 100,
            badges:
            [
                BadgeType.FirstRun, BadgeType.First1K, BadgeType.First5K, BadgeType.First10K,
                BadgeType.First15K, BadgeType.First20K, BadgeType.First21K, BadgeType.First25K,
                BadgeType.First30K, BadgeType.First35K, BadgeType.First42K, BadgeType.First50K,
                BadgeType.Total100km, BadgeType.Total250km, BadgeType.Total500km, BadgeType.Total750km,
                BadgeType.Total1000km, BadgeType.Total2000km,
                BadgeType.Runs10, BadgeType.Runs25, BadgeType.Runs50, BadgeType.Runs75, BadgeType.Runs100,
                BadgeType.Sub75K, BadgeType.Sub65K, BadgeType.Sub55K, BadgeType.Sub4305K, BadgeType.Sub45K,
                BadgeType.Sub610K, BadgeType.Sub510K, BadgeType.Sub43010K, BadgeType.Sub4Per10K,
                BadgeType.Sub6Half, BadgeType.Sub530Half, BadgeType.Sub5Half, BadgeType.Sub430Per21K,
                BadgeType.Sub5Marathon,
                BadgeType.ElevationSprint50, BadgeType.ElevationSprint100,
                BadgeType.HillStarter, BadgeType.HillClimber, BadgeType.MountainRunner,
                BadgeType.Cauberg, BadgeType.Vaalserberg, BadgeType.CumElev500, BadgeType.CumElev1000,
                BadgeType.MontVentoux, BadgeType.Zugspitze, BadgeType.Etna, BadgeType.CumElevMatterhorn,
                BadgeType.CumElev5000, BadgeType.CumElevKilimanjaro, BadgeType.CumElevK2,
                BadgeType.EverestCumulative,
                BadgeType.Streak3, BadgeType.Streak7, BadgeType.Streak14, BadgeType.Streak30,
                BadgeType.Month50km, BadgeType.Month100km, BadgeType.Month200km,
                BadgeType.CalorieBurner500, BadgeType.Inferno, BadgeType.TotalCal10K,
                BadgeType.WeekendWarrior, BadgeType.FiveDayWeek, BadgeType.LongRunner10,
                BadgeType.Sub4Per1K, BadgeType.Sub330Per1K,
            ],
            weightStart: 73.5, weightEnd: 72.0,
            workouts:
            [
                (1,  "Easy Trail 12K",    WorkoutType.Easy,      SportType.Run, 12000, null,  400, null),
                (2,  "Strength & Core",   WorkoutType.Strength,  null,          null,  5400, null, null),
                (3,  "Tempo 12K",         WorkoutType.Tempo,     SportType.Run, 12000, null,  285, null),
                (4,  "Easy Run 8K",       WorkoutType.Easy,      SportType.Run, 8000,  null,  400, null),
                (5,  "Interval 6×1K",    WorkoutType.Intervals, SportType.Run, 6000,  null,  250, null),
                (6,  "Mountain Trail 25K",WorkoutType.Long,      SportType.Run, 25000, null,  380, null),
                (7,  "Recovery 6K",       WorkoutType.Recovery,  SportType.Run, 6000,  null,  450, null),
                (8,  "Easy Run 10K",      WorkoutType.Easy,      SportType.Run, 10000, null,  390, null),
                (9,  "Tempo 15K",         WorkoutType.Tempo,     SportType.Run, 15000, null,  280, null),
                (10, "Strength",          WorkoutType.Strength,  null,          null,  3600, null, null),
                (11, "Interval 10×400m", WorkoutType.Intervals, SportType.Run, 4000,  null,  225, null),
                (12, "Easy Trail 14K",    WorkoutType.Easy,      SportType.Run, 14000, null,  400, null),
                (13, "Back-to-Back 20K",  WorkoutType.Long,      SportType.Run, 20000, null,  370, null),
                (14, "Long Trail 32K",    WorkoutType.Long,      SportType.Run, 32000, null,  360, null),
            ]);
    }

    private async Task SeedUser(
        AppDbContext db,
        UserManager<User> userManager,
        string email,
        string displayName,
        string bio,
        Gender gender,
        int birthYear, int birthMonth, int birthDay,
        int heightCm,
        double weightKg, double goalWeightKg,
        int maxHr, int restingHr,
        int activityCount,
        BadgeType[] badges,
        double weightStart, double weightEnd,
        (int DaysFromNow, string Title, WorkoutType Type, SportType? Sport, double? DistM, int? DurSec, int? PaceSec, int? HrZone)[] workouts)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null) return;

        var user = new User
        {
            UserName        = email,
            Email           = email,
            DisplayName     = displayName,
            Bio             = bio,
            Gender          = gender,
            BirthYear       = birthYear,
            BirthMonth      = birthMonth,
            BirthDay        = birthDay,
            HeightCm        = heightCm,
            WeightKg        = weightKg,
            GoalWeightKg    = goalWeightKg,
            MaxHeartRate    = maxHr,
            RestingHeartRate= restingHr,
            StravaHistoricalSyncComplete = true,
            EmailConfirmed  = true,
            ProfilePictureUrl = $"https://api.dicebear.com/9.x/initials/svg?seed={Uri.EscapeDataString(email)}",
        };

        var result = await userManager.CreateAsync(user, "demo");
        if (!result.Succeeded)
        {
            _logger.LogWarning("Failed to create test user {Email}: {Errors}", email,
                string.Join(", ", result.Errors.Select(e => e.Description)));
            return;
        }

        // Activities
        var activities = TestActivityGenerator.Generate(user.Id, activityCount);
        db.Activities.AddRange(activities);

        // Badges — stagger dates over past 12 months, seeded per user
        var rng   = new Random(email.Aggregate(0, (h, c) => h * 31 + c));
        var today = DateTime.UtcNow.Date;
        var badgeList = badges
            .Select((bt, i) =>
            {
                var daysBack = (int)((double)(i + 1) / badges.Length * 365) + rng.Next(0, 10);
                return new UserBadge
                {
                    UserId    = user.Id,
                    BadgeType = bt,
                    EarnedAt  = today.AddDays(-daysBack).AddHours(rng.Next(6, 21)),
                };
            })
            .ToList();
        db.UserBadges.AddRange(badgeList);

        // Weight entries — weekly for 12 weeks, trending from weightStart → weightEnd
        for (int w = 11; w >= 0; w--)
        {
            var fraction = (double)(11 - w) / 11.0;
            var kg       = weightStart + (weightEnd - weightStart) * fraction + (rng.NextDouble() - 0.5) * 0.3;
            db.WeightEntries.Add(new WeightEntry
            {
                UserId   = user.Id,
                Date     = DateOnly.FromDateTime(today.AddDays(-w * 7)),
                WeightKg = Math.Round(kg, 1),
            });
        }

        // Scheduled workouts
        foreach (var (daysFromNow, title, type, sport, distM, durSec, paceSec, hrZone) in workouts)
        {
            db.ScheduledWorkouts.Add(new ScheduledWorkout
            {
                UserId                  = user.Id,
                Date                    = today.AddDays(daysFromNow).AddHours(7),
                Title                   = title,
                WorkoutType             = type,
                SportType               = sport,
                PlannedDistanceMeters   = distM,
                PlannedDurationSeconds  = durSec,
                PlannedPaceSecondsPerKm = paceSec,
                PlannedHeartRateZone    = hrZone,
            });
        }

        await db.SaveChangesAsync();
        _logger.LogInformation("Created test user {Email} with {Count} activities, {B} badges, weight history and scheduled workouts.",
            email, activityCount, badges.Length);
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

        // Total Distance — sequential sort order by ascending distance
        B(BadgeType.Total100km,         "Century",           "Accumulated 100 km of total running distance",                    "💯", "Total Distance",  1 ),
        B(BadgeType.Total250km,         "250 km Club",       "Accumulated 250 km of total running distance",                    "🌱", "Total Distance",  2 ),
        B(BadgeType.Total500km,         "500 km Club",       "Accumulated 500 km of total running distance",                    "⭐", "Total Distance",  3 ),
        B(BadgeType.Total750km,         "750 km Club",       "Accumulated 750 km of total running distance",                    "🌿", "Total Distance",  4 ),
        B(BadgeType.Total1000km,        "1000 km Club",      "Accumulated 1,000 km of total running distance",                  "🌟", "Total Distance",  5 ),
        B(BadgeType.Total2000km,        "2000 km Club",      "Accumulated 2,000 km of total running distance",                  "🌍", "Total Distance",  6 ),
        B(BadgeType.Total3000km,        "3000 km Club",      "Accumulated 3,000 km of total running distance",                  "🌎", "Total Distance",  7 ),
        B(BadgeType.Total5000km,        "Ultra Runner",      "Accumulated 5,000 km of total running distance",                  "🚀", "Total Distance",  8 ),
        B(BadgeType.Total10000km,       "10,000 km Club",    "Accumulated 10,000 km of total running distance",                 "🏆", "Total Distance",  9 ),
        B(BadgeType.Total15000km,       "15,000 km Club",    "Accumulated 15,000 km — the distance around the globe!",         "🌏", "Total Distance",  10),

        // Runs — sequential sort order by ascending count
        B(BadgeType.FirstRun,           "First Steps",       "Logged your very first run",                                      "👟", "Runs", 1 ),
        B(BadgeType.Runs10,             "10 Runs",           "Completed 10 runs",                                               "🔟", "Runs", 2 ),
        B(BadgeType.Runs25,             "25 Runs",           "Completed 25 runs",                                               "🏃", "Runs", 3 ),
        B(BadgeType.Runs50,             "50 Runs",           "Completed 50 runs",                                               "🎯", "Runs", 4 ),
        B(BadgeType.Runs75,             "75 Runs",           "Completed 75 runs",                                               "🏃", "Runs", 5 ),
        B(BadgeType.Runs100,            "Century Runner",    "Completed 100 runs",                                              "💪", "Runs", 6 ),
        B(BadgeType.Runs150,            "150 Runs",          "Completed 150 runs",                                              "🏅", "Runs", 7 ),
        B(BadgeType.Runs200,            "200 Runs",          "Completed 200 runs",                                              "🏅", "Runs", 8 ),
        B(BadgeType.Runs300,            "300 Runs",          "Completed 300 runs",                                              "🥇", "Runs", 9 ),
        B(BadgeType.Runs365,            "Full Year",         "Completed 365 runs — one for every day of the year",              "📅", "Runs", 10),
        B(BadgeType.Runs500,            "500 Runs",          "Completed 500 runs — half a thousand!",                           "⭐", "Runs", 11),
        B(BadgeType.Runs750,            "750 Runs",          "Completed 750 runs",                                              "🌟", "Runs", 12),
        B(BadgeType.Runs1000,           "1,000 Runs",        "Completed 1,000 runs",                                            "🏟️", "Runs", 13),
        B(BadgeType.Runs1500,           "1,500 Runs",        "Completed 1,500 runs",                                            "🚀", "Runs", 14),
        B(BadgeType.Runs2000,           "2,000 Runs",        "Completed 2,000 runs",                                            "💎", "Runs", 15),
        B(BadgeType.Runs2500,           "2,500 Runs",        "Completed 2,500 runs — legendary!",                               "👑", "Runs", 16),

        // Elevation (single run) — sorted by ascending elevation threshold
        B(BadgeType.ElevationSprint50,  "Hill Topper",       "Gained 50 m of elevation in a single run",                        "🌄", "Elevation", 1 ),
        B(BadgeType.ElevationSprint100, "Hill Charger",      "Gained 100 m of elevation in a single run",                       "⛰️", "Elevation", 2 ),
        B(BadgeType.HillStarter,        "Hill Starter",      "Gained 200 m of elevation in a single run",                       "🏕️", "Elevation", 3 ),
        B(BadgeType.HillClimber,        "Hill Climber",      "Gained 500 m of elevation in a single run",                       "🧗", "Elevation", 4 ),
        B(BadgeType.MountainRunner,     "Mountain Runner",   "Gained 1,000 m of elevation in a single run",                     "🏔️", "Elevation", 5 ),
        B(BadgeType.AlpineMaster,       "Alpine Master",     "Gained 2,000 m of elevation in a single run",                     "🗻", "Elevation", 6 ),
        B(BadgeType.HighPeaks,          "High Peaks",        "Gained 3,000 m of elevation in a single run",                     "🌨️", "Elevation", 7 ),
        B(BadgeType.MontBlancRun,       "Mont Blanc",        "Climbed 4,808 m elevation gain in a single run",                  "🏔️", "Elevation", 8 ),
        B(BadgeType.KilimanjaroRun,     "Kilimanjaro",       "Climbed 5,895 m elevation gain in a single run",                  "🌋", "Elevation", 9 ),
        B(BadgeType.K2Run,              "K2",                "Climbed 8,611 m elevation gain in a single run",                  "🗺️", "Elevation", 10),
        B(BadgeType.EverestRun,         "Everest",           "Climbed 8,848 m elevation gain in a single run",                  "🏔️", "Elevation", 11),

        // Cumulative Elevation — sorted by ascending threshold
        B(BadgeType.Cauberg,            "Cauberg",           "Accumulated 157 m total elevation gain across all runs",          "🚵", "Cumulative Elevation", 1 ),
        B(BadgeType.Vaalserberg,        "Vaalserberg",       "Accumulated 322 m total elevation gain across all runs",          "🏕️", "Cumulative Elevation", 2 ),
        B(BadgeType.CumElev500,         "500m Climber",      "Accumulated 500 m total elevation gain across all runs",          "⛰️", "Cumulative Elevation", 3 ),
        B(BadgeType.CumElev1000,        "1km Climber",       "Accumulated 1,000 m total elevation gain across all runs",        "🏔️", "Cumulative Elevation", 4 ),
        B(BadgeType.MontVentoux,        "Mont Ventoux",      "Accumulated 1,912 m total elevation gain across all runs",        "🌬️", "Cumulative Elevation", 5 ),
        B(BadgeType.Zugspitze,          "Zugspitze",         "Accumulated 2,962 m total elevation gain across all runs",        "🏔️", "Cumulative Elevation", 6 ),
        B(BadgeType.Etna,               "Etna",              "Accumulated 3,357 m total elevation gain across all runs",        "🌋", "Cumulative Elevation", 7 ),
        B(BadgeType.CumElevMatterhorn,  "Matterhorn",        "Accumulated 4,478 m total elevation gain across all runs",        "🧗", "Cumulative Elevation", 8 ),
        B(BadgeType.CumElev5000,        "5km Skyward",       "Accumulated 5,000 m total elevation gain across all runs",        "🔼", "Cumulative Elevation", 9 ),
        B(BadgeType.CumElevKilimanjaro, "Kilimanjaro Climb", "Accumulated 5,895 m total elevation gain across all runs",        "🌄", "Cumulative Elevation", 10),
        B(BadgeType.CumElevK2,          "K2 Climb",          "Accumulated 8,611 m total elevation gain across all runs",        "❄️", "Cumulative Elevation", 11),
        B(BadgeType.EverestCumulative,  "Everest Climber",   "Accumulated 8,848 m total elevation gain across all runs",        "🧗", "Cumulative Elevation", 12),
        B(BadgeType.EverestLevel2,      "Everest ×2",        "Accumulated 17,696 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 13),
        B(BadgeType.CumElev25000,       "25km Skyward",      "Accumulated 25,000 m total elevation gain across all runs",       "🛸", "Cumulative Elevation", 14),
        B(BadgeType.EverestLevel3,      "Everest ×3",        "Accumulated 26,544 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 15),
        B(BadgeType.EverestLevel4,      "Everest ×4",        "Accumulated 35,392 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 16),
        B(BadgeType.EverestLevel5,      "Everest ×5",        "Accumulated 44,240 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 17),
        B(BadgeType.CumElev50000,       "50km Skyward",      "Accumulated 50,000 m total elevation gain across all runs",       "🌠", "Cumulative Elevation", 18),
        B(BadgeType.EverestLevel6,      "Everest ×6",        "Accumulated 53,088 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 19),
        B(BadgeType.EverestLevel7,      "Everest ×7",        "Accumulated 61,936 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 20),
        B(BadgeType.EverestLevel8,      "Everest ×8",        "Accumulated 70,784 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 21),
        B(BadgeType.EverestLevel9,      "Everest ×9",        "Accumulated 79,632 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 22),
        B(BadgeType.EverestLevel10,     "Everest ×10",       "Accumulated 88,480 m total elevation gain across all runs",       "🧗", "Cumulative Elevation", 23),
        B(BadgeType.CumElev100000,      "100km Skyward",     "Accumulated 100,000 m total elevation gain across all runs",      "🪐", "Cumulative Elevation", 24),

        // Exploration
        B(BadgeType.Tiles100,           "Explorer",          "Visited 100 map tiles",                                           "🗺️", "Exploration", 1),
        B(BadgeType.Tiles500,           "Adventurer",        "Visited 500 map tiles",                                           "🧭", "Exploration", 2),
        B(BadgeType.Tiles1000,          "Cartographer",      "Visited 1,000 map tiles",                                         "📍", "Exploration", 3),
        B(BadgeType.Tiles5000,          "World Traveller",   "Visited 5,000 map tiles",                                         "🌍", "Exploration", 4),
        B(BadgeType.StreetExplorer,     "Street Explorer",   "Completed 100% of all streets in any city",                       "🏙️", "Exploration", 5),

        // Cycling
        B(BadgeType.FirstRide,           "First Ride",          "Logged your very first cycling activity",                         "🚴", "Cycling",  1),
        B(BadgeType.FirstRide20K,        "First 20K Ride",      "Completed your first 20 km ride",                                "🚵", "Cycling",  2),
        B(BadgeType.FirstRide50K,        "Half Century",        "Completed your first 50 km ride",                                "🎯", "Cycling",  3),
        B(BadgeType.FirstRide100K,       "Century Ride",        "Completed your first 100 km ride in one go",                     "💯", "Cycling",  4),
        B(BadgeType.FirstRide200K,       "Double Century",      "Completed your first 200 km ride in one go",                     "💎", "Cycling",  5),
        B(BadgeType.Rides10,             "10 Rides",            "Completed 10 cycling activities",                                "🔟", "Cycling",  6),
        B(BadgeType.Rides25,             "25 Rides",            "Completed 25 cycling activities",                                "🏅", "Cycling",  7),
        B(BadgeType.Rides50,             "50 Rides",            "Completed 50 cycling activities",                                "⭐", "Cycling",  8),
        B(BadgeType.Rides100,            "100 Rides",           "Completed 100 cycling activities",                               "🌟", "Cycling",  9),
        B(BadgeType.Rides200,            "200 Rides",           "Completed 200 cycling activities",                               "🚀", "Cycling", 10),
        B(BadgeType.Rides500,            "500 Rides",           "Completed 500 cycling activities — dedicated cyclist!",          "👑", "Cycling", 11),
        B(BadgeType.CyclingTotal100km,   "100 km Cyclist",      "Accumulated 100 km of total cycling distance",                   "🌱", "Cycling", 12),
        B(BadgeType.CyclingTotal500km,   "500 km Cyclist",      "Accumulated 500 km of total cycling distance",                   "🌿", "Cycling", 13),
        B(BadgeType.CyclingTotal1000km,  "1,000 km Cyclist",    "Accumulated 1,000 km of total cycling distance",                 "🌍", "Cycling", 14),
        B(BadgeType.CyclingTotal2000km,  "2,000 km Cyclist",    "Accumulated 2,000 km of total cycling distance",                 "🌎", "Cycling", 15),
        B(BadgeType.CyclingTotal5000km,  "5,000 km Cyclist",    "Accumulated 5,000 km of total cycling distance",                 "🌏", "Cycling", 16),
        B(BadgeType.CyclingTotal10000km, "10,000 km Cyclist",   "Accumulated 10,000 km of total cycling distance",                "🏆", "Cycling", 17),
        B(BadgeType.CyclingElevation500, "Hill Rider",          "Gained 500 m of elevation in a single ride",                     "⛰️",  "Cycling", 18),
        B(BadgeType.CyclingElevation1000,"Climber",             "Gained 1,000 m of elevation in a single ride",                   "🏔️", "Cycling", 19),
        B(BadgeType.CyclingElevation2000,"King of the Mountain","Gained 2,000 m of elevation in a single ride",                   "👑", "Cycling", 20),
        B(BadgeType.CyclingCumElev5000,  "5km Up",              "Accumulated 5,000 m of cycling elevation gain",                  "🔼", "Cycling", 21),
        B(BadgeType.CyclingCumElev10000, "10km Up",             "Accumulated 10,000 m of cycling elevation gain",                 "🌄", "Cycling", 22),
        B(BadgeType.CyclingCumElev50000, "50km Up",             "Accumulated 50,000 m of cycling elevation gain",                 "🛸", "Cycling", 23),
        B(BadgeType.CyclingSpeed30,      "30 km/h Club",        "Averaged 30+ km/h on a 20 km+ ride",                            "⚡", "Cycling", 24),
        B(BadgeType.CyclingSpeed35,      "35 km/h Club",        "Averaged 35+ km/h on a 20 km+ ride",                            "🔥", "Cycling", 25),
        B(BadgeType.CyclingSpeed40,      "40 km/h Club",        "Averaged 40+ km/h on a 20 km+ ride — pro level!",               "🚀", "Cycling", 26),
        B(BadgeType.CyclingMonth500km,   "500 km Month",        "Cycled at least 500 km in a single calendar month",              "📆", "Cycling", 27),
        B(BadgeType.CyclingMonth1000km,  "1,000 km Month",      "Cycled at least 1,000 km in a single calendar month",            "🗓️", "Cycling", 28),

        // Swimming
        B(BadgeType.FirstSwim,           "First Swim",          "Logged your very first swimming activity",                        "🏊", "Swimming",  1),
        B(BadgeType.FirstSwim500m,       "First 500m",          "Swam 500 m in a single activity",                                "🌊", "Swimming",  2),
        B(BadgeType.FirstSwim1K,         "First 1K Swim",       "Swam 1 km in a single activity",                                 "🐟", "Swimming",  3),
        B(BadgeType.FirstSwim2K,         "First 2K Swim",       "Swam 2 km in a single activity",                                 "🐬", "Swimming",  4),
        B(BadgeType.FirstSwim5K,         "First 5K Swim",       "Swam 5 km in a single activity — iron will!",                    "🦈", "Swimming",  5),
        B(BadgeType.Swims10,             "10 Swims",            "Completed 10 swimming activities",                               "🔟", "Swimming",  6),
        B(BadgeType.Swims25,             "25 Swims",            "Completed 25 swimming activities",                               "🏅", "Swimming",  7),
        B(BadgeType.Swims50,             "50 Swims",            "Completed 50 swimming activities",                               "⭐", "Swimming",  8),
        B(BadgeType.Swims100,            "100 Swims",           "Completed 100 swimming activities",                              "🌟", "Swimming",  9),
        B(BadgeType.SwimTotal10km,       "10 km Swimmer",       "Accumulated 10 km of total swimming distance",                   "💧", "Swimming", 10),
        B(BadgeType.SwimTotal25km,       "25 km Swimmer",       "Accumulated 25 km of total swimming distance",                   "🌊", "Swimming", 11),
        B(BadgeType.SwimTotal50km,       "50 km Swimmer",       "Accumulated 50 km of total swimming distance",                   "🐬", "Swimming", 12),
        B(BadgeType.SwimTotal100km,      "100 km Swimmer",      "Accumulated 100 km of total swimming distance",                  "🦈", "Swimming", 13),
        B(BadgeType.SwimTotal200km,      "200 km Swimmer",      "Accumulated 200 km of total swimming distance — legendary!",     "🏆", "Swimming", 14),

        // Walking & Hiking
        B(BadgeType.FirstWalk,           "First Walk",          "Logged your very first walk or hike",                            "🚶", "Walking & Hiking",  1),
        B(BadgeType.FirstHike10K,        "First 10K Hike",      "Completed your first 10 km walk or hike",                        "🥾", "Walking & Hiking",  2),
        B(BadgeType.FirstHike20K,        "First 20K Hike",      "Completed your first 20 km walk or hike",                        "🏕️", "Walking & Hiking",  3),
        B(BadgeType.Walks10,             "10 Walks",            "Completed 10 walks or hikes",                                    "🔟", "Walking & Hiking",  4),
        B(BadgeType.Walks25,             "25 Walks",            "Completed 25 walks or hikes",                                    "🏅", "Walking & Hiking",  5),
        B(BadgeType.Walks50,             "50 Walks",            "Completed 50 walks or hikes",                                    "⭐", "Walking & Hiking",  6),
        B(BadgeType.Walks100,            "100 Walks",           "Completed 100 walks or hikes",                                   "🌟", "Walking & Hiking",  7),
        B(BadgeType.WalkingTotal100km,   "100 km Walker",       "Accumulated 100 km of total walking and hiking distance",        "🌿", "Walking & Hiking",  8),
        B(BadgeType.WalkingTotal250km,   "250 km Walker",       "Accumulated 250 km of total walking and hiking distance",        "🌲", "Walking & Hiking",  9),
        B(BadgeType.WalkingTotal500km,   "500 km Walker",       "Accumulated 500 km of total walking and hiking distance",        "🏔️", "Walking & Hiking", 10),
        B(BadgeType.WalkingTotal1000km,  "1,000 km Walker",     "Accumulated 1,000 km of total walking and hiking distance",      "🗺️", "Walking & Hiking", 11),
        B(BadgeType.HikingElevation500,  "Trail Climber",       "Gained 500 m of elevation in a single walk or hike",             "⛰️",  "Walking & Hiking", 12),
        B(BadgeType.HikingElevation1000, "Mountain Hiker",      "Gained 1,000 m of elevation in a single walk or hike",           "🏔️", "Walking & Hiking", 13),

        // Speed — sorted by distance then pace (easiest to hardest)
        B(BadgeType.Sub85K,             "Sub-8 Pace",        "Ran 5 km+ at a pace under 8:00 /km",                              "🚶", "Speed", 0 ),
        B(BadgeType.Sub75K,             "Sub-7 Pace",        "Ran 5 km+ at a pace under 7:00 /km",                              "🏃", "Speed", 1 ),
        B(BadgeType.Sub65K,             "Sub-6 Pace",        "Ran 5 km+ at a pace under 6:00 /km",                              "⚡", "Speed", 2 ),
        B(BadgeType.Sub55K,             "Sub-5 Pace",        "Ran 5 km+ at a pace under 5:00 /km",                              "🔥", "Speed", 3 ),
        B(BadgeType.Sub4305K,           "Sub-4:30 5K",       "Ran 5 km+ at a pace under 4:30 /km",                              "💨", "Speed", 4 ),
        B(BadgeType.Sub45K,             "Sub-4 5K",          "Ran 5 km+ at a pace under 4:00 /km",                              "🚀", "Speed", 5 ),
        B(BadgeType.Sub610K,            "Sub-6 10K",         "Ran 10 km+ at a pace under 6:00 /km",                             "⚡", "Speed", 6 ),
        B(BadgeType.Sub510K,            "Sub-5 10K",         "Ran 10 km+ at a pace under 5:00 /km",                             "🔥", "Speed", 7 ),
        B(BadgeType.Sub43010K,          "Sub-4:30 10K",      "Ran 10 km+ at a pace under 4:30 /km",                             "💨", "Speed", 8 ),
        B(BadgeType.Sub4Per10K,         "Sub-4 10K",         "Ran 10 km+ at a pace under 4:00 /km",                             "🚀", "Speed", 9 ),
        B(BadgeType.Sub6Half,           "Sub-2:06 Half",     "Ran a half marathon+ at a pace under 6:00 /km",                   "⚡", "Speed", 10),
        B(BadgeType.Sub530Half,         "Sub-1:56 Half",     "Ran a half marathon+ at a pace under 5:30 /km",                   "🔥", "Speed", 11),
        B(BadgeType.Sub5Half,           "Sub-1:45 Half",     "Ran a half marathon+ at a pace under 5:00 /km",                   "💨", "Speed", 12),
        B(BadgeType.Sub430Per21K,       "Sub-1:35 Half",     "Ran a half marathon+ at a pace under 4:30 /km",                   "🌟", "Speed", 13),
        B(BadgeType.Sub4Per21K,         "Sub-1:24 Half",     "Ran a half marathon+ at a pace under 4:00 /km — elite!",          "👑", "Speed", 14),
        B(BadgeType.Sub5Marathon,       "Sub-3:30 Marathon", "Ran a full marathon+ at a pace under 5:00 /km",                   "🚀", "Speed", 15),
        B(BadgeType.Sub430Marathon,     "Sub-3:10 Marathon", "Ran a full marathon+ at a pace under 4:30 /km",                   "💎", "Speed", 16),
        B(BadgeType.Sub4Marathon,       "Sub-2:49 Marathon", "Ran a full marathon+ at a pace under 4:00 /km — world class!",    "👑", "Speed", 17),
        B(BadgeType.Sub5Per1K,          "Sub-5 1K",          "Ran 1 km+ at a pace under 5:00 /km",                              "🏃", "Speed", 18),
        B(BadgeType.Sub45Per1K,         "Sub-4:30 1K",       "Ran 1 km+ at a pace under 4:30 /km",                              "⚡", "Speed", 19),
        B(BadgeType.Sub4Per1K,          "Sub-4 1K",          "Ran 1 km+ at a pace under 4:00 /km",                              "🔥", "Speed", 20),
        B(BadgeType.Sub330Per1K,        "Sub-3:30 1K",       "Ran 1 km+ at a pace under 3:30 /km",                              "💨", "Speed", 21),
        B(BadgeType.Sub3Per1K,          "Sub-3 1K",          "Ran 1 km+ at a pace under 3:00 /km",                              "🌟", "Speed", 22),
        B(BadgeType.Sub3Per400m,        "Sub-3 400m",        "Ran 400 m+ at a pace under 3:00 /km — sprinter!",                 "⚡", "Speed", 23),

        // Consistency / Streaks
        B(BadgeType.Streak3,            "3-Day Streak",      "Ran on 3 consecutive days",                                        "🔆", "Consistency", 1),
        B(BadgeType.Streak7,            "7-Day Streak",      "Ran on 7 consecutive days",                                        "📅", "Consistency", 2),
        B(BadgeType.Streak14,           "2-Week Streak",     "Ran on 14 consecutive days",                                       "🗓️", "Consistency", 3),
        B(BadgeType.Streak30,           "30-Day Streak",     "Ran on 30 consecutive days",                                       "🌙", "Consistency", 4),
        B(BadgeType.Streak60,           "60-Day Streak",     "Ran on 60 consecutive days",                                       "⭐", "Consistency", 5),
        B(BadgeType.Streak100,          "100-Day Streak",    "Ran on 100 consecutive days — incredible dedication!",             "💯", "Consistency", 6),
        B(BadgeType.Streak200,          "200-Day Streak",    "Ran on 200 consecutive days",                                      "🔥", "Consistency", 7),
        B(BadgeType.Streak365,          "Full Year Streak",  "Ran every single day for an entire year — legendary!",             "👑", "Consistency", 8),

        // Cadence
        B(BadgeType.RhythmRunner,       "Rhythm Runner",     "Ran 5 km+ with an average cadence of at least 170 spm",           "🎵", "Cadence", 1),
        B(BadgeType.MetronomeRunner,    "Metronome",         "Ran 5 km+ with an average cadence of at least 180 spm",           "🎶", "Cadence", 2),
        B(BadgeType.StrideMaster,       "Stride Master",     "Ran 5 km+ with an average cadence of at least 185 spm",           "🎼", "Cadence", 3),
        B(BadgeType.StrideLegend,       "Stride Legend",     "Ran 5 km+ with an average cadence of at least 190 spm",           "🎹", "Cadence", 4),

        // Calorie Burn
        B(BadgeType.CalorieBurner500,   "Calorie Burner",    "Burned 500+ calories in a single run",                            "🍔", "Calorie Burn", 1),
        B(BadgeType.Inferno,            "Inferno",           "Burned 1,000+ calories in a single run",                          "🔥", "Calorie Burn", 2),
        B(BadgeType.TotalCal10K,        "10K Calories",      "Burned a total of 10,000 calories across all runs",               "⚡", "Calorie Burn", 3),
        B(BadgeType.TotalCal50K,        "50K Calories",      "Burned a total of 50,000 calories across all runs",               "🌟", "Calorie Burn", 4),
        B(BadgeType.TotalCal100K,       "100K Calories",     "Burned a total of 100,000 calories across all runs",              "🏆", "Calorie Burn", 5),
        B(BadgeType.TotalCal200K,       "200K Calories",     "Burned a total of 200,000 calories across all runs",              "💎", "Calorie Burn", 6),
        B(BadgeType.TotalCal500K,       "500K Calories",     "Burned a total of 500,000 calories across all runs — furnace!",   "🌋", "Calorie Burn", 7),

        // Monthly Volume
        B(BadgeType.Month50km,          "50 km Month",       "Ran at least 50 km in a single calendar month",                   "📆", "Monthly Volume", 1),
        B(BadgeType.Month100km,         "100 km Month",      "Ran at least 100 km in a single calendar month",                  "🗓️", "Monthly Volume", 2),
        B(BadgeType.Month150km,         "150 km Month",      "Ran at least 150 km in a single calendar month",                  "⭐", "Monthly Volume", 3),
        B(BadgeType.Month200km,         "200 km Month",      "Ran at least 200 km in a single calendar month",                  "🌟", "Monthly Volume", 4),
        B(BadgeType.Month300km,         "300 km Month",      "Ran at least 300 km in a single calendar month",                  "🔥", "Monthly Volume", 5),
        B(BadgeType.Month400km,         "400 km Month",      "Ran at least 400 km in a single calendar month",                  "💎", "Monthly Volume", 6),
        B(BadgeType.Month500km,         "500 km Month",      "Ran at least 500 km in a single calendar month — beast mode!",    "👑", "Monthly Volume", 7),

        // Yearly Volume
        B(BadgeType.Year500km,          "500 km Year",       "Ran at least 500 km in a single calendar year",                   "📅", "Yearly Volume", 1),
        B(BadgeType.Year1000km,         "1,000 km Year",     "Ran at least 1,000 km in a single calendar year",                 "🌟", "Yearly Volume", 2),
        B(BadgeType.Year2000km,         "2,000 km Year",     "Ran at least 2,000 km in a single calendar year",                 "🚀", "Yearly Volume", 3),
        B(BadgeType.Year3000km,         "3,000 km Year",     "Ran at least 3,000 km in a single calendar year — elite!",        "👑", "Yearly Volume", 4),

        // Total Running Time
        B(BadgeType.TotalHours100,      "100 Hours",         "Accumulated 100 hours of running moving time",                    "⏱️", "Total Time", 1),
        B(BadgeType.TotalHours250,      "250 Hours",         "Accumulated 250 hours of running moving time",                    "⌚", "Total Time", 2),
        B(BadgeType.TotalHours500,      "500 Hours",         "Accumulated 500 hours of running moving time",                    "🕰️", "Total Time", 3),
        B(BadgeType.TotalHours1000,     "1,000 Hours",       "Accumulated 1,000 hours of running moving time — dedicated!",     "🏆", "Total Time", 4),

        // Habits
        B(BadgeType.WeekendWarrior,     "Weekend Warrior",   "Logged runs on 20 different Saturday or Sunday dates",            "🌅", "Habits", 1),
        B(BadgeType.WeekendWarrior50,   "Weekend Regular",   "Logged runs on 50 different Saturday or Sunday dates",            "🌄", "Habits", 2),
        B(BadgeType.WeekendWarrior100,  "Weekend Legend",    "Logged runs on 100 different Saturday or Sunday dates",           "🌠", "Habits", 3),
        B(BadgeType.FiveDayWeek,        "5-Day Week",        "Ran on 5 different days in a single calendar week",               "📅", "Habits", 4),
        B(BadgeType.SixDayWeek,         "6-Day Week",        "Ran on 6 different days in a single calendar week",               "🗓️", "Habits", 5),
        B(BadgeType.DailyDouble,        "Daily Double",      "Logged 2 or more runs on the same day",                           "✌️", "Habits", 6),
        B(BadgeType.EarlyBird,          "Early Bird",        "Completed a run starting before 7:00 AM",                         "🌅", "Habits", 7),
        B(BadgeType.EarlyBird10,        "Morning Devotee",   "Completed 10 runs starting before 8:00 AM",                       "☀️", "Habits", 8),
        B(BadgeType.NightOwl,           "Night Owl",         "Completed a run starting at or after 9:00 PM",                    "🦉", "Habits", 9),
        B(BadgeType.NightOwl10,         "Night Runner",      "Completed 10 runs starting at or after 8:00 PM",                  "🌙", "Habits", 10),
        B(BadgeType.LongRunner10,       "Long Runner",       "Completed 10 runs of 21 km or more",                              "🦁", "Habits", 11),
        B(BadgeType.LongRunner25,       "Long Run Addict",   "Completed 25 runs of 21 km or more",                              "🏔️", "Habits", 12),
        B(BadgeType.LongRunner50,       "Ultra Distance",    "Completed 50 runs of 21 km or more",                              "🌋", "Habits", 13),
        B(BadgeType.LongRunner100,      "Long Run Legend",   "Completed 100 runs of 21 km or more",                             "👑", "Habits", 14),
        B(BadgeType.Run1Hour,           "Hour Run",          "Completed a single run lasting 1 hour or more",                   "⏱️", "Habits", 15),
        B(BadgeType.Run2Hours,          "2 Hour Run",        "Completed a single run lasting 2 hours or more",                  "⌚", "Habits", 16),
        B(BadgeType.Run3Hours,          "3 Hour Run",        "Completed a single run lasting 3 hours or more",                  "🕰️", "Habits", 17),
        B(BadgeType.Run6Hours,          "6 Hour Run",        "Completed a single run lasting 6 hours or more",                  "🏔️", "Habits", 18),

        // Marathon & Half Marathon Counts
        B(BadgeType.HalfMarathonCount5, "5× Half",           "Completed 5 half marathon runs (21 km+)",                         "🥈", "Runs",  17),
        B(BadgeType.HalfMarathonCount10,"10× Half",          "Completed 10 half marathon runs",                                 "🥇", "Runs",  18),
        B(BadgeType.HalfMarathonCount25,"25× Half",          "Completed 25 half marathon runs — half marathon machine!",        "🏆", "Runs",  19),
        B(BadgeType.MarathonFinisher3,  "3× Marathon",       "Completed 3 full marathon runs (42.2 km+)",                       "🏅", "Runs",  20),
        B(BadgeType.MarathonFinisher5,  "5× Marathon",       "Completed 5 full marathons",                                      "🌟", "Runs",  21),
        B(BadgeType.MarathonFinisher10, "10× Marathon",      "Completed 10 full marathons",                                     "🚀", "Runs",  22),
        B(BadgeType.MarathonFinisher20, "20× Marathon",      "Completed 20 full marathons — marathon legend!",                  "💎", "Runs",  23),
        B(BadgeType.MarathonFinisher50, "50× Marathon",      "Completed 50 full marathons — extraordinary!",                    "👑", "Runs",  24),

        // More Total Distance
        B(BadgeType.Total4000km,        "4,000 km Club",     "Accumulated 4,000 km of total running distance",                  "🌟", "Total Distance", 11),
        B(BadgeType.Total6000km,        "6,000 km Club",     "Accumulated 6,000 km of total running distance",                  "🚀", "Total Distance", 12),
        B(BadgeType.Total7500km,        "7,500 km Club",     "Accumulated 7,500 km of total running distance",                  "💎", "Total Distance", 13),

        // More Run Count
        B(BadgeType.Runs3000,           "3,000 Runs",        "Completed 3,000 runs",                                            "💎", "Runs", 25),
        B(BadgeType.Runs4000,           "4,000 Runs",        "Completed 4,000 runs",                                            "🏆", "Runs", 26),
        B(BadgeType.Runs5000,           "5,000 Runs",        "Completed 5,000 runs — a true legend!",                           "👑", "Runs", 27),

        // Exploration additions
        B(BadgeType.Tiles2500,          "Pioneer",           "Visited 2,500 map tiles",                                         "🗺️", "Exploration", 3),
        B(BadgeType.Tiles10000,         "Grand Explorer",    "Visited 10,000 map tiles",                                        "🌍", "Exploration", 6),
    ];
}
