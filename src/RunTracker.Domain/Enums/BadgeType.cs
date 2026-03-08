namespace RunTracker.Domain.Enums;

public enum BadgeType
{
    // Distance milestones (single run)
    First5K = 1,
    First10K = 2,
    First21K = 3,
    First42K = 4,
    First1K = 5,
    First15K = 6,
    First50K = 7,
    First100K = 8,
    First100Mile = 9,

    // Total distance milestones (running)
    Total100km = 10,
    Total500km = 11,
    Total1000km = 12,
    Total5000km = 13,

    // Activity count (running)
    FirstRun = 20,
    Runs10 = 21,
    Runs50 = 22,
    Runs100 = 23,
    Runs365 = 24,
    Runs1000 = 25,

    // Elevation (single run)
    EverestRun = 30,
    KilimanjaroRun = 31,
    MontBlancRun = 32,
    K2Run = 33,

    // Cumulative elevation milestones
    EverestCumulative = 34,
    Cauberg = 35,
    Vaalserberg = 36,
    MontVentoux = 37,
    Zugspitze = 38,
    Etna = 39,

    // Tile exploration
    Tiles100 = 40,
    Tiles500 = 41,
    Tiles1000 = 42,
    Tiles5000 = 43,

    // Street exploration
    StreetExplorer = 50,

    // Cumulative Everest levels (each level = 8,848 m total)
    EverestLevel2 = 61,
    EverestLevel3 = 62,
    EverestLevel4 = 63,
    EverestLevel5 = 64,
    EverestLevel6 = 65,
    EverestLevel7 = 66,
    EverestLevel8 = 67,
    EverestLevel9 = 68,
    EverestLevel10 = 69,

    // Multi-sport: Cycling
    FirstRide = 70,
    Rides10 = 71,
    Rides50 = 72,
    CyclingTotal100km = 73,
    CyclingTotal500km = 74,
    CyclingTotal1000km = 75,

    // Multi-sport: Swimming
    FirstSwim = 76,
    Swims10 = 77,
    SwimTotal10km = 78,
    SwimTotal50km = 79,

    // Multi-sport: Walking / Hiking
    FirstWalk = 80,
    Walks10 = 81,
    WalkingTotal100km = 82,

    // Running: Speed (pace in a single run)
    Sub75K = 83,             // < 7:00/km for a 5 km+ run
    Sub65K = 84,             // < 6:00/km for a 5 km+ run
    Sub55K = 85,             // < 5:00/km for a 5 km+ run
    Sub4305K = 86,           // < 4:30/km for a 5 km+ run
    Sub45K = 87,             // < 4:00/km for a 5 km+ run
    Sub610K = 88,            // < 6:00/km for a 10 km+ run
    Sub510K = 89,            // < 5:00/km for a 10 km+ run
    Sub43010K = 90,          // < 4:30/km for a 10 km+ run
    Sub6Half = 91,           // < 6:00/km for a half marathon run
    Sub530Half = 92,         // < 5:30/km for a half marathon run
    Sub5Half = 93,           // < 5:00/km for a half marathon run
    Sub5Marathon = 94,       // < 5:00/km for a full marathon (sub 3:30)

    // Running: Streak / Consistency
    Streak3 = 95,
    Streak7 = 96,
    Streak14 = 97,
    Streak30 = 98,
    Streak60 = 99,
    Streak100 = 100,

    // Running: Cadence / Technique
    RhythmRunner = 101,      // avg cadence >= 170 spm on a 5 km+ run
    MetronomeRunner = 102,   // avg cadence >= 180 spm on a 5 km+ run
    StrideMaster = 103,      // avg cadence >= 185 spm on a 5 km+ run

    // Running: Calorie Burn
    CalorieBurner500 = 104,  // 500+ cal in a single run
    Inferno = 105,           // 1,000+ cal in a single run
    TotalCal10K = 106,       // 10,000 total calories from running
    TotalCal50K = 107,       // 50,000 total calories from running
    TotalCal100K = 108,      // 100,000 total calories from running

    // Running: Monthly Volume
    Month50km = 109,         // >= 50 km in a single calendar month
    Month100km = 110,        // >= 100 km in a single calendar month
    Month200km = 111,        // >= 200 km in a single calendar month
    Month300km = 112,        // >= 300 km in a single calendar month

    // Running: More Distance Milestones (single run)
    First20K = 113,
    First25K = 114,
    First30K = 115,
    First35K = 116,
    First75K = 117,
    FirstDoubleMarathon = 118,  // 84.39 km+

    // Running: More Total Distance Milestones
    Total250km = 119,
    Total750km = 120,
    Total2000km = 121,
    Total3000km = 122,
    Total10000km = 123,
    Total15000km = 124,

    // Running: More Activity Count Milestones
    Runs25 = 125,
    Runs75 = 126,
    Runs150 = 127,
    Runs200 = 128,
    Runs500 = 129,

    // Running: Habits
    WeekendWarrior = 130,    // 20+ distinct Sat/Sun run dates
    FiveDayWeek = 131,       // 5+ distinct days run in any single calendar week
    SixDayWeek = 132,        // 6+ distinct days run in any single calendar week
    DailyDouble = 133,       // 2+ runs recorded on the same day
    LongRunner10 = 134,      // 10+ runs of >= 21 km

    // Running: More Elevation Milestones (single run)
    HillStarter = 135,       // >= 200 m elevation gain in a single run
    HillClimber = 136,       // >= 500 m elevation gain in a single run
    MountainRunner = 137,    // >= 1,000 m elevation gain in a single run
    AlpineMaster = 138,      // >= 2,000 m elevation gain in a single run
    HighPeaks = 139,         // >= 3,000 m elevation gain in a single run

    // Running: Even More Activity Count
    Runs300 = 140,
    Runs750 = 141,
    Runs1500 = 142,
    Runs2000 = 143,
    Runs2500 = 144,

    // Running: Short-distance & elite pace badges
    Sub3Per400m = 200,       // < 3:00/km on a 400m+ run
    Sub330Per1K = 201,       // < 3:30/km on a 1km+ run
    Sub3Per1K = 202,         // < 3:00/km on a 1km+ run
    Sub4Per1K = 203,         // < 4:00/km on a 1km+ run
    Sub4Per10K = 204,        // < 4:00/km on a 10km+ run
    Sub430Per21K = 205,      // < 4:30/km for a half marathon
    Sub4Per21K = 206,        // < 4:00/km for a half marathon
    Sub430Marathon = 207,    // < 4:30/km for a full marathon (sub 3:10)
    Sub4Marathon = 208,      // < 4:00/km for a full marathon (sub 2:49)

    // Elevation: Beginner single-run milestones
    ElevationSprint50 = 210,   // >= 50m elevation gain in a single run
    ElevationSprint100 = 211,  // >= 100m elevation gain in a single run

    // Cumulative Elevation: Additional milestones
    CumElev500 = 220,          // >= 500m cumulative elevation
    CumElev1000 = 221,         // >= 1,000m cumulative elevation
    CumElev5000 = 222,         // >= 5,000m cumulative elevation
    CumElevMatterhorn = 223,   // >= 4,478m cumulative (Matterhorn)
    CumElevKilimanjaro = 224,  // >= 5,895m cumulative (Kilimanjaro)
    CumElevK2 = 225,           // >= 8,611m cumulative (K2)
    CumElev25000 = 226,        // >= 25,000m cumulative
    CumElev50000 = 227,        // >= 50,000m cumulative
    CumElev100000 = 228,       // >= 100,000m cumulative

    // Swimming: Single-swim distance milestones
    FirstSwim500m = 300,       // first 500m swim
    FirstSwim1K = 301,         // first 1km swim
    FirstSwim2K = 302,         // first 2km swim
    FirstSwim5K = 303,         // first 5km swim
    Swims25 = 304,             // 25 swims
    Swims50 = 305,             // 50 swims
    Swims100 = 306,            // 100 swims
    SwimTotal25km = 307,       // 25km cumulative swim
    SwimTotal100km = 308,      // 100km cumulative swim
    SwimTotal200km = 309,      // 200km cumulative swim

    // Cycling: Single-ride distance milestones
    FirstRide20K = 310,        // first 20km ride
    FirstRide50K = 311,        // first 50km ride (half century)
    FirstRide100K = 312,       // first 100km ride (century)
    FirstRide200K = 313,       // first 200km ride
    Rides25 = 314,             // 25 rides
    Rides100 = 315,            // 100 rides
    Rides200 = 316,            // 200 rides
    Rides500 = 317,            // 500 rides
    CyclingTotal2000km = 318,  // 2,000km cumulative
    CyclingTotal5000km = 319,  // 5,000km cumulative
    CyclingTotal10000km = 320, // 10,000km cumulative
    CyclingElevation500 = 321, // 500m elevation gain in a single ride
    CyclingElevation1000 = 322,// 1,000m elevation gain in a single ride
    CyclingElevation2000 = 323,// 2,000m elevation gain in a single ride
    CyclingCumElev5000 = 324,  // 5,000m cumulative cycling elevation
    CyclingCumElev10000 = 325, // 10,000m cumulative cycling elevation
    CyclingCumElev50000 = 326, // 50,000m cumulative cycling elevation
    CyclingSpeed30 = 327,      // avg speed >= 30 km/h on a 20km+ ride
    CyclingSpeed35 = 328,      // avg speed >= 35 km/h on a 20km+ ride
    CyclingSpeed40 = 329,      // avg speed >= 40 km/h on a 20km+ ride
    CyclingMonth500km = 330,   // 500km in a single calendar month
    CyclingMonth1000km = 331,  // 1,000km in a single calendar month

    // Walking & Hiking: Activity count
    Walks25 = 332,             // 25 walks/hikes
    Walks50 = 333,             // 50 walks/hikes
    Walks100 = 334,            // 100 walks/hikes
    WalkingTotal250km = 335,   // 250km cumulative walk/hike distance
    WalkingTotal500km = 336,   // 500km cumulative walk/hike distance
    WalkingTotal1000km = 337,  // 1,000km cumulative walk/hike distance
    FirstHike10K = 338,        // first 10km walk or hike
    FirstHike20K = 339,        // first 20km walk or hike
    HikingElevation500 = 340,  // 500m elevation gain in a single walk/hike
    HikingElevation1000 = 341, // 1,000m elevation gain in a single walk/hike

    // Running: Monthly volume additions
    Month150km = 342,          // >= 150km in a single calendar month
    Month400km = 343,          // >= 400km in a single calendar month
    Month500km = 344,          // >= 500km in a single calendar month

    // Running: Yearly distance
    Year500km = 345,           // 500km in a single calendar year
    Year1000km = 346,          // 1,000km in a single calendar year
    Year2000km = 347,          // 2,000km in a single calendar year
    Year3000km = 348,          // 3,000km in a single calendar year

    // Running: Marathon & half-marathon count
    MarathonFinisher3 = 349,   // 3 full marathon runs (42.2km+)
    MarathonFinisher5 = 350,   // 5 full marathons
    MarathonFinisher10 = 351,  // 10 full marathons
    MarathonFinisher20 = 352,  // 20 full marathons
    HalfMarathonCount5 = 353,  // 5 half-marathon runs (21km+)
    HalfMarathonCount10 = 354, // 10 half marathons
    HalfMarathonCount25 = 355, // 25 half marathons

    // Running: Time-based single run
    Run1Hour = 356,            // first run of 60+ minutes moving time
    Run2Hours = 357,           // first run of 2+ hours
    Run3Hours = 358,           // first run of 3+ hours
    Run6Hours = 359,           // first run of 6+ hours

    // Running: Habits additions
    WeekendWarrior50 = 360,    // 50 distinct Saturday/Sunday run dates
    WeekendWarrior100 = 361,   // 100 distinct Saturday/Sunday run dates
    LongRunner25 = 362,        // 25 runs of 21km or more
    LongRunner50 = 363,        // 50 runs of 21km or more

    // Running: Calorie additions
    TotalCal200K = 364,        // 200,000 total calories from running
    TotalCal500K = 365,        // 500,000 total calories from running

    // Running: Extended streaks
    Streak200 = 366,           // 200 consecutive days running
    Streak365 = 367,           // 365 consecutive days running

    // Running: Cadence additions
    StrideLegend = 368,        // avg cadence >= 190 spm on a 5km+ run

    // Running: Beginner pace
    Sub85K = 369,              // < 8:00/km for a 5km+ run

    // Running: Total moving time
    TotalHours100 = 370,       // 100 hours total running moving time
    TotalHours250 = 371,       // 250 hours total running moving time
    TotalHours500 = 372,       // 500 hours total running moving time
    TotalHours1000 = 373,      // 1,000 hours total running moving time

    // Running: More total distance
    Total4000km = 374,
    Total6000km = 375,
    Total7500km = 376,

    // Running: More activity count
    Runs3000 = 377,
    Runs4000 = 378,
    Runs5000 = 379,

    // Running: Morning / Evening habits
    EarlyBird = 380,           // first run starting before 7:00 local time
    NightOwl = 381,            // first run starting at or after 21:00 local time
    EarlyBird10 = 382,         // 10 runs starting before 8:00
    NightOwl10 = 383,          // 10 runs starting at or after 20:00

    // Exploration additions
    Tiles2500 = 384,
    Tiles10000 = 385,

    // Running: Short-distance pace additions
    Sub5Per1K = 386,           // < 5:00/km on a 1km+ run
    Sub45Per1K = 387,          // < 4:30/km on a 1km+ run

    // Running: Long run count additions
    MarathonFinisher50 = 388,  // 50 full marathons
    LongRunner100 = 389,       // 100 runs of 21km or more
}
