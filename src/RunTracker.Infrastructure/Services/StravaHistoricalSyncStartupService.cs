using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Services;

/// <summary>
/// On application startup, resumes historical Strava syncs for any users
/// whose full sync was interrupted (rate limit, restart, etc.).
/// </summary>
public class StravaHistoricalSyncStartupService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly StravaSyncBackgroundService _syncService;
    private readonly ILogger<StravaHistoricalSyncStartupService> _logger;

    public StravaHistoricalSyncStartupService(
        IServiceScopeFactory scopeFactory,
        StravaSyncBackgroundService syncService,
        ILogger<StravaHistoricalSyncStartupService> logger)
    {
        _scopeFactory = scopeFactory;
        _syncService = syncService;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();

        var pendingUsers = await userManager.Users
            .Where(u => u.StravaAthleteId != null && !u.StravaHistoricalSyncComplete)
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        if (pendingUsers.Count == 0) return;

        _logger.LogInformation("Resuming historical Strava sync for {Count} user(s)", pendingUsers.Count);

        foreach (var userId in pendingUsers)
            _ = Task.Run(() => _syncService.SyncHistoricalActivitiesAsync(userId, CancellationToken.None));
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
