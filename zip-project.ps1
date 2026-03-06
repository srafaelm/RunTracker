# Zips the entire project excluding node_modules, build artifacts, and git history.
# Output zip is created in the same folder as this script.

$root = $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = "$root\run-app-$timestamp.zip"

$excludeDirs = @('node_modules', '.git', 'obj', 'bin', 'dist')

# Copy to a temp folder, then zip to preserve structure
$temp = Join-Path $env:TEMP "run-app-zip-$timestamp"
New-Item -ItemType Directory -Path $temp | Out-Null

Write-Host "Copying files..."
Get-ChildItem -Path $root -Recurse | Where-Object {
    $rel = $_.FullName.Substring($root.Length + 1)
    $parts = $rel -split '\\'
    -not ($parts | Where-Object { $excludeDirs -contains $_ }) -and
    $_.Name -notlike '*.zip'
} | ForEach-Object {
    $dest = Join-Path $temp $_.FullName.Substring($root.Length + 1)
    if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    } else {
        $destDir = Split-Path $dest -Parent
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Copy-Item $_.FullName -Destination $dest
    }
}

Write-Host "Compressing..."
Compress-Archive -Path "$temp\*" -DestinationPath $output -Force

Remove-Item -Recurse -Force $temp

Write-Host "Created: $output"
