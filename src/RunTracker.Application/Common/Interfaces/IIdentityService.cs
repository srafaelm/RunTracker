namespace RunTracker.Application.Common.Interfaces;

public interface IIdentityService
{
    Task<(bool Succeeded, string UserId, string[] Errors)> RegisterAsync(string email, string password);
    Task<(bool Succeeded, string Token, string[] Errors)> LoginAsync(string email, string password);
    Task<string?> GetUserIdByEmailAsync(string email);
}
