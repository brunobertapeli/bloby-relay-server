# ─── Morphy Installer ────────────────────────────────────────────────────────
# irm https://morphyagent.com/install.ps1 | iex
#
# Downloads Node.js + Morphy into ~/.morphy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

# TLS 1.2 floor for Windows PowerShell 5.1 (which can default to TLS 1.0/1.1 and
# fail against nodejs.org/npm). OR-in so we never DROP TLS 1.3 on PowerShell 7+.
try {
    [Net.ServicePointManager]::SecurityProtocol = `
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

# Get-Url <url> <outFile> — download with a timeout and up to 3 attempts so a
# single transient blip doesn't abort the whole install. PS 5.1-compatible
# (no -MaximumRetryCount, which is PowerShell 6+ only).
function Get-Url($url, $outFile) {
    $attempt = 0
    while ($true) {
        $attempt++
        try {
            Invoke-WebRequest -Uri $url -OutFile $outFile -UseBasicParsing -TimeoutSec 60
            return
        } catch {
            if ($attempt -ge 3) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

$MIN_NODE_MAJOR = 18
$NODE_VERSION = "22.14.0"
$MORPHY_HOME = Join-Path $env:USERPROFILE ".morphy"
$TOOLS_DIR = Join-Path $MORPHY_HOME "tools"
$NODE_DIR = Join-Path $TOOLS_DIR "node"
$BIN_DIR = Join-Path $MORPHY_HOME "bin"
$USE_SYSTEM_NODE = $false

# Ensure UTF-8 output for proper rendering
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Brand colors: #00ADFE (light) and #0158FB (deep) -- Morphy palette
$BLUE = "`e[38;2;0;173;254m"
$PINK = "`e[38;2;1;88;251m"
# Logo gradient: #00ADFE (top) -> #0158FB (bottom)
$G1 = "`e[38;2;0;173;254m"
$G2 = "`e[38;2;0;159;254m"
$G3 = "`e[38;2;0;145;253m"
$G4 = "`e[38;2;1;131;253m"
$G5 = "`e[38;2;1;116;252m"
$G6 = "`e[38;2;1;102;251m"
$G7 = "`e[38;2;1;88;251m"
$BOLD = "`e[1m"
$DIM = "`e[2m"
$YELLOW = "`e[33m"
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
    Write-Host "${G1}${BOLD}                                █▄         ${RSET}"
    Write-Host "${G2}${BOLD}      ▄              ▄          ██         ${RSET}"
    Write-Host "${G3}${BOLD}      ███▄███▄ ▄███▄ ████▄████▄ ████▄ ██ ██${RSET}"
    Write-Host "${G4}${BOLD}      ██ ██ ██ ██ ██ ██   ██ ██ ██ ██ ██▄██${RSET}"
    Write-Host "${G5}${BOLD}     ▄██ ██ ▀█▄▀███▀▄█▀  ▄████▀▄██ ██▄▄▀██▀${RSET}"
    Write-Host "${G6}${BOLD}                          ██            ██ ${RSET}"
    Write-Host "${G7}${BOLD}                          ▀           ▀▀▀  ${RSET}"
} else {
    Write-Host "                                █▄         " -ForegroundColor Cyan
    Write-Host "      ▄              ▄          ██         " -ForegroundColor Cyan
    Write-Host "      ███▄███▄ ▄███▄ ████▄████▄ ████▄ ██ ██" -ForegroundColor Cyan
    Write-Host "      ██ ██ ██ ██ ██ ██   ██ ██ ██ ██ ██▄██" -ForegroundColor Blue
    Write-Host "     ▄██ ██ ▀█▄▀███▀▄█▀  ▄████▀▄██ ██▄▄▀██▀" -ForegroundColor Blue
    Write-Host "                          ██            ██ " -ForegroundColor Blue
    Write-Host "                          ▀           ▀▀▀  " -ForegroundColor Blue
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

    $nodeFile = "node-v${NODE_VERSION}-win-${NODEARCH}.zip"
    $nodeUrl = "https://nodejs.org/dist/v${NODE_VERSION}/$nodeFile"
    $tmpFile = Join-Path ([System.IO.Path]::GetTempPath()) "node-morphy.zip"

    Get-Url $nodeUrl $tmpFile

    # Integrity: verify against nodejs.org SHASUMS256.txt before extracting. A
    # mismatch is fatal; an unreachable sums file degrades to a warning.
    try {
        $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 30).Content
        $line = $sums -split "`n" | Where-Object { $_ -match ([regex]::Escape($nodeFile) + '\s*$') } | Select-Object -First 1
        if ($line) {
            $expectedHash = ($line -split '\s+')[0]
            $actualHash = (Get-FileHash -Path $tmpFile -Algorithm SHA256).Hash
            if ($actualHash -ieq $expectedHash) {
                Write-Check "Checksum verified"
            } else {
                Write-Host "  ✗  Node.js checksum mismatch — aborting (corrupt or tampered download)" -ForegroundColor Red
                Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
                exit 1
            }
        } else {
            Write-Host "  !  Could not find checksum entry — skipping verification" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  !  Could not fetch checksums — skipping verification" -ForegroundColor Yellow
    }

    # Extract into a staging dir, verify it runs, then swap. Move-Item cannot
    # overwrite a populated directory, so the existing node is moved aside and
    # removed only AFTER the new tree is verified — an interrupt never strands us.
    New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null
    $tmpExtract = Join-Path ([System.IO.Path]::GetTempPath()) "node-morphy-extract"
    if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }

    Expand-Archive -Path $tmpFile -DestinationPath $tmpExtract -Force
    $extracted = Get-ChildItem $tmpExtract | Select-Object -First 1
    $nodeNew = "$NODE_DIR.new"
    if (Test-Path $nodeNew) { Remove-Item $nodeNew -Recurse -Force }
    Move-Item -Path $extracted.FullName -Destination $nodeNew -Force

    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue

    $stagedNode = Join-Path $nodeNew "node.exe"
    $stagedOk = $false
    try { $stagedOk = [bool](& $stagedNode -v 2>$null) } catch {}
    if (-not $stagedOk) {
        Write-Host "  ✗  Node.js download failed (extracted binary does not run)" -ForegroundColor Red
        Remove-Item $nodeNew -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }

    if (Test-Path "$NODE_DIR.old") { Remove-Item "$NODE_DIR.old" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path $NODE_DIR) { Move-Item $NODE_DIR "$NODE_DIR.old" -Force }
    Move-Item $nodeNew $NODE_DIR -Force
    if (Test-Path "$NODE_DIR.old") { Remove-Item "$NODE_DIR.old" -Recurse -Force -ErrorAction SilentlyContinue }

    # Verify
    $nodeBin = Join-Path $NODE_DIR "node.exe"
    if (-not (Test-Path $nodeBin)) {
        Write-Host "  ✗  Node.js download failed" -ForegroundColor Red
        exit 1
    }

    Write-Check "Node.js v${NODE_VERSION} installed"
}

# ─── Install Morphy ────────────────────────────────────────────────────────

function Install-Morphy {
    if ($USE_SYSTEM_NODE) {
        $NPM = "npm"
        $NODE_BIN = "node"
    } else {
        $NPM = Join-Path $NODE_DIR "npm.cmd"
        $NODE_BIN = Join-Path $NODE_DIR "node.exe"
    }

    # Fetch version + tarball URL from npm registry
    $npmVersion = ""
    try { $npmVersion = (& $NPM view morphyagent version 2>$null).Trim() } catch {}
    if ($npmVersion) {
        Write-Host "  Latest npm version: morphyagent@${npmVersion}" -ForegroundColor DarkGray
    }

    Write-Down "Installing morphy..."

    # Capture first, THEN .Trim() — calling .Trim() on a null (offline npm) throws
    # under $ErrorActionPreference='Stop' and skips the friendly message below.
    $tarballUrl = ""
    try { $tarballUrl = (& $NPM view morphyagent dist.tarball 2>$null) } catch {}
    if ($tarballUrl) { $tarballUrl = $tarballUrl.Trim() }
    if (-not $tarballUrl) {
        Write-Host "  ✗  Failed to fetch package info from npm (are you online?)" -ForegroundColor Red
        exit 1
    }

    # Download and extract tarball
    $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("morphy-install-" + [guid]::NewGuid().ToString("N").Substring(0,8))
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $tarball = Join-Path $tmpDir "morphy.tgz"
        Get-Url $tarballUrl $tarball

        tar xzf $tarball -C $tmpDir

        $extracted = Join-Path $tmpDir "package"
        if (-not (Test-Path $extracted)) {
            Write-Host "  ✗  Installation failed" -ForegroundColor Red
            exit 1
        }

        New-Item -ItemType Directory -Path $MORPHY_HOME -Force | Out-Null

        # Copy code directories (always safe to overwrite)
        foreach ($dir in @("bin", "supervisor", "worker", "shared", "scripts")) {
            $src = Join-Path $extracted $dir
            if (Test-Path $src) {
                Copy-Item -Path $src -Destination $MORPHY_HOME -Recurse -Force
            }
        }

        # Copy workspace template only on first install (preserves user files)
        $wsDst = Join-Path $MORPHY_HOME "workspace"
        if (-not (Test-Path $wsDst)) {
            $wsSrc = Join-Path $extracted "workspace"
            if (Test-Path $wsSrc) {
                Copy-Item -Path $wsSrc -Destination $MORPHY_HOME -Recurse
            }
        }

        # Copy code files (never touches config.json, memory.db, etc.)
        foreach ($file in @("package.json", "vite.config.ts", "vite.chat.config.ts", "tsconfig.json", "postcss.config.js", "components.json")) {
            $src = Join-Path $extracted $file
            if (Test-Path $src) {
                Copy-Item -Path $src -Destination (Join-Path $MORPHY_HOME $file) -Force
            }
        }

        # Copy pre-built UI from tarball, or build from source
        $distSrc = Join-Path $extracted "dist-chat"
        $distDst = Join-Path $MORPHY_HOME "dist-chat"
        if (Test-Path $distSrc) {
            if (Test-Path $distDst) { Remove-Item $distDst -Recurse -Force }
            Copy-Item -Path $distSrc -Destination $distDst -Recurse
            Write-Check "Chat interface ready"
        } elseif (-not (Test-Path (Join-Path $distDst "onboard.html"))) {
            Write-Down "Building chat interface..."
            Push-Location $MORPHY_HOME
            try {
                & $NPM run build:chat 2>$null
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

    # Install dependencies inside ~/.morphy/
    # claude-agent-sdk 0.3.x moved @anthropic-ai/sdk + @modelcontextprotocol/sdk to
    # peerDependencies; an in-place upgrade of an existing ~/.morphy deadlocks npm's
    # resolver (ERESOLVE). Persist legacy-peer-deps so npm install resolves cleanly.
    $npmrc = Join-Path $MORPHY_HOME ".npmrc"
    if (-not ((Test-Path $npmrc) -and (Select-String -Path $npmrc -Pattern '^legacy-peer-deps' -Quiet))) {
        Add-Content -Path $npmrc -Value 'legacy-peer-deps=true'
    }
    # Toggle EAP to Continue around the native npm call so a stderr line doesn't
    # raise a NativeCommandError; then gate on the real exit code. A broken dep
    # tree is fatal here (matching install.sh) instead of being silently ignored.
    Push-Location $MORPHY_HOME
    $eap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    $npmOut = & $NPM install --omit=dev 2>&1
    $npmCode = $LASTEXITCODE
    $ErrorActionPreference = $eap
    Pop-Location
    if ($npmCode -ne 0) {
        Write-Host "  ✗  Dependency install failed:" -ForegroundColor Red
        $npmOut | ForEach-Object { Write-Host "     $_" }
        exit 1
    }

    # Install workspace dependencies (rebuilds native modules for this platform)
    $wsDir = Join-Path $MORPHY_HOME "workspace"
    if (Test-Path (Join-Path $wsDir "package.json")) {
        Write-Down "Installing workspace dependencies..."
        Push-Location $wsDir
        $eap = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $wsOut = & $NPM install --omit=dev 2>&1
        $wsCode = $LASTEXITCODE
        $ErrorActionPreference = $eap
        Pop-Location
        if ($wsCode -ne 0) {
            Write-Host "  ✗  Workspace dependency install failed:" -ForegroundColor Red
            if ("$wsOut" -match 'Visual Studio|gyp ERR|MSBuild|node-gyp|Python') {
                Write-Host "  !  Native build tools missing. Install the Visual Studio Build Tools (Desktop C++ workload) + Python 3, then re-run. See https://github.com/nodejs/node-gyp#on-windows" -ForegroundColor Yellow
            }
            $wsOut | ForEach-Object { Write-Host "     $_" }
            exit 1
        }
    }

    # Verify
    $cliPath = Join-Path $MORPHY_HOME "bin\cli.js"
    if (-not (Test-Path $cliPath)) {
        Write-Host "  ✗  Installation failed" -ForegroundColor Red
        exit 1
    }

    $script:VERSION = "unknown"
    try {
        $pkgJson = Get-Content (Join-Path $MORPHY_HOME "package.json") -Raw | ConvertFrom-Json
        $script:VERSION = $pkgJson.version
    } catch {}

    Write-Check "Morphy v${VERSION} installed"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

function Create-Wrapper {
    New-Item -ItemType Directory -Path $BIN_DIR -Force | Out-Null

    # Remove any existing wrapper
    $wrapperPath = Join-Path $BIN_DIR "morphy.cmd"
    Remove-Item $wrapperPath -Force -ErrorAction SilentlyContinue

    # Prefer the bundled Node (absolute path); fall back to a PATH node only if the
    # bundle is ever missing. Never a bare `node` as the primary — service PATHs vary.
    $wrapper = @"
@echo off
set "MN=%USERPROFILE%\.morphy\tools\node\node.exe"
if not exist "%MN%" set "MN=node"
"%MN%" "%USERPROFILE%\.morphy\bin\cli.js" %*
"@

    Set-Content -Path $wrapperPath -Value $wrapper -Encoding ASCII
    Write-Check "Created ~/.morphy/bin/morphy.cmd"
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

New-Item -ItemType Directory -Path $MORPHY_HOME -Force | Out-Null

Detect-Platform
# Always bundle a private Node so the launcher never depends on a system PATH — the
# old "use system node" path shipped a bare `node` wrapper that broke wherever node
# isn't on the service/daemon PATH.
Install-Node
Install-Morphy
Create-Wrapper
Setup-Path

# Smoke-test: the wrapper + node + cli must actually run, not just exist on disk.
$morphyCmd = Join-Path $BIN_DIR "morphy.cmd"
$smokeOk = $false
try { $smokeOk = [bool](& $morphyCmd --version 2>$null) } catch {}
if (-not $smokeOk) {
    Write-Host ""
    Write-Host "  ✗  Morphy installed but failed to run (morphy --version)." -ForegroundColor Red
    Write-Host "     Open a NEW terminal and run 'morphy --version'; if it still fails, re-run this installer." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
if ($vtSupported) {
    Write-Host "  ${PINK}${BOLD}✔  Morphy is installed!${RSET}"
} else {
    Write-Host "  ✔  Morphy is installed!" -ForegroundColor Magenta
}
Write-Host ""
if ($vtSupported) {
    Write-Host "  ${BLUE}${BOLD}╭───────────────────────────────────────────────────────╮${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}                                                       ${RSET}${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}${BOLD}   NEXT STEP  -  type this, then press Enter:${RSET}          ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}                                                       ${RSET}${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}${BLUE}${BOLD}       >  morphy init${RSET}                                   ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}                                                       ${RSET}${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}${DIM}   ─────────────────────────────────────────────────${RSET}   ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}                                                       ${RSET}${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}${YELLOW}${BOLD}   Not working?  (`"command not found`")${RSET}                 ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}   Just open a NEW terminal window and run${RSET}             ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}   morphy init  again.${RSET}                                  ${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}│${RSET}                                                       ${RSET}${BLUE}${BOLD}│${RSET}"
    Write-Host "  ${BLUE}${BOLD}╰───────────────────────────────────────────────────────╯${RSET}"
} else {
    Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |                                                       |" -ForegroundColor Cyan
    Write-Host "  |   NEXT STEP  -  type this, then press Enter:          |" -ForegroundColor Cyan
    Write-Host "  |                                                       |" -ForegroundColor Cyan
    Write-Host "  |       >  morphy init                                   |" -ForegroundColor Cyan
    Write-Host "  |                                                       |" -ForegroundColor Cyan
    Write-Host "  |   Not working?  (`"command not found`")                 |" -ForegroundColor Cyan
    Write-Host "  |   Just open a NEW terminal window and run             |" -ForegroundColor Cyan
    Write-Host "  |   morphy init  again.                                  |" -ForegroundColor Cyan
    Write-Host "  |                                                       |" -ForegroundColor Cyan
    Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
}
Write-Host ""
if ($vtSupported) {
    Write-Host "  ${DIM}Other commands:${RSET}"
    Write-Host "    ${BLUE}morphy start${RSET}     Start your bot"
    Write-Host "    ${BLUE}morphy status${RSET}    Check if it's running"
    Write-Host "    ${BLUE}morphy help${RSET}      All commands"
} else {
    Write-Host "  Other commands:" -ForegroundColor DarkGray
    Write-Host "    morphy start     " -ForegroundColor Cyan -NoNewline; Write-Host "Start your bot"
    Write-Host "    morphy status    " -ForegroundColor Cyan -NoNewline; Write-Host "Check if it's running"
    Write-Host "    morphy help      " -ForegroundColor Cyan -NoNewline; Write-Host "All commands"
}
Write-Host ""
Write-Host "  https://morphyagent.com" -ForegroundColor DarkGray
Write-Host ""
