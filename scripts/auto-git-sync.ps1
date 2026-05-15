param(
    [string]$MessagePrefix = "auto-save",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    throw "Cannot determine current Git branch."
}

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit."
    exit 0
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "$MessagePrefix $timestamp"

git add -A
git commit -m $message

if (-not $NoPush) {
    git push origin $branch
}

Write-Host "Committed changes on $branch with message: $message"
