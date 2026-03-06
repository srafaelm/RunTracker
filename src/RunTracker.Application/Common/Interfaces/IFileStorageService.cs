namespace RunTracker.Application.Common.Interfaces;

public interface IFileStorageService
{
    /// <summary>Saves a file from a stream, returns the public URL path.</summary>
    Task<string> SaveFileAsync(Stream stream, string fileName, string contentType, CancellationToken ct = default);
    void DeleteFile(string urlPath);
}
