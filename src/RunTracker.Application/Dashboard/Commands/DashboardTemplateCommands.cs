using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Dashboard.DTOs;
using RunTracker.Domain.Entities;

namespace RunTracker.Application.Dashboard.Commands;

// Create
public record CreateDashboardTemplateCommand(string UserId, string Name, string[] Widgets)
    : IRequest<DashboardTemplateDto>;

public class CreateDashboardTemplateCommandHandler : IRequestHandler<CreateDashboardTemplateCommand, DashboardTemplateDto>
{
    private readonly IApplicationDbContext _db;
    public CreateDashboardTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<DashboardTemplateDto> Handle(CreateDashboardTemplateCommand request, CancellationToken ct)
    {
        var existingCount = await _db.DashboardTemplates.CountAsync(t => t.UserId == request.UserId, ct);
        var entity = new DashboardTemplate
        {
            UserId = request.UserId,
            Name = request.Name,
            Widgets = JsonSerializer.Serialize(request.Widgets),
            IsDefault = existingCount == 0, // first template is default
            SortOrder = existingCount,
        };
        _db.DashboardTemplates.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new DashboardTemplateDto(entity.Id, entity.Name, request.Widgets, entity.IsDefault, entity.SortOrder);
    }
}

// Update
public record UpdateDashboardTemplateCommand(string UserId, Guid TemplateId, string Name, string[] Widgets)
    : IRequest<DashboardTemplateDto?>;

public class UpdateDashboardTemplateCommandHandler : IRequestHandler<UpdateDashboardTemplateCommand, DashboardTemplateDto?>
{
    private readonly IApplicationDbContext _db;
    public UpdateDashboardTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<DashboardTemplateDto?> Handle(UpdateDashboardTemplateCommand request, CancellationToken ct)
    {
        var entity = await _db.DashboardTemplates
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.UserId == request.UserId, ct);
        if (entity is null) return null;

        entity.Name = request.Name;
        entity.Widgets = JsonSerializer.Serialize(request.Widgets);
        await _db.SaveChangesAsync(ct);
        return new DashboardTemplateDto(entity.Id, entity.Name, request.Widgets, entity.IsDefault, entity.SortOrder);
    }
}

// Delete
public record DeleteDashboardTemplateCommand(string UserId, Guid TemplateId) : IRequest<(bool Success, string? Error)>;

public class DeleteDashboardTemplateCommandHandler : IRequestHandler<DeleteDashboardTemplateCommand, (bool Success, string? Error)>
{
    private readonly IApplicationDbContext _db;
    public DeleteDashboardTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<(bool Success, string? Error)> Handle(DeleteDashboardTemplateCommand request, CancellationToken ct)
    {
        var entity = await _db.DashboardTemplates
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.UserId == request.UserId, ct);
        if (entity is null) return (false, null);
        if (entity.IsDefault) return (false, "Cannot delete the active template.");

        _db.DashboardTemplates.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return (true, null);
    }
}

// Set Active (IsDefault)
public record SetActiveDashboardTemplateCommand(string UserId, Guid TemplateId) : IRequest<bool>;

public class SetActiveDashboardTemplateCommandHandler : IRequestHandler<SetActiveDashboardTemplateCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public SetActiveDashboardTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(SetActiveDashboardTemplateCommand request, CancellationToken ct)
    {
        var templates = await _db.DashboardTemplates
            .Where(t => t.UserId == request.UserId)
            .ToListAsync(ct);

        var target = templates.FirstOrDefault(t => t.Id == request.TemplateId);
        if (target is null) return false;

        foreach (var t in templates) t.IsDefault = (t.Id == request.TemplateId);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
