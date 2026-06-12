$ErrorActionPreference = "Stop"

$Remote = "https://github.com/Andrewyuan34/Finals.git"
$Branch = "main"
$Message = "feat: enhance Finals live simulation"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or not in PATH. Install Git for Windows first: https://git-scm.com/download/win"
}

if (-not (Test-Path ".git")) {
  git init
}

git branch -M $Branch

$hasOrigin = $false
try {
  git remote get-url origin | Out-Null
  $hasOrigin = $true
} catch {
  $hasOrigin = $false
}

if ($hasOrigin) {
  git remote set-url origin $Remote
} else {
  git remote add origin $Remote
}

git add .

$status = git status --porcelain
if ($status) {
  git commit -m $Message
} else {
  Write-Host "No local changes to commit." -ForegroundColor Yellow
}

git push -u origin $Branch

Write-Host "Pushed to $Remote" -ForegroundColor Green
