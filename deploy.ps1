$ErrorActionPreference = "Stop"

$Server = "ubuntu@49.233.151.34"
$RemoteDir = "/var/www/nba-live"
$RemoteTarget = "${Server}:${RemoteDir}/"

$Files = @(
  "commentary-data.js",
  "game.js",
  "index.html",
  "live-sim.js",
  "live.html",
  "series-pbp-data.js",
  "style.css"
)

Write-Host "Checking local files..." -ForegroundColor Cyan
foreach ($file in $Files) {
  if (-not (Test-Path $file)) {
    throw "Missing file: $file. Please run this script from the project directory."
  }
}

Write-Host "Uploading to $RemoteTarget" -ForegroundColor Cyan
scp @Files $RemoteTarget

if ($LASTEXITCODE -ne 0) {
  throw "Upload failed. Please check network, password, or server permissions."
}

Write-Host "Deploy complete. Open: http://49.233.151.34/live.html" -ForegroundColor Green
