using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Application.Training.DTOs;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Training.UserTemplates;

// ─── DTOs ────────────────────────────────────────────────────────────────────

public record UserTemplateWorkoutDto(
    Guid Id,
    int DaysFromRace,
    string Title,
    WorkoutType WorkoutType,
    double? DistanceMeters,
    string? Notes
);

public record UserTrainingTemplateDto(
    Guid Id,
    string Name,
    string? Description,
    DateTime CreatedAt,
    List<UserTemplateWorkoutDto> Workouts
);

public record UserTemplateWorkoutRequest(
    int DaysFromRace,
    string Title,
    WorkoutType WorkoutType,
    double? DistanceMeters = null,
    string? Notes = null
);

// ─── Create ───────────────────────────────────────────────────────────────────

public record CreateUserTemplateCommand(
    string UserId,
    string Name,
    string? Description,
    List<UserTemplateWorkoutRequest> Workouts
) : IRequest<UserTrainingTemplateDto>;

public class CreateUserTemplateCommandHandler : IRequestHandler<CreateUserTemplateCommand, UserTrainingTemplateDto>
{
    private readonly IApplicationDbContext _db;
    public CreateUserTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<UserTrainingTemplateDto> Handle(CreateUserTemplateCommand request, CancellationToken ct)
    {
        var template = new UserTrainingTemplate
        {
            UserId = request.UserId,
            Name = request.Name,
            Description = request.Description,
            CreatedAt = DateTime.UtcNow,
        };

        template.Workouts = request.Workouts.Select(w => new UserTemplateWorkout
        {
            TemplateId = template.Id,
            DaysFromRace = w.DaysFromRace,
            Title = w.Title,
            WorkoutType = w.WorkoutType,
            DistanceMeters = w.DistanceMeters,
            Notes = w.Notes,
        }).ToList();

        _db.UserTrainingTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return ToDto(template);
    }

    internal static UserTrainingTemplateDto ToDto(UserTrainingTemplate t) => new(
        t.Id, t.Name, t.Description, t.CreatedAt,
        t.Workouts.Select(w => new UserTemplateWorkoutDto(w.Id, w.DaysFromRace, w.Title, w.WorkoutType, w.DistanceMeters, w.Notes)).ToList()
    );
}

// ─── Get All ──────────────────────────────────────────────────────────────────

public record GetUserTemplatesQuery(string UserId) : IRequest<List<UserTrainingTemplateDto>>;

public class GetUserTemplatesQueryHandler : IRequestHandler<GetUserTemplatesQuery, List<UserTrainingTemplateDto>>
{
    private readonly IApplicationDbContext _db;
    public GetUserTemplatesQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<List<UserTrainingTemplateDto>> Handle(GetUserTemplatesQuery request, CancellationToken ct)
    {
        return await _db.UserTrainingTemplates
            .Where(t => t.UserId == request.UserId)
            .Include(t => t.Workouts)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => CreateUserTemplateCommandHandler.ToDto(t))
            .ToListAsync(ct);
    }
}

// ─── Update ───────────────────────────────────────────────────────────────────

public record UpdateUserTemplateCommand(
    string UserId,
    Guid TemplateId,
    string Name,
    string? Description,
    List<UserTemplateWorkoutRequest> Workouts
) : IRequest<UserTrainingTemplateDto?>;

public class UpdateUserTemplateCommandHandler : IRequestHandler<UpdateUserTemplateCommand, UserTrainingTemplateDto?>
{
    private readonly IApplicationDbContext _db;
    public UpdateUserTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<UserTrainingTemplateDto?> Handle(UpdateUserTemplateCommand request, CancellationToken ct)
    {
        var template = await _db.UserTrainingTemplates
            .Include(t => t.Workouts)
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.UserId == request.UserId, ct);

        if (template is null) return null;

        template.Name = request.Name;
        template.Description = request.Description;

        _db.UserTemplateWorkouts.RemoveRange(template.Workouts);
        template.Workouts = request.Workouts.Select(w => new UserTemplateWorkout
        {
            TemplateId = template.Id,
            DaysFromRace = w.DaysFromRace,
            Title = w.Title,
            WorkoutType = w.WorkoutType,
            DistanceMeters = w.DistanceMeters,
            Notes = w.Notes,
        }).ToList();

        await _db.SaveChangesAsync(ct);
        return CreateUserTemplateCommandHandler.ToDto(template);
    }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

public record DeleteUserTemplateCommand(string UserId, Guid TemplateId) : IRequest<bool>;

public class DeleteUserTemplateCommandHandler : IRequestHandler<DeleteUserTemplateCommand, bool>
{
    private readonly IApplicationDbContext _db;
    public DeleteUserTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteUserTemplateCommand request, CancellationToken ct)
    {
        var template = await _db.UserTrainingTemplates
            .Include(t => t.Workouts)
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.UserId == request.UserId, ct);

        if (template is null) return false;
        _db.UserTemplateWorkouts.RemoveRange(template.Workouts);
        _db.UserTrainingTemplates.Remove(template);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// ─── Apply ────────────────────────────────────────────────────────────────────

public record ApplyUserTemplateCommand(
    string UserId,
    Guid TemplateId,
    DateTime RaceDate,
    double IntensityMultiplier = 1.0
) : IRequest<int>;

public class ApplyUserTemplateCommandHandler : IRequestHandler<ApplyUserTemplateCommand, int>
{
    private readonly IApplicationDbContext _db;
    public ApplyUserTemplateCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<int> Handle(ApplyUserTemplateCommand request, CancellationToken ct)
    {
        var template = await _db.UserTrainingTemplates
            .Include(t => t.Workouts)
            .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.UserId == request.UserId, ct);

        if (template is null) throw new InvalidOperationException("Template not found.");

        var raceDate = request.RaceDate.Date;
        var workouts = template.Workouts.Select(w => new ScheduledWorkout
        {
            UserId = request.UserId,
            Date = raceDate.AddDays(w.DaysFromRace),
            Title = w.Title,
            WorkoutType = w.WorkoutType,
            SportType = SportType.Run,
            Notes = w.Notes,
            PlannedDistanceMeters = w.DistanceMeters.HasValue
                ? w.DistanceMeters.Value * request.IntensityMultiplier
                : null,
        }).ToList();

        _db.ScheduledWorkouts.AddRange(workouts);
        await _db.SaveChangesAsync(ct);
        return workouts.Count;
    }
}
