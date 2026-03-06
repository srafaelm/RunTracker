using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Dashboard.DTOs;

namespace RunTracker.Application.Dashboard.Queries;

public record GetDashboardTemplatesQuery(string UserId) : IRequest<List<DashboardTemplateDto>>;

public class GetDashboardTemplatesQueryHandler : IRequestHandler<GetDashboardTemplatesQuery, List<DashboardTemplateDto>>
{
    private readonly IApplicationDbContext _db;
    public GetDashboardTemplatesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<DashboardTemplateDto>> Handle(GetDashboardTemplatesQuery request, CancellationToken ct)
    {
        var templates = await _db.DashboardTemplates
            .Where(t => t.UserId == request.UserId)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync(ct);

        return templates.Select(t =>
        {
            string[] widgets;
            try { widgets = JsonSerializer.Deserialize<string[]>(t.Widgets) ?? []; }
            catch { widgets = []; }
            return new DashboardTemplateDto(t.Id, t.Name, widgets, t.IsDefault, t.SortOrder);
        }).ToList();
    }
}
