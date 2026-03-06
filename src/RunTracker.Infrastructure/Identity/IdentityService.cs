using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RunTracker.Application.Common.Interfaces;
using RunTracker.Domain.Entities;

namespace RunTracker.Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _configuration;

    public IdentityService(UserManager<User> userManager, IConfiguration configuration)
    {
        _userManager = userManager;
        _configuration = configuration;
    }

    public async Task<(bool Succeeded, string UserId, string[] Errors)> RegisterAsync(string email, string password)
    {
        var user = new User
        {
            UserName = email,
            Email = email,
            ProfilePictureUrl = $"https://api.dicebear.com/9.x/initials/svg?seed={Uri.EscapeDataString(email)}"
        };

        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            return (false, string.Empty, result.Errors.Select(e => e.Description).ToArray());

        return (true, user.Id, Array.Empty<string>());
    }

    public async Task<(bool Succeeded, string Token, string[] Errors)> LoginAsync(string email, string password)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
            return (false, string.Empty, new[] { "Invalid email or password." });

        var isValid = await _userManager.CheckPasswordAsync(user, password);
        if (!isValid)
            return (false, string.Empty, new[] { "Invalid email or password." });

        var token = GenerateJwtToken(user);
        return (true, token, Array.Empty<string>());
    }

    public async Task<string?> GetUserIdByEmailAsync(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        return user?.Id;
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
            _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured")));
        
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email!),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "RunTracker",
            audience: _configuration["Jwt:Audience"] ?? "RunTracker",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
