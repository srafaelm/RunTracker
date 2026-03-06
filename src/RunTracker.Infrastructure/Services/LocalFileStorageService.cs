using Microsoft.AspNetCore.Hosting;
using RunTracker.Application.Common.Interfaces;

namespace RunTracker.Infrastructure.Services;

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _uploadsRoot;

    public LocalFileStorageService(IWebHostEnvironment env)
    {
        _uploadsRoot = Path.Combine(env.WebRootPath, "uploads", "avatars");
        Directory.CreateDirectory(_uploadsRoot);
    }

    public async Task<string> SaveFileAsync(Stream stream, string fileName, string contentType, CancellationToken ct = default)
    {
        var ext = contentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png"  => ".png",
            "image/webp" => ".webp",
            _ => Path.GetExtension(fileName)
        };

        var uniqueName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(_uploadsRoot, uniqueName);

        await using var fs = File.Create(filePath);
        await stream.CopyToAsync(fs, ct);

        return $"/uploads/avatars/{uniqueName}";
    }

    public void DeleteFile(string urlPath)
    {
        if (string.IsNullOrEmpty(urlPath)) return;
        if (urlPath.Contains("/defaults/")) return;
        var fileName = Path.GetFileName(urlPath);
        var filePath = Path.Combine(_uploadsRoot, fileName);
        if (File.Exists(filePath))
            File.Delete(filePath);
    }
}
