using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Services;

public class OsmService : IOsmService
{
    private readonly HttpClient _httpClient;
    private readonly IApplicationDbContext _db;
    private readonly ILogger<OsmService> _logger;
    private static readonly GeometryFactory _geometryFactory = new(new PrecisionModel(), 4326);

    private const string OverpassUrl = "https://overpass-api.de/api/interpreter";
    private const string OverpassFallbackUrl = "https://overpass.kumi.systems/api/interpreter";
    private static readonly string[] HighwayTypes =
    [
        "residential", "tertiary", "secondary", "primary",
        "footway", "path", "living_street", "pedestrian", "unclassified"
    ];

    public OsmService(HttpClient httpClient, IApplicationDbContext db, ILogger<OsmService> logger)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromMinutes(5);
        _db = db;
        _logger = logger;
    }

    public async Task<City> ImportCityAsync(long osmRelationId, string name, string? region, string country, CancellationToken ct = default)
    {
        // Check if city already exists
        var existingCity = await _db.Cities.FirstOrDefaultAsync(c => c.OsmRelationId == osmRelationId, ct);
        if (existingCity is not null)
        {
            _logger.LogInformation("City with OSM relation {RelationId} already exists, re-importing streets", osmRelationId);
            // Remove old streets/nodes to re-import
            var oldStreets = await _db.Streets.Where(s => s.CityId == existingCity.Id).ToListAsync(ct);
            _db.Streets.RemoveRange(oldStreets);
            await _db.SaveChangesAsync(ct);
        }

        var city = existingCity ?? new City();
        city.Name = name;
        city.Region = region;
        city.Country = country;
        city.OsmRelationId = osmRelationId;

        // Query Overpass for streets
        var areaId = osmRelationId + 3600000000;
        var highwayFilter = string.Join("|", HighwayTypes);
        var query = $"""
            [out:json][timeout:300];
            area(id:{areaId})->.a;
            way["highway"~"{highwayFilter}"](area.a);
            out body geom;
            """;

        _logger.LogInformation("Querying Overpass API for city {Name} (relation {RelationId})", name, osmRelationId);

        var content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });

        // Try primary Overpass, fall back to alternative if it fails
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsync(OverpassUrl, content, ct);
            response.EnsureSuccessStatusCode();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Primary Overpass API failed, trying fallback");
            content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });
            response = await _httpClient.PostAsync(OverpassFallbackUrl, content, ct);
            response.EnsureSuccessStatusCode();
        }

        var overpassResult = await response.Content.ReadFromJsonAsync<OverpassResponse>(cancellationToken: ct);
        if (overpassResult?.Elements is null || overpassResult.Elements.Length == 0)
        {
            _logger.LogWarning("Overpass returned no elements for city {Name}", name);
            throw new InvalidOperationException($"No streets found for OSM relation {osmRelationId}");
        }

        _logger.LogInformation("Overpass returned {Count} elements for city {Name}", overpassResult.Elements.Length, name);

        int totalStreets = 0;
        int totalNodes = 0;

        if (existingCity is null)
            _db.Cities.Add(city);

        await _db.SaveChangesAsync(ct);

        // Process in batches to avoid memory issues
        const int batchSize = 500;
        var wayElements = overpassResult.Elements.Where(e => e.Type == "way" && e.Geometry?.Length >= 2).ToList();

        for (int batchStart = 0; batchStart < wayElements.Count; batchStart += batchSize)
        {
            var batch = wayElements.Skip(batchStart).Take(batchSize);

            foreach (var element in batch)
            {
                var street = new Street
                {
                    CityId = city.Id,
                    OsmWayId = element.Id,
                    Name = element.Tags?.GetValueOrDefault("name") ?? "Unnamed",
                    HighwayType = element.Tags?.GetValueOrDefault("highway") ?? "unknown",
                };

                // Build LineString geometry from geometry points
                var coordinates = element.Geometry!
                    .Select(g => new Coordinate(g.Lon, g.Lat))
                    .ToArray();

                if (coordinates.Length >= 2)
                {
                    street.Geometry = _geometryFactory.CreateLineString(coordinates);
                    street.TotalLengthMeters = CalculateLengthMeters(coordinates);
                }

                // Create nodes from geometry points
                var seenNodeIds = new HashSet<long>();
                int nodeIndex = 0;

                if (element.Nodes is not null)
                {
                    for (int i = 0; i < element.Nodes.Length && i < element.Geometry!.Length; i++)
                    {
                        var nodeId = element.Nodes[i];
                        if (!seenNodeIds.Add(nodeId)) continue;

                        var geomPoint = element.Geometry[i];
                        var node = new StreetNode
                        {
                            StreetId = street.Id,
                            OsmNodeId = nodeId,
                            Location = _geometryFactory.CreatePoint(new Coordinate(geomPoint.Lon, geomPoint.Lat)),
                            SequenceIndex = nodeIndex++,
                        };
                        street.Nodes.Add(node);
                    }
                }
                else
                {
                    // Fallback: use geometry points as pseudo-nodes
                    foreach (var geomPoint in element.Geometry!)
                    {
                        var node = new StreetNode
                        {
                            StreetId = street.Id,
                            OsmNodeId = 0, // No real OSM node ID available
                            Location = _geometryFactory.CreatePoint(new Coordinate(geomPoint.Lon, geomPoint.Lat)),
                            SequenceIndex = nodeIndex++,
                        };
                        street.Nodes.Add(node);
                    }
                }

                street.NodeCount = street.Nodes.Count;
                totalNodes += street.NodeCount;
                totalStreets++;

                _db.Streets.Add(street);
            }

            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Imported batch {Batch}/{Total} streets for city {Name}",
                Math.Min(batchStart + batchSize, wayElements.Count), wayElements.Count, name);
        }

        city.TotalStreets = totalStreets;
        city.TotalNodes = totalNodes;
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("City import complete: {Name} — {Streets} streets, {Nodes} nodes", name, totalStreets, totalNodes);
        return city;
    }

    private static double CalculateLengthMeters(Coordinate[] coords)
    {
        double total = 0;
        for (int i = 1; i < coords.Length; i++)
        {
            total += HaversineDistance(coords[i - 1].Y, coords[i - 1].X, coords[i].Y, coords[i].X);
        }
        return total;
    }

    private static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000; // Earth radius in meters
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRadians(double deg) => deg * Math.PI / 180;

    // Overpass API response models
    private class OverpassResponse
    {
        [JsonPropertyName("elements")]
        public OverpassElement[]? Elements { get; set; }
    }

    private class OverpassElement
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "";

        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("tags")]
        public Dictionary<string, string>? Tags { get; set; }

        [JsonPropertyName("nodes")]
        public long[]? Nodes { get; set; }

        [JsonPropertyName("geometry")]
        public OverpassGeomPoint[]? Geometry { get; set; }
    }

    private class OverpassGeomPoint
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }

        [JsonPropertyName("lon")]
        public double Lon { get; set; }
    }
}
