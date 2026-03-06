namespace RunTracker.Application.Dashboard.DTOs;

public record DashboardTemplateDto(Guid Id, string Name, string[] Widgets, bool IsDefault, int SortOrder);
