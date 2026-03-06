using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using RunTracker.Infrastructure.Services;

namespace RunTracker.Web.Endpoints;

public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/webhooks");

        // Strava webhook validation (GET)
        group.MapGet("/strava", ([FromQuery(Name = "hub.mode")] string? mode,
            [FromQuery(Name = "hub.challenge")] string? challenge,
            [FromQuery(Name = "hub.verify_token")] string? verifyToken,
            IConfiguration config) =>
        {
            var expectedToken = config["Strava:WebhookVerifyToken"] ?? "runtracker-verify";
            if (mode == "subscribe" && verifyToken == expectedToken)
            {
                return Results.Ok(new { hub_challenge = challenge });
            }
            return Results.StatusCode(403);
        });

        // Strava webhook events (POST)
        group.MapPost("/strava", async (
            HttpContext context,
            Channel<StravaWebhookEvent> channel) =>
        {
            using var reader = new StreamReader(context.Request.Body);
            var body = await reader.ReadToEndAsync();
            var json = JsonDocument.Parse(body);

            var objectType = json.RootElement.GetProperty("object_type").GetString();
            var objectId = json.RootElement.GetProperty("object_id").GetInt64();
            var aspectType = json.RootElement.GetProperty("aspect_type").GetString();
            var ownerId = json.RootElement.GetProperty("owner_id").GetInt64();

            await channel.Writer.WriteAsync(new StravaWebhookEvent(objectType!, objectId, aspectType!, ownerId));

            return Results.Ok();
        });
    }
}
