using RunTracker.Domain.Entities;

namespace RunTracker.Application.Common.Interfaces;

public interface IOsmService
{
    /// <summary>
    /// Import streets and nodes for a city from OpenStreetMap via the Overpass API.
    /// </summary>
    Task<City> ImportCityAsync(long osmRelationId, string name, string? region, string country, CancellationToken ct = default);
}
