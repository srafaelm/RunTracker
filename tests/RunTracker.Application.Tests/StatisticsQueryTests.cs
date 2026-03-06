using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Activities.Queries;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Statistics.Queries;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;
using Moq;

namespace RunTracker.Application.Tests;

public class StatisticsQueryTests
{
    private static IApplicationDbContext CreateMockDb(List<Activity> activities, List<PersonalRecord>? prs = null)
    {
        var mockDb = new Mock<IApplicationDbContext>();

        var activityDbSet = CreateMockDbSet(activities);
        mockDb.Setup(d => d.Activities).Returns(activityDbSet.Object);

        var prDbSet = CreateMockDbSet(prs ?? new List<PersonalRecord>());
        mockDb.Setup(d => d.PersonalRecords).Returns(prDbSet.Object);

        return mockDb.Object;
    }

    private static Mock<DbSet<T>> CreateMockDbSet<T>(List<T> data) where T : class
    {
        var queryable = data.AsQueryable();
        var mockSet = new Mock<DbSet<T>>();
        mockSet.As<IQueryable<T>>().Setup(m => m.Provider).Returns(new TestAsyncQueryProvider<T>(queryable.Provider));
        mockSet.As<IQueryable<T>>().Setup(m => m.Expression).Returns(queryable.Expression);
        mockSet.As<IQueryable<T>>().Setup(m => m.ElementType).Returns(queryable.ElementType);
        mockSet.As<IQueryable<T>>().Setup(m => m.GetEnumerator()).Returns(() => queryable.GetEnumerator());
        mockSet.As<IAsyncEnumerable<T>>().Setup(m => m.GetAsyncEnumerator(It.IsAny<CancellationToken>()))
            .Returns(new TestAsyncEnumerator<T>(data.GetEnumerator()));
        return mockSet;
    }

    [Fact]
    public async Task GetAllTimeStats_ReturnsCorrectTotals()
    {
        var activities = new List<Activity>
        {
            new() { UserId = "user1", SportType = SportType.Run, Distance = 5000, MovingTime = 1500, TotalElevationGain = 50, StartDate = DateTime.UtcNow },
            new() { UserId = "user1", SportType = SportType.Run, Distance = 10000, MovingTime = 3000, TotalElevationGain = 100, StartDate = DateTime.UtcNow.AddDays(-1) },
        };

        var db = CreateMockDb(activities);
        var handler = new GetAllTimeStatsQueryHandler(db);
        var result = await handler.Handle(new GetAllTimeStatsQuery("user1"), CancellationToken.None);

        Assert.Equal(15000, result.TotalDistance);
        Assert.Equal(2, result.TotalRuns);
        Assert.Equal(4500, result.TotalTimeSeconds);
        Assert.Equal(10000, result.LongestRunDistance);
    }

    [Fact]  
    public async Task GetYearlyStats_FiltersCorrectYear()
    {
        var activities = new List<Activity>
        {
            new() { UserId = "user1", SportType = SportType.Run, Distance = 5000, MovingTime = 1500, StartDate = new DateTime(2025, 6, 1) },
            new() { UserId = "user1", SportType = SportType.Run, Distance = 10000, MovingTime = 3000, StartDate = new DateTime(2024, 6, 1) },
        };

        var db = CreateMockDb(activities);
        var handler = new GetYearlyStatsQueryHandler(db);
        var result = await handler.Handle(new GetYearlyStatsQuery("user1", 2025), CancellationToken.None);

        Assert.Equal(5000, result.TotalDistance);
        Assert.Equal(1, result.TotalRuns);
    }
}

// Async query provider helpers for mocking EF Core
internal class TestAsyncQueryProvider<T> : IQueryProvider
{
    private readonly IQueryProvider _inner;
    public TestAsyncQueryProvider(IQueryProvider inner) => _inner = inner;
    public IQueryable CreateQuery(System.Linq.Expressions.Expression expression) => new TestAsyncEnumerable<T>(expression);
    public IQueryable<TElement> CreateQuery<TElement>(System.Linq.Expressions.Expression expression) => new TestAsyncEnumerable<TElement>(expression);
    public object? Execute(System.Linq.Expressions.Expression expression) => _inner.Execute(expression);
    public TResult Execute<TResult>(System.Linq.Expressions.Expression expression) => _inner.Execute<TResult>(expression);
}

internal class TestAsyncEnumerable<T> : EnumerableQuery<T>, IAsyncEnumerable<T>, IQueryable<T>
{
    public TestAsyncEnumerable(System.Linq.Expressions.Expression expression) : base(expression) { }
    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken ct = default) =>
        new TestAsyncEnumerator<T>(this.AsEnumerable().GetEnumerator());
    IQueryProvider IQueryable.Provider => new TestAsyncQueryProvider<T>(this);
}

internal class TestAsyncEnumerator<T> : IAsyncEnumerator<T>
{
    private readonly IEnumerator<T> _inner;
    public TestAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
    public ValueTask<bool> MoveNextAsync() => new(_inner.MoveNext());
    public T Current => _inner.Current;
    public ValueTask DisposeAsync() { _inner.Dispose(); return ValueTask.CompletedTask; }
}
