$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$dist = Join-Path $root "dist"
$staging = Join-Path $dist "chrome-extension"
$zip = Join-Path $dist ("lingxi-form-a11y-patch-" + $manifest.version + ".zip")

Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($path in @("manifest.json", "src", "icons", "README.md", "PRIVACY.md")) {
  Copy-Item -Path (Join-Path $root $path) -Destination $staging -Recurse
}

Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip
Write-Host $zip
