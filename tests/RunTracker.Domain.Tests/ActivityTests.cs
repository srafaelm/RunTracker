using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Domain.Tests;

public class ActivityTests
{
    [Fact]
    public void Activity_HasCorrectDefaults()
    {
        var activity = new Activity();

        Assert.NotEqual(Guid.Empty, activity.Id);
        Assert.Equal(string.Empty, activity.Name);
        Assert.Equal(0, activity.Distance);
        Assert.Equal(0, activity.MovingTime);
        Assert.Empty(activity.Streams);
    }

    [Theory]
    [InlineData(10000, 3000, 5.0)]   // 10km in 50 min = 5:00/km
    [InlineData(5000, 1500, 5.0)]    // 5km in 25 min = 5:00/km
    [InlineData(21097.5, 5400, 4.27)] // half marathon in 90 min ≈ 4:16/km
    public void Activity_PaceCalculation_IsCorrect(double distance, int movingTime, double expectedPaceApprox)
    {
        var activity = new Activity
        {
            Distance = distance,
            MovingTime = movingTime
        };

        var pace = (activity.MovingTime / 60.0) / (activity.Distance / 1000.0);
        Assert.InRange(pace, expectedPaceApprox - 0.15, expectedPaceApprox + 0.15);
    }

    [Fact]
    public void Activity_SportType_Enum_HasExpectedValues()
    {
        Assert.Equal(0, (int)SportType.Run);
        Assert.Equal(1, (int)SportType.TrailRun);
        Assert.Equal(7, (int)SportType.Other);
    }
}

public class PersonalRecordTests
{
    [Fact]
    public void PersonalRecord_HasCorrectDefaults()
    {
        var pr = new PersonalRecord();

        Assert.NotEqual(Guid.Empty, pr.Id);
        Assert.Equal(0, pr.Value);
    }

    [Fact]
    public void RecordType_Enum_HasAllExpectedValues()
    {
        var values = Enum.GetValues<RecordType>();
        Assert.Equal(6, values.Length);
        Assert.Contains(RecordType.Fastest1K, values);
        Assert.Contains(RecordType.LongestRun, values);
    }
}
