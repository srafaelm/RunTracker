namespace RunTracker.Domain.Enums;

public enum RecordType
{
    Fastest1K = 0,
    Fastest5K = 1,
    Fastest10K = 2,
    FastestHalf = 3,
    FastestMarathon = 4,
    LongestRun = 5,

    // Short distance
    Fastest100m = 6,
    Fastest400m = 7,
    Fastest800m = 8,

    // Middle distance
    Fastest3K = 9,

    // Long distance
    Fastest15K = 10,
    Fastest30K = 11,

    // All-time
    LongestRunTime = 12,

    // Gap-fillers in the distance ladder
    Fastest2K = 13,
    Fastest4K = 14,
    Fastest20K = 15,

    // Cross-sport
    LongestRide = 16,
    LongestSwim = 17,
    MostElevation = 18,
    BestRunCadence = 19,
    BestRideCadence = 20,
}
