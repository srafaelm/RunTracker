using MediatR;
using Microsoft.EntityFrameworkCore;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Goals;

// --- Create ---
public record CreateGoalCommand(
    string UserId,
    SportType? SportType,
    GoalPeriod Period,
    double TargetDistanceKm
) : IRequest<GoalDto>;

public class CreateGoalCommandHandler : IRequestHandler<CreateGoalCommand, GoalDto>
{
    private readonly IApplicationDbContext _db;

    public CreateGoalCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<GoalDto> Handle(CreateGoalCommand request, CancellationToken ct)
    {
        // Deactivate any existing goal with same period+sport type
        var existing = await _db.UserGoals
            .Where(g => g.UserId == request.UserId && g.IsActive
                && g.Period == request.Period
                && g.SportType == request.SportType)
            .ToListAsync(ct);
        foreach (var e in existing) e.IsActive = false;

        var goal = new UserGoal
        {
            UserId = request.UserId,
            SportType = request.SportType,
            Period = request.Period,
            TargetDistanceKm = request.TargetDistanceKm,
            IsActive = true,
        };
        _db.UserGoals.Add(goal);
        await _db.SaveChangesAsync(ct);

        return new GoalDto(goal.Id, goal.SportType, goal.Period,
            goal.TargetDistanceKm, goal.IsActive, 0, 0);
    }
}

// --- Update ---
public record UpdateGoalCommand(string UserId, Guid GoalId, double TargetDistanceKm) : IRequest<bool>;

public class UpdateGoalCommandHandler : IRequestHandler<UpdateGoalCommand, bool>
{
    private readonly IApplicationDbContext _db;

    public UpdateGoalCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(UpdateGoalCommand request, CancellationToken ct)
    {
        var goal = await _db.UserGoals.FirstOrDefaultAsync(
            g => g.Id == request.GoalId && g.UserId == request.UserId, ct);
        if (goal is null) return false;

        goal.TargetDistanceKm = request.TargetDistanceKm;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}

// --- Delete ---
public record DeleteGoalCommand(string UserId, Guid GoalId) : IRequest<bool>;

public class DeleteGoalCommandHandler : IRequestHandler<DeleteGoalCommand, bool>
{
    private readonly IApplicationDbContext _db;

    public DeleteGoalCommandHandler(IApplicationDbContext db) => _db = db;

    public async Task<bool> Handle(DeleteGoalCommand request, CancellationToken ct)
    {
        var goal = await _db.UserGoals.FirstOrDefaultAsync(
            g => g.Id == request.GoalId && g.UserId == request.UserId, ct);
        if (goal is null) return false;

        _db.UserGoals.Remove(goal);
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
