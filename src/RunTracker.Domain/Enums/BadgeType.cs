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
}
