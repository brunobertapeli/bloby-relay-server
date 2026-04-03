# ─── Fluxy Installer ────────────────────────────────────────────────────────
# irm https://fluxy.bot/install.ps1 | iex
#
# Downloads Node.js + Fluxy into ~/.fluxy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$MIN_NODE_MAJOR = 18
$NODE_VERSION = "22.14.0"
$FLUXY_HOME = Join-Path $env:USERPROFILE ".fluxy"
$TOOLS_DIR = Join-Path $FLUXY_HOME "tools"
$NODE_DIR = Join-Path $TOOLS_DIR "node"
$BIN_DIR = Join-Path $FLUXY_HOME "bin"
$USE_SYSTEM_NODE = $false

# Ensure UTF-8 output for proper rendering
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Brand colors via ANSI escape sequences: #32A5F7 (blue) and #DB36A3 (pink)
$BLUE = "`e[38;2;50;165;247m"
$PINK = "`e[38;2;219;54;163m"
$BOLD = "`e[1m"
$RSET = "`e[0m"

# Use ANSI sequences for consistent rendering; fallback to plain if no VT support
$vtSupported = $null -ne $env:WT_SESSION -or $PSVersionTable.PSVersion.Major -ge 7 -or $host.UI.SupportsVirtualTerminal

function Write-Check($text) {
    if ($vtSupported) { Write-Host "  ${BLUE}✔${RSET}  $text" }
    else { Write-Host "  ✔  $text" -ForegroundColor Cyan }
}

function Write-Down($text) {
    if ($vtSupported) { Write-Host "  ${PINK}↓${RSET}  $text" }
    else { Write-Host "  ↓  $text" -ForegroundColor Cyan }
}

Write-Host ""
if ($vtSupported) {
    Write-Host "${BLUE}${BOLD}      _______ _                    ${RSET}"
    Write-Host "${BLUE}${BOLD}     (_______) |                   ${RSET}"
    Write-Host "${BLUE}${BOLD}      _____  | |_   _ _   _ _   _  ${RSET}"
    Write-Host "${BLUE}${BOLD}     |  ___) | | | | ( \ / ) | | | ${RSET}"
    Write-Host "${PINK}${BOLD}     | |     | | |_| |) X (| |_| | ${RSET}"
    Write-Host "${PINK}${BOLD}     |_|     |_|\____(_/ \_)\__  | ${RSET}"
    Write-Host "${PINK}${BOLD}                           (____/   ${RSET}"
} else {
    Write-Host "      _______ _                    " -ForegroundColor Cyan
    Write-Host "     (_______) |                   " -ForegroundColor Cyan
    Write-Host "      _____  | |_   _ _   _ _   _  " -ForegroundColor Cyan
    Write-Host "     |  ___) | | | | ( \ / ) | | | " -ForegroundColor Cyan
    Write-Host "     | |     | | |_| |) X (| |_| | " -ForegroundColor Magenta
    Write-Host "     |_|     |_|\____(_/ \_)\__  | " -ForegroundColor Magenta
    Write-Host "                           (____/   " -ForegroundColor Magenta
}
Write-Host ""
Write-Host "     Self-hosted, self-evolving AI agent with its own dashboard." -ForegroundColor DarkGray
Write-Host "     -----------------------------" -ForegroundColor DarkGray
Write-Host ""

# ─── Detect platform ────────────────────────────────────────────────────────

function Detect-Platform {
    $script:PLATFORM = "win"

    if ([Environment]::Is64BitOperatingSystem) {
        if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
            $script:NODEARCH = "arm64"
        } else {
            $script:NODEARCH = "x64"
        }
    } else {
        $script:NODEARCH = "x86"
    }

    Write-Host "  Platform: windows/$NODEARCH" -ForegroundColor DarkGray
}

# ─── Check for system Node.js ─────────────────────────────────────────────

function Check-SystemNode {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        try {
            $ver = (node -v 2>$null)
            if ($ver -match '^v(\d+)') {
                $major = [int]$Matches[1]
                if ($major -ge $MIN_NODE_MAJOR) {
                    $script:USE_SYSTEM_NODE = $true
                    Write-Check "Node.js $ver (system)"
                    return $true
                }
            }
        } catch {}
    }
    return $false
}

# ─── Download Node.js ───────────────────────────────────────────────────────

function Install-Node {
    $nodeBin = Join-Path $NODE_DIR "node.exe"

    # Check if we already have a bundled node that works
    if (Test-Path $nodeBin) {
        try {
            $existing = & $nodeBin -v 2>$null
            if ($existing) {
                Write-Check "Node.js $existing (bundled)"
                return
            }
        } catch {}
    }

    Write-Down "Downloading Node.js v${NODE_VERSION}..."

    $nodeUrl = "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-${NODEARCH}.zip"
    $tmpFile = Join-Path ([System.IO.Path]::GetTempPath()) "node-fluxy.zip"

    Invoke-WebRequest -Uri $nodeUrl -OutFile $tmpFile -UseBasicParsing

    # Extract
    New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null
    if (Test-Path $NODE_DIR) { Remove-Item $NODE_DIR -Recurse -Force }

    $tmpExtract = Join-Path ([System.IO.Path]::GetTempPath()) "node-fluxy-extract"
    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }

    Expand-Archive -Path $tmpFile -DestinationPath $tmpExtract -Force
    $extracted = Get-ChildItem $tmpExtract | Select-Object -First 1
    Move-Item -Path $extracted.FullName -Destination $NODE_DIR -Force

    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue

    # Verify
    $nodeBin = Join-Path $NODE_DIR "node.exe"
    if (-not (Test-Path $nodeBin)) {
        Write-Host "  ✗  Node.js download failed" -ForegroundColor Red
        exit 1
    }

    Write-Check "Node.js v${NODE_VERSION} installed"
}

# ─── Install Fluxy ────────────────────────────────────────────────────────

function Install-Fluxy {
    if ($USE_SYSTEM_NODE) {
        $NPM = "npm"
        $NODE_BIN = "node"
    } else {
        $NPM = Join-Path $NODE_DIR "npm.cmd"
        $NODE_BIN = Join-Path $NODE_DIR "node.exe"
    }

    # Fetch version + tarball URL from npm registry
    $npmVersion = ""
    try { $npmVersion = (& $NPM view fluxy-bot version 2>$null).Trim() } catch {}
    if ($npmVersion) {
        Write-Host "  Latest npm version: fluxy-bot@${npmVersion}" -ForegroundColor DarkGray
    }

    Write-Down "Installing fluxy..."

    $tarballUrl = (& $NPM view fluxy-bot dist.tarball 2>$null).Trim()
    if (-not $tarballUrl) {
        Write-Host "  ✗  Failed to fetch package info from npm" -ForegroundColor Red
        exit 1
    }

    # Download and extract tarball
    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("fluxy-install-" + [guid]::NewGuid().ToString("N").Substring(0,8))
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $tarball = Join-Path $tmpDir "fluxy.tgz"
        Invoke-WebRequest -Uri $tarballUrl -OutFile $tarball -UseBasicParsing

        tar xzf $tarball -C $tmpDir

        $extracted = Join-Path $tmpDir "package"
        if (-not (Test-Path $extracted)) {
            Write-Host "  ✗  Installation failed" -ForegroundColor Red
            exit 1
        }

        New-Item -ItemType Directory -Path $FLUXY_HOME -Force | Out-Null

        # Copy code directories (always safe to overwrite)
        foreach ($dir in @("bin", "supervisor", "worker", "shared", "scripts")) {
            $src = Join-Path $extracted $dir
            if (Test-Path $src) {
                Copy-Item -Path $src -Destination $FLUXY_HOME -Recurse -Force
            }
        }

        # Copy workspace template only on first install (preserves user files)
        $wsDst = Join-Path $FLUXY_HOME "workspace"
        if (-not (Test-Path $wsDst)) {
            $wsSrc = Join-Path $extracted "workspace"
            if (Test-Path $wsSrc) {
                Copy-Item -Path $wsSrc -Destination $FLUXY_HOME -Recurse
            }
        }

        # Copy code files (never touches config.json, memory.db, etc.)
        foreach ($file in @("package.json", "vite.config.ts", "vite.fluxy.config.ts", "tsconfig.json", "postcss.config.js", "components.json")) {
            $src = Join-Path $extracted $file
            if (Test-Path $src) {
                Copy-Item -Path $src -Destination (Join-Path $FLUXY_HOME $file) -Force
            }
        }

        # Copy pre-built UI from tarball, or build from source
        $distSrc = Join-Path $extracted "dist-fluxy"
        $distDst = Join-Path $FLUXY_HOME "dist-fluxy"
        if (Test-Path $distSrc) {
            if (Test-Path $distDst) { Remove-Item $distDst -Recurse -Force }
            Copy-Item -Path $distSrc -Destination $distDst -Recurse
            Write-Check "Chat interface ready"
        } elseif (-not (Test-Path (Join-Path $distDst "onboard.html"))) {
            Write-Down "Building chat interface..."
            Push-Location $FLUXY_HOME
            try {
                & $NPM run build:fluxy 2>$null
                Write-Check "Chat interface built"
            } catch {
                Write-Host "  !  Chat build failed — will build on first start" -ForegroundColor Yellow
            }
            Pop-Location
        } else {
            Write-Check "Chat interface ready"
        }
    } finally {
        Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    # Install dependencies inside ~/.fluxy/
    Push-Location $FLUXY_HOME
    try {
        & $NPM install --omit=dev 2>$null
    } catch {}
    Pop-Location

    # Install workspace dependencies (rebuilds native modules for this platform)
    $wsDir = Join-Path $FLUXY_HOME "workspace"
    if (Test-Path (Join-Path $wsDir "package.json")) {
        Write-Down "Installing workspace dependencies..."
        Push-Location $wsDir
        try {
            & $NPM install --omit=dev 2>$null
        } catch {}
        Pop-Location
    }

    # Verify
    $cliPath = Join-Path $FLUXY_HOME "bin\cli.js"
    if (-not (Test-Path $cliPath)) {
        Write-Host "  ✗  Installation failed" -ForegroundColor Red
        exit 1
    }

    $script:VERSION = "unknown"
    try {
        $pkgJson = Get-Content (Join-Path $FLUXY_HOME "package.json") -Raw | ConvertFrom-Json
        $script:VERSION = $pkgJson.version
    } catch {}

    Write-Check "Fluxy v${VERSION} installed"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

function Create-Wrapper {
    New-Item -ItemType Directory -Path $BIN_DIR -Force | Out-Null

    # Remove any existing wrapper
    $wrapperPath = Join-Path $BIN_DIR "fluxy.cmd"
    Remove-Item $wrapperPath -Force -ErrorAction SilentlyContinue

    if ($USE_SYSTEM_NODE) {
        $wrapper = @"
@echo off
node "%USERPROFILE%\.fluxy\bin\cli.js" %*
"@
    } else {
        $wrapper = @"
@echo off
"%USERPROFILE%\.fluxy\tools\node\node.exe" "%USERPROFILE%\.fluxy\bin\cli.js" %*
"@
    }

    Set-Content -Path $wrapperPath -Value $wrapper -Encoding ASCII
    Write-Check "Created ~/.fluxy/bin/fluxy.cmd"
}

# ─── Add to PATH ────────────────────────────────────────────────────────────

function Setup-Path {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$BIN_DIR*") {
        [Environment]::SetEnvironmentVariable("Path", "$BIN_DIR;$userPath", "User")
        $env:Path = "$BIN_DIR;$env:Path"
        Write-Check "Added to PATH"
    } else {
        Write-Check "PATH already configured"
    }
}

# ─── Main ────────────────────────────────────────────────────────────────────

New-Item -ItemType Directory -Path $FLUXY_HOME -Force | Out-Null

Detect-Platform
if (-not (Check-SystemNode)) { Install-Node }
Install-Fluxy
Create-Wrapper
Setup-Path

Write-Host ""
if ($vtSupported) {
    Write-Host "  ${PINK}${BOLD}✔  Fluxy is ready!${RSET}"
} else {
    Write-Host "  ✔  Fluxy is ready!" -ForegroundColor Magenta
}
Write-Host ""
Write-Host "  -----------------------------" -ForegroundColor DarkGray
Write-Host "  Get started:"
Write-Host ""
if ($vtSupported) {
    Write-Host "    ${BLUE}fluxy init${RSET}      Set up your bot"
    Write-Host "    ${BLUE}fluxy start${RSET}     Start your bot"
    Write-Host "    ${BLUE}fluxy status${RSET}    Check if it's running"
    Write-Host ""
    Write-Host "  ${PINK}>${RSET} Run ${BLUE}fluxy init${RSET} to begin."
} else {
    Write-Host "    fluxy init      " -ForegroundColor Cyan -NoNewline; Write-Host "Set up your bot"
    Write-Host "    fluxy start     " -ForegroundColor Cyan -NoNewline; Write-Host "Start your bot"
    Write-Host "    fluxy status    " -ForegroundColor Cyan -NoNewline; Write-Host "Check if it's running"
    Write-Host ""
    Write-Host "  > " -ForegroundColor Magenta -NoNewline
    Write-Host "Run " -NoNewline
    Write-Host "fluxy init" -ForegroundColor Cyan -NoNewline
    Write-Host " to begin."
}
Write-Host "  (Open a new terminal if 'fluxy' isn't found yet)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  https://fluxy.bot" -ForegroundColor DarkGray
Write-Host ""
