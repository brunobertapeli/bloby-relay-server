# ─── Fluxy Installer (Windows) ───────────────────────────────────────────────
# irm https://fluxy.bot/install.ps1 | iex
#
# Downloads Node.js + Fluxy into ~/.fluxy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$Version = "0.1.0"
$NodeVersion = "22.14.0"
$FluxyHome = Join-Path $env:USERPROFILE ".fluxy"
$ToolsDir = Join-Path $FluxyHome "tools"
$NodeDir = Join-Path $ToolsDir "node"
$BinDir = Join-Path $FluxyHome "bin"

Write-Host ""
Write-Host "  ╔═══════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       FLUXY  v$Version          ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  Self-hosted AI bot" -ForegroundColor DarkGray
Write-Host ""

# ─── Detect architecture ────────────────────────────────────────────────────

$Arch = if ([Environment]::Is64BitOperatingSystem) {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
} else { "x86" }

Write-Host "  Platform: win32/$Arch" -ForegroundColor DarkGray

# ─── Download Node.js ───────────────────────────────────────────────────────

$NodeExe = Join-Path $NodeDir "node.exe"
$NpmCmd = Join-Path $NodeDir "npm.cmd"

if (Test-Path $NodeExe) {
    $existing = & $NodeExe -v 2>$null
    if ($existing) {
        Write-Host "  ✔  Node.js $existing (bundled)" -ForegroundColor Green
    }
} else {
    Write-Host "  ↓  Downloading Node.js v$NodeVersion..." -ForegroundColor Cyan

    $nodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-$Arch.zip"
    $tmpZip = Join-Path $env:TEMP "node-fluxy.zip"
    $tmpExtract = Join-Path $env:TEMP "node-fluxy-extract"

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $nodeUrl -OutFile $tmpZip -UseBasicParsing

    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
    Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

    $extracted = Get-ChildItem $tmpExtract | Select-Object -First 1
    if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
    New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
    Move-Item $extracted.FullName $NodeDir

    Remove-Item $tmpZip -Force
    Remove-Item $tmpExtract -Recurse -Force

    if (-not (Test-Path $NodeExe)) {
        Write-Host "  ✗  Node.js download failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "  ✔  Node.js v$NodeVersion installed" -ForegroundColor Green
}

# ─── Install Fluxy ──────────────────────────────────────────────────────────

Write-Host "  ↓  Installing fluxy..." -ForegroundColor Cyan

& $NpmCmd install -g fluxy-bot --prefix $FluxyHome 2>$null

$CliPath = Join-Path $FluxyHome "node_modules\fluxy-bot\bin\cli.js"
if (-not (Test-Path $CliPath)) {
    Write-Host "  ✗  Installation failed" -ForegroundColor Red
    exit 1
}

Write-Host "  ✔  Fluxy v$Version installed" -ForegroundColor Green

# ─── Create wrapper ─────────────────────────────────────────────────────────

New-Item -ItemType Directory -Path $BinDir -Force | Out-Null

$wrapperContent = @"
@echo off
"%USERPROFILE%\.fluxy\tools\node\node.exe" "%USERPROFILE%\.fluxy\node_modules\fluxy-bot\bin\cli.js" %*
"@

Set-Content -Path (Join-Path $BinDir "fluxy.cmd") -Value $wrapperContent
Write-Host "  ✔  Created ~/.fluxy/bin/fluxy.cmd" -ForegroundColor Green

# ─── Add to PATH ────────────────────────────────────────────────────────────

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$BinDir;$userPath", "User")
    $env:Path = "$BinDir;$env:Path"
    Write-Host "  ✔  Added to PATH" -ForegroundColor Green
}

# ─── Done ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ✔  Fluxy is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Get started:"
Write-Host ""
Write-Host "    fluxy init      " -NoNewline -ForegroundColor Cyan
Write-Host "Set up your bot"
Write-Host "    fluxy start     " -NoNewline -ForegroundColor Cyan
Write-Host "Start your bot"
Write-Host "    fluxy status    " -NoNewline -ForegroundColor Cyan
Write-Host "Check if it's running"
Write-Host ""
Write-Host "  Run 'fluxy init' to begin." -ForegroundColor DarkGray
Write-Host "  (Open a new terminal if 'fluxy' isn't found yet)" -ForegroundColor DarkGray
Write-Host ""
