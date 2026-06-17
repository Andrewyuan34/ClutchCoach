$ErrorActionPreference = "Stop"

$Server = "ubuntu@49.233.151.34"
$RemoteDir = "/var/www/nba-live"
$RemoteTarget = "${Server}:${RemoteDir}/"
$PublicUrl = "http://49.233.151.34/live.html"

$Files = @(
  "live.html",
  "src",
  "tools",
  "docs",
  "README.md"
)

$ObsoleteFiles = @(
  "commentary-data.js",
  "game.js",
  "index.html",
  "live-sim.js",
  "series-pbp-data.js",
  "style.css"
)

Write-Host "Checking local files..." -ForegroundColor Cyan
foreach ($file in $Files) {
  if (-not (Test-Path $file)) {
    throw "Missing file: $file. Please run this script from the project directory."
  }
}

Write-Host "Removing obsolete remote files..." -ForegroundColor Cyan
$obsoleteArgs = ($ObsoleteFiles | ForEach-Object { "'" + $_ + "'" }) -join " "
ssh $Server "cd '$RemoteDir' && rm -f $obsoleteArgs"

if ($LASTEXITCODE -ne 0) {
  throw "Remote cleanup failed. Please check SSH access or server permissions."
}

Write-Host "Uploading to $RemoteTarget" -ForegroundColor Cyan
scp -r @Files $RemoteTarget

if ($LASTEXITCODE -ne 0) {
  throw "Upload failed. Please check network, password, or server permissions."
}

Write-Host "Fixing remote static file permissions..." -ForegroundColor Cyan
ssh $Server "chmod 755 '$RemoteDir' && find '$RemoteDir' -type d -exec chmod 755 {} \; && find '$RemoteDir' -type f -exec chmod 644 {} \;"

if ($LASTEXITCODE -ne 0) {
  throw "Remote permission fix failed. Please check SSH access or server permissions."
}

Write-Host "Verifying remote deployment..." -ForegroundColor Cyan
$VerifyUrl = "${PublicUrl}?ai_verify=1&seed=demo-001"
node tools/check-ai-contract.mjs "--url=$VerifyUrl"

if ($LASTEXITCODE -ne 0) {
  throw "Remote verification failed. Check whether Nginx serves src/styles/live.css as text/css and src/live-sim.mjs as JavaScript instead of HTML fallback."
}

Write-Host "Deploy complete. Open: $PublicUrl" -ForegroundColor Green
