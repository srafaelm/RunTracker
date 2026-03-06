using System.Text;
using MediatR;
using System.Threading.Channels;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Infrastructure.Identity;
using RunTracker.Infrastructure.Persistence;
using RunTracker.Infrastructure.Services;

namespace RunTracker.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Database
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                b =>
                {
                    b.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    b.UseNetTopologySuite();
                }));

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        // Identity
        services.AddIdentityCore<User>(options =>
        {
            options.Password.RequireDigit = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequiredLength = 4;
            options.User.RequireUniqueEmail = true;
        })
        .AddEntityFrameworkStores<AppDbContext>()
        .AddDefaultTokenProviders();

        // JWT Authentication
        var jwtSecret = configuration["Jwt:Secret"] ?? "RunTracker-Development-Secret-Key-Min-32-Chars!!";
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ValidateIssuer = true,
                ValidIssuer = configuration["Jwt:Issuer"] ?? "RunTracker",
                ValidateAudience = true,
                ValidAudience = configuration["Jwt:Audience"] ?? "RunTracker",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };
        });

        // Services
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddHttpClient<IStravaService, StravaService>();
        services.AddScoped<PersonalRecordService>();
        services.AddScoped<Vo2maxSnapshotService>();
        services.AddScoped<GpxImportService>();
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
        services.AddHttpClient<IWeatherService, OpenMeteoWeatherService>();
        services.AddHttpClient<IOsmService, OsmService>();
        services.AddHttpClient<IRouteGenerationService, RouteGenerationService>();
        services.AddScoped<IStreetMatchingService, StreetMatchingService>();
        services.AddScoped<ITileService, TileService>();
        services.AddScoped<IBadgeService, BadgeService>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();
        services.AddSingleton<DatabaseSetupService>();

        // Background sync
        var channel = StravaSyncBackgroundService.CreateChannel();
        services.AddSingleton(channel);
        services.AddSingleton<StravaSyncBackgroundService>();
        services.AddHostedService(sp => sp.GetRequiredService<StravaSyncBackgroundService>());
        services.AddHostedService<StravaHistoricalSyncStartupService>();

        return services;
    }
}
