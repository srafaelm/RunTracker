using MediatR;
using RunTracker.Application.Activities.DTOs;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Activities.Commands;

public record ImportGpxActivityCommand(
    string UserId,
    Stream GpxStream,
    string? Name,
    SportType? SportType
) : IRequest<ActivityDetailDto>;
