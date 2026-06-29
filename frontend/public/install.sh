#!/bin/sh
set -e

# ─── Morphy Installer ────────────────────────────────────────────────────────
# curl -fsSL https://morphyagent.com/install | sh
#
# Downloads Node.js + Morphy into ~/.morphy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

# Repair $HOME before deriving any install path. Under `sudo`, cron, CI, or a
# minimal shell, $HOME can be empty or "/" — without this we'd install into the
# wrong place (or /). Colors aren't defined yet, so this early error is plain.
if [ -z "${HOME:-}" ] || [ ! -d "${HOME:-}" ]; then
  _whoami=$(id -un 2>/dev/null || echo "")
  if [ -n "$_whoami" ] && command -v getent >/dev/null 2>&1; then
    HOME=$(getent passwd "$_whoami" 2>/dev/null | cut -d: -f6)
  elif [ -n "$_whoami" ] && command -v dscl >/dev/null 2>&1; then
    HOME=$(dscl . -read "/Users/$_whoami" NFSHomeDirectory 2>/dev/null | awk '{print $2}')
  fi
  export HOME
fi
if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then
  printf 'Error: could not determine your home directory ($HOME is unset).\n' >&2
  exit 1
fi

MIN_NODE_MAJOR=18
NODE_VERSION="22.14.0"
MORPHY_HOME="$HOME/.morphy"
TOOLS_DIR="$MORPHY_HOME/tools"
NODE_DIR="$TOOLS_DIR/node"
BIN_DIR="$MORPHY_HOME/bin"
USE_SYSTEM_NODE=false
LIBC=""
# Temp paths the cleanup trap removes — kept empty until we own them so an early
# exit can never `rm -rf` an inherited value (e.g. the system $TMPDIR).
WORK_DIR=""
TMPFILE=""

# Brand colors: #00ADFE (light) and #0158FB (deep) -- Morphy palette, 24-bit truecolor
BLUE='\033[38;2;0;173;254m'
PINK='\033[38;2;1;88;251m'
# Logo gradient: #00ADFE (top) -> #0158FB (bottom)
G1='\033[38;2;0;173;254m'
G2='\033[38;2;0;159;254m'
G3='\033[38;2;0;145;253m'
G4='\033[38;2;1;131;253m'
G5='\033[38;2;1;116;252m'
G6='\033[38;2;1;102;251m'
G7='\033[38;2;1;88;251m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# Disable colors if not a terminal
if [ ! -t 1 ]; then
  BLUE='' PINK='' YELLOW='' RED='' DIM='' BOLD='' RESET='' G1='' G2='' G3='' G4='' G5='' G6='' G7=''
fi

# Cleanup on exit (restore cursor, reset colors, remove temp files).
# Only remove paths we actually created — never an inherited/unset value.
cleanup() {
  printf '\033[?25h'  # show cursor
  printf "${RESET}"
  [ -n "$TMPFILE" ] && rm -f "$TMPFILE" 2>/dev/null
  [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR" 2>/dev/null
  return 0
}
trap cleanup EXIT INT TERM

# ─── Download + integrity helpers ───────────────────────────────────────────

# download_file <url> <dest> — curl/wget with HTTPS floor, timeout, and retry.
download_file() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --proto '=https' --tlsv1.2 --connect-timeout 20 --retry 3 --retry-delay 2 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --https-only --tries=3 --timeout=20 -O "$2" "$1"
  else
    printf "  ${RED}✗${RESET}  curl or wget is required to install Morphy\n"
    exit 1
  fi
}

# verify_sha256 <file> <expected-hex> — 0 match, 1 mismatch, 2 no tool available.
verify_sha256() {
  _actual=""
  if command -v sha256sum >/dev/null 2>&1; then
    _actual=$(sha256sum "$1" 2>/dev/null | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    _actual=$(shasum -a 256 "$1" 2>/dev/null | awk '{print $1}')
  else
    return 2
  fi
  # No hash computed (tool failed / file vanished) → "skip" (2), not "mismatch" (1),
  # so we warn rather than aborting with a misleading "tampered download".
  [ -n "$_actual" ] || return 2
  [ "$_actual" = "$2" ]
}

printf "\n"
printf "${G1}${BOLD}                                █▄         ${RESET}\n"
printf "${G2}${BOLD}      ▄              ▄          ██         ${RESET}\n"
printf "${G3}${BOLD}      ███▄███▄ ▄███▄ ████▄████▄ ████▄ ██ ██${RESET}\n"
printf "${G4}${BOLD}      ██ ██ ██ ██ ██ ██   ██ ██ ██ ██ ██▄██${RESET}\n"
printf "${G5}${BOLD}     ▄██ ██ ▀█▄▀███▀▄█▀  ▄████▀▄██ ██▄▄▀██▀${RESET}\n"
printf "${G6}${BOLD}                          ██            ██ ${RESET}\n"
printf "${G7}${BOLD}                          ▀           ▀▀▀  ${RESET}\n"
printf "\n"
printf "${DIM}     Self-hosted, self-evolving AI agent with its own dashboard.${RESET}\n"
printf "${DIM}     ─────────────────────────────${RESET}\n\n"

# ─── Detect platform ────────────────────────────────────────────────────────

detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    linux)  PLATFORM="linux" ;;
    darwin) PLATFORM="darwin" ;;
    *)
      printf "  ${RED}✗${RESET}  Unsupported OS: $OS\n"
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64)          NODEARCH="x64" ;;
    aarch64|arm64)   NODEARCH="arm64" ;;
    armv7l|armv6l)   NODEARCH="armv7l" ;;
    *)
      printf "  ${RED}✗${RESET}  Unsupported architecture: $ARCH\n"
      exit 1
      ;;
  esac

  # Detect musl (Alpine): nodejs.org ships glibc builds only, so a bundled Node
  # would segfault at runtime. Flag it now and require a system Node instead.
  if [ "$PLATFORM" = "linux" ]; then
    if [ -f /etc/alpine-release ] || (ldd --version 2>&1 | grep -qi musl); then
      LIBC="musl"
    fi
  fi

  printf "  ${DIM}Platform: ${PLATFORM}/${NODEARCH}${RESET}\n"
}

# ─── Check for system Node.js ─────────────────────────────────────────────

check_system_node() {
  if command -v node >/dev/null 2>&1; then
    SYS_NODE_VERSION=$(node -v 2>/dev/null || echo "")
    if [ -n "$SYS_NODE_VERSION" ]; then
      MAJOR=$(echo "$SYS_NODE_VERSION" | sed 's/^v//' | cut -d. -f1)
      if [ "$MAJOR" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
        USE_SYSTEM_NODE=true
        printf "  ${BLUE}✔${RESET}  Node.js ${SYS_NODE_VERSION} (system)\n"
        return 0
      fi
    fi
  fi
  return 1
}

# ─── Download Node.js ───────────────────────────────────────────────────────

install_node() {
  # Check if we already have a bundled node that works
  if [ -x "$NODE_DIR/bin/node" ]; then
    EXISTING=$("$NODE_DIR/bin/node" -v 2>/dev/null || echo "")
    if [ -n "$EXISTING" ]; then
      printf "  ${BLUE}✔${RESET}  Node.js ${EXISTING} (bundled)\n"
      return 0
    fi
  fi

  # nodejs.org ships glibc-linked builds; on musl they segfault at runtime.
  if [ "$LIBC" = "musl" ]; then
    printf "  ${RED}✗${RESET}  Alpine/musl detected — Morphy's bundled Node.js requires glibc.\n"
    printf "  ${DIM}Install Node.js >= ${MIN_NODE_MAJOR} (e.g. ${BOLD}apk add nodejs npm${RESET}${DIM}) and re-run this installer.${RESET}\n"
    exit 1
  fi

  printf "  ${BLUE}↓${RESET}  Downloading Node.js v${NODE_VERSION}...\n"

  NODE_FILE="node-v${NODE_VERSION}-${PLATFORM}-${NODEARCH}.tar.xz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_FILE}"
  # Trailing X's, NO suffix: BSD mktemp (macOS) only substitutes trailing X's,
  # so a ".tar.xz" suffix would create a literal, predictable, non-unique file.
  TMPFILE=$(mktemp "${TMPDIR:-/tmp}/morphy-node-XXXXXX")
  download_file "$NODE_URL" "$TMPFILE"

  # Integrity: verify against nodejs.org SHASUMS256.txt before extracting. A
  # mismatch is fatal; an unreachable sums file or missing hash tool degrades to
  # a warning so installs still proceed (the download itself is TLS-protected).
  printf "  ${DIM}Verifying download...${RESET}\n"
  EXPECTED_SHA=""
  SUMS=$(curl -fsSL --proto '=https' --tlsv1.2 --connect-timeout 20 "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" 2>/dev/null \
    || wget -q --https-only --timeout=20 -O- "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" 2>/dev/null \
    || echo "")
  if [ -n "$SUMS" ]; then
    EXPECTED_SHA=$(printf '%s\n' "$SUMS" | awk -v f="$NODE_FILE" '$2==f {print $1; exit}')
  fi
  if [ -n "$EXPECTED_SHA" ]; then
    vrc=0
    verify_sha256 "$TMPFILE" "$EXPECTED_SHA" || vrc=$?
    if [ "$vrc" = "0" ]; then
      printf "  ${BLUE}✔${RESET}  Checksum verified\n"
    elif [ "$vrc" = "2" ]; then
      printf "  ${YELLOW}!${RESET}  Could not compute checksum — skipping verification\n"
    else
      printf "  ${RED}✗${RESET}  Node.js checksum mismatch — aborting (corrupt or tampered download)\n"
      exit 1
    fi
  else
    printf "  ${YELLOW}!${RESET}  Could not fetch checksums — skipping verification\n"
  fi

  # Extract into a staging dir, verify it runs, then atomically swap in. An
  # interrupt mid-extract no longer wipes the existing (working) node.
  mkdir -p "$TOOLS_DIR"
  NODE_NEW="$NODE_DIR.new"
  rm -rf "$NODE_NEW"
  mkdir -p "$NODE_NEW"
  tar xf "$TMPFILE" -C "$NODE_NEW" --strip-components=1
  rm -f "$TMPFILE"; TMPFILE=""

  if ! "$NODE_NEW/bin/node" -v >/dev/null 2>&1; then
    printf "  ${RED}✗${RESET}  Node.js download failed (extracted binary does not run)\n"
    rm -rf "$NODE_NEW"
    exit 1
  fi

  rm -rf "$NODE_DIR.old"
  [ -e "$NODE_DIR" ] && mv "$NODE_DIR" "$NODE_DIR.old"
  mv "$NODE_NEW" "$NODE_DIR"
  rm -rf "$NODE_DIR.old"

  printf "  ${BLUE}✔${RESET}  Node.js v${NODE_VERSION} installed\n"
}

# ─── Install Morphy ────────────────────────────────────────────────────────

install_morphy() {
  if [ "$USE_SYSTEM_NODE" = true ]; then
    NPM="npm"
    NODE="node"
  else
    # Add bundled node to PATH so npm's "#!/usr/bin/env node" shebang works
    export PATH="$NODE_DIR/bin:$PATH"
    NPM="$NODE_DIR/bin/npm"
    NODE="$NODE_DIR/bin/node"
  fi

  # Fetch version + tarball URL from npm registry
  NPM_VERSION=$("$NPM" view morphyagent version 2>/dev/null || echo "")
  if [ -n "$NPM_VERSION" ]; then
    printf "  ${DIM}Latest npm version: morphyagent@${NPM_VERSION}${RESET}\n"
  fi

  printf "  ${BLUE}↓${RESET}  Installing morphy...\n"

  TARBALL_URL=$("$NPM" view morphyagent dist.tarball 2>/dev/null || echo "")
  if [ -z "$TARBALL_URL" ]; then
    printf "  ${RED}✗${RESET}  Failed to fetch package info from npm\n"
    exit 1
  fi

  # Download and extract tarball (download_file guards on missing curl/wget)
  WORK_DIR=$(mktemp -d)
  download_file "$TARBALL_URL" "$WORK_DIR/morphy.tgz"

  tar xzf "$WORK_DIR/morphy.tgz" -C "$WORK_DIR"
  EXTRACTED="$WORK_DIR/package"

  if [ ! -d "$EXTRACTED" ]; then
    rm -rf "$WORK_DIR"; WORK_DIR=""
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  # Copy code directories (always safe to overwrite)
  for dir in bin supervisor worker shared scripts; do
    [ -d "$EXTRACTED/$dir" ] && cp -r "$EXTRACTED/$dir" "$MORPHY_HOME/"
  done

  # Copy workspace template only on first install (preserves user files)
  if [ ! -d "$MORPHY_HOME/workspace" ]; then
    [ -d "$EXTRACTED/workspace" ] && cp -r "$EXTRACTED/workspace" "$MORPHY_HOME/"
  fi

  # Copy code files (never touches config.json, memory.db, etc.)
  for f in package.json vite.config.ts vite.chat.config.ts tsconfig.json postcss.config.js components.json; do
    [ -f "$EXTRACTED/$f" ] && cp "$EXTRACTED/$f" "$MORPHY_HOME/"
  done

  # Copy pre-built UI from tarball, or build from source
  if [ -d "$EXTRACTED/dist-chat" ]; then
    rm -rf "$MORPHY_HOME/dist-chat"
    cp -r "$EXTRACTED/dist-chat" "$MORPHY_HOME/"
  elif [ ! -f "$MORPHY_HOME/dist-chat/onboard.html" ]; then
    printf "  ${BLUE}↓${RESET}  Building chat interface...\n"
    if (cd "$MORPHY_HOME" && "$NPM" run build:chat 2>/dev/null); then
      printf "  ${BLUE}✔${RESET}  Chat interface built\n"
    else
      printf "  ${YELLOW}!${RESET}  Chat build skipped — will build on first start\n"
    fi
  fi

  rm -rf "$WORK_DIR"; WORK_DIR=""

  # Install dependencies inside ~/.morphy/
  # claude-agent-sdk 0.3.x moved @anthropic-ai/sdk + @modelcontextprotocol/sdk to
  # peerDependencies; an in-place upgrade of an existing ~/.morphy deadlocks npm's
  # resolver (ERESOLVE). Persist legacy-peer-deps so npm install resolves cleanly.
  grep -qs '^legacy-peer-deps' "$MORPHY_HOME/.npmrc" 2>/dev/null || printf 'legacy-peer-deps=true\n' >> "$MORPHY_HOME/.npmrc"
  printf "  ${BLUE}↓${RESET}  Installing dependencies...\n"
  INSTALL_LOG=$(mktemp)
  if ! (cd "$MORPHY_HOME" && "$NPM" install --omit=dev > "$INSTALL_LOG" 2>&1); then
    printf "  ${RED}✗${RESET}  Dependency install failed:\n"
    cat "$INSTALL_LOG"
    rm -f "$INSTALL_LOG"
    exit 1
  fi
  rm -f "$INSTALL_LOG"

  # Install workspace dependencies (rebuilds native modules for this platform —
  # workspace/node_modules is intentionally not shipped in the tarball so that
  # better-sqlite3 etc. get a prebuild matching the target OS+arch, not the
  # publisher's machine)
  if [ -f "$MORPHY_HOME/workspace/package.json" ]; then
    printf "  ${BLUE}↓${RESET}  Installing workspace dependencies...\n"
    WS_INSTALL_LOG=$(mktemp)
    if ! (cd "$MORPHY_HOME/workspace" && "$NPM" install --omit=dev > "$WS_INSTALL_LOG" 2>&1); then
      printf "  ${RED}✗${RESET}  Workspace dependency install failed:\n"
      # Native modules (better-sqlite3 etc.) need a compiler toolchain — detect
      # the common "missing build tools" failure and point at the exact fix.
      if grep -qiE 'make: .*command not found|gyp ERR! find Python|no developer tools|xcode-select|command not found: make|g\+\+: not found' "$WS_INSTALL_LOG"; then
        if [ "$PLATFORM" = "darwin" ]; then
          printf "  ${YELLOW}!${RESET}  Native build tools missing. Run ${BOLD}xcode-select --install${RESET} then re-run this installer.\n"
        else
          printf "  ${YELLOW}!${RESET}  Native build tools missing. On Debian/Ubuntu: ${BOLD}sudo apt-get install -y build-essential python3${RESET}, then re-run.\n"
        fi
      fi
      cat "$WS_INSTALL_LOG"
      rm -f "$WS_INSTALL_LOG"
      exit 1
    fi
    rm -f "$WS_INSTALL_LOG"
  fi

  # Verify
  if [ ! -f "$MORPHY_HOME/bin/cli.js" ]; then
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  VERSION=$("$NODE" -e "const p=JSON.parse(require('fs').readFileSync('$MORPHY_HOME/package.json','utf8'));console.log(p.version)" 2>/dev/null || echo "unknown")

  printf "  ${BLUE}✔${RESET}  Morphy v${VERSION} installed\n"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

create_wrapper() {
  mkdir -p "$BIN_DIR"

  # Remove any existing wrapper/symlink
  rm -f "$BIN_DIR/morphy"

  if [ "$USE_SYSTEM_NODE" = true ]; then
    cat > "$BIN_DIR/morphy" << 'WRAPPER'
#!/bin/sh
CLI="$HOME/.morphy/bin/cli.js"
exec node "$CLI" "$@"
WRAPPER
  else
    cat > "$BIN_DIR/morphy" << 'WRAPPER'
#!/bin/sh
MORPHY_HOME="$HOME/.morphy"
NODE="$MORPHY_HOME/tools/node/bin/node"
CLI="$MORPHY_HOME/bin/cli.js"
exec "$NODE" "$CLI" "$@"
WRAPPER
  fi

  chmod +x "$BIN_DIR/morphy"
  printf "  ${BLUE}✔${RESET}  Created ${DIM}~/.morphy/bin/morphy${RESET}\n"
}

# ─── Add to PATH ────────────────────────────────────────────────────────────

setup_path() {
  SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")
  EXPORT_LINE='export PATH="$HOME/.morphy/bin:$PATH"'
  ALREADY_IN_PATH=false

  case ":$PATH:" in
    *":$BIN_DIR:"*) ALREADY_IN_PATH=true ;;
  esac

  if [ "$ALREADY_IN_PATH" = true ]; then
    return 0
  fi

  # Add to shell profile
  PROFILE=""
  case "$SHELL_NAME" in
    zsh)  PROFILE="$HOME/.zshrc" ;;
    bash)
      if [ -f "$HOME/.bash_profile" ]; then
        PROFILE="$HOME/.bash_profile"
      else
        PROFILE="$HOME/.bashrc"
      fi
      ;;
    fish)
      mkdir -p "$HOME/.config/fish"
      if ! grep -q "morphy/bin" "$HOME/.config/fish/config.fish" 2>/dev/null; then
        echo 'set -gx PATH "$HOME/.morphy/bin" $PATH' >> "$HOME/.config/fish/config.fish"
      fi
      printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(~/.config/fish/config.fish)${RESET}\n"
      return 0
      ;;
    *)    PROFILE="$HOME/.profile" ;;
  esac

  if [ -n "$PROFILE" ]; then
    if ! grep -q "morphy/bin" "$PROFILE" 2>/dev/null; then
      printf "\n# Morphy\n%s\n" "$EXPORT_LINE" >> "$PROFILE"
    fi
    printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(${PROFILE})${RESET}\n"
  fi

  export PATH="$BIN_DIR:$PATH"
}

# ─── Main ────────────────────────────────────────────────────────────────────

mkdir -p "$MORPHY_HOME"

detect_platform
check_system_node || install_node
install_morphy
create_wrapper
setup_path

# Smoke-test: the wrapper + node + cli must actually run, not just exist on disk.
if ! "$BIN_DIR/morphy" --version >/dev/null 2>&1; then
  printf "\n  ${RED}✗${RESET}  Morphy installed but failed to run (\`morphy --version\`).\n"
  printf "  ${DIM}Open a NEW terminal and run ${BOLD}morphy --version${RESET}${DIM}; if it still fails, re-run this installer.${RESET}\n\n"
  exit 1
fi

printf "\n"
printf "  ${PINK}${BOLD}✔  Morphy is installed!${RESET}\n"
printf "\n"
printf "  ${BLUE}${BOLD}╭───────────────────────────────────────────────────────╮${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}                                                       ${RESET}${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}${BOLD}   NEXT STEP  -  type this, then press Enter:${RESET}          ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}                                                       ${RESET}${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}${BLUE}${BOLD}       >  morphy init${RESET}                                   ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}                                                       ${RESET}${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}${DIM}   ─────────────────────────────────────────────────${RESET}   ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}                                                       ${RESET}${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}${YELLOW}${BOLD}   Not working?  (\"command not found\")${RESET}                 ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}   Just open a NEW terminal window and run${RESET}             ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}   morphy init  again.${RESET}                                  ${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}│${RESET}                                                       ${RESET}${BLUE}${BOLD}│${RESET}\n"
printf "  ${BLUE}${BOLD}╰───────────────────────────────────────────────────────╯${RESET}\n"
printf "\n"
printf "  ${DIM}Other commands:${RESET}\n"
printf "    ${BLUE}morphy start${RESET}     Start your bot\n"
printf "    ${BLUE}morphy status${RESET}    Check if it's running\n"
printf "    ${BLUE}morphy help${RESET}      All commands\n"
printf "\n"
printf "  ${DIM}https://morphyagent.com${RESET}\n"
printf "\n"
