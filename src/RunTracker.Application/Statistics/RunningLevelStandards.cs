namespace RunTracker.Application.Statistics;

/// <summary>
/// Hardcoded running level standards (seconds) by gender, distance, age group, and ability level.
/// Male 5K data sourced from runninglevel.com.
/// Other distances scaled proportionally using Riegel's formula.
/// </summary>
public static class RunningLevelStandards
{
    // Level index: 0=Beginner, 1=Novice, 2=Intermediate, 3=Advanced, 4=Elite, 5=WR
    public static readonly string[] LevelNames = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite", "WR"];

    // Age groups: 10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90
    public static readonly int[] AgeGroups = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];

    // Supported distances in metres
    public static readonly int[] Distances = [5000, 10000, 21097, 42195];
    public static readonly string[] DistanceLabels = ["5K", "10K", "Half Marathon", "Marathon"];

    // Male 5K times in seconds [ageGroupIndex][levelIndex]
    private static readonly int[,] Male5KSeconds =
    {
        // Age 10: Beginner, Novice, Intermediate, Advanced, Elite, WR
        { 2259, 1889, 1616, 1415, 1267, 922 },
        // Age 15
        { 1955, 1634, 1399, 1225, 1097, 798 },
        // Age 20
        { 1889, 1579, 1351, 1184, 1060, 771 },
        // Age 25
        { 1889, 1579, 1351, 1184, 1060, 771 },
        // Age 30
        { 1889, 1579, 1352, 1184, 1060, 771 },
        // Age 35
        { 1919, 1605, 1373, 1203, 1077, 783 },
        // Age 40
        { 1989, 1663, 1423, 1246, 1116, 812 },
        // Age 45
        { 2065, 1727, 1478, 1294, 1159, 843 },
        // Age 50
        { 2147, 1795, 1536, 1346, 1205, 877 },
        // Age 55
        { 2236, 1870, 1600, 1401, 1255, 913 },
        // Age 60
        { 2333, 1951, 1669, 1462, 1309, 952 },
        // Age 65
        { 2438, 2039, 1745, 1528, 1368, 995 },
        // Age 70
        { 2563, 2143, 1834, 1606, 1438, 1046 },
        // Age 75
        { 2755, 2303, 1971, 1726, 1546, 1125 },
        // Age 80
        { 3049, 2550, 2182, 1911, 1711, 1245 },
        // Age 85
        { 3508, 2933, 2510, 2198, 1968, 1432 },
        // Age 90
        { 4268, 3569, 3054, 2675, 2395, 1742 },
    };

    // Female times are approximately 10-15% slower on average
    private static readonly double FemaleRatio = 1.12;

    public static int GetStandardSeconds(bool isMale, int distanceM, int ageGroup, int levelIndex)
    {
        var ageBracket = GetAgeBracket(ageGroup);
        var base5KSec = Male5KSeconds[ageBracket, levelIndex];

        // Scale to target distance using Riegel's formula from 5K
        var scaled = base5KSec * Math.Pow((double)distanceM / 5000.0, 1.06);

        return (int)(isMale ? scaled : scaled * FemaleRatio);
    }

    private static int GetAgeBracket(int age)
    {
        // Map age to nearest age group index
        if (age <= 10) return 0;
        if (age <= 12) return 0;
        if (age <= 17) return 1;
        if (age <= 22) return 2;
        if (age <= 27) return 3;
        if (age <= 32) return 4;
        if (age <= 37) return 5;
        if (age <= 42) return 6;
        if (age <= 47) return 7;
        if (age <= 52) return 8;
        if (age <= 57) return 9;
        if (age <= 62) return 10;
        if (age <= 67) return 11;
        if (age <= 72) return 12;
        if (age <= 77) return 13;
        if (age <= 82) return 14;
        if (age <= 87) return 15;
        return 16;
    }

    /// <summary>
    /// Returns (0-100) percentile estimate for a given time at a distance.
    /// Lower time = better = higher percentile.
    /// </summary>
    public static double ComputePercentile(bool isMale, int distanceM, int age, double timeSec)
    {
        // Boundaries: WR = top 0.1%, Elite = top 5%, Advanced = 25%, Intermediate = 50%, Novice = 75%, Beginner = 90%
        double[] percentileBreaks = [99.9, 95, 75, 50, 25, 10];

        for (int i = 0; i < LevelNames.Length; i++)
        {
            var threshold = GetStandardSeconds(isMale, distanceM, age, i);
            if (timeSec <= threshold)
                return percentileBreaks[i];
        }
        return 5; // below beginner
    }
}
