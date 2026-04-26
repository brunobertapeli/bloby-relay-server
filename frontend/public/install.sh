#!/bin/sh
set -e

# ─── Bloby Installer ────────────────────────────────────────────────────────
# curl -fsSL https://bloby.bot/install | sh
#
# Downloads Node.js + Bloby into ~/.bloby — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

MIN_NODE_MAJOR=18
NODE_VERSION="22.14.0"
BLOBY_HOME="$HOME/.bloby"
TOOLS_DIR="$BLOBY_HOME/tools"
NODE_DIR="$TOOLS_DIR/node"
BIN_DIR="$BLOBY_HOME/bin"
USE_SYSTEM_NODE=false

# Brand colors: #32A5F7 (blue) and #DB36A3 (pink) via 256-color approximation
BLUE='\033[38;2;50;165;247m'
PINK='\033[38;2;219;54;163m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

printf "\n"
printf "${BLUE}${BOLD}      _______ _                    ${RESET}\n"
printf "${BLUE}${BOLD}     (_______) |                   ${RESET}\n"
printf "${BLUE}${BOLD}      _____  | |_   _ _   _ _   _  ${RESET}\n"
printf "${BLUE}${BOLD}     |  ___) | | | | ( \\ / ) | | | ${RESET}\n"
printf "${PINK}${BOLD}     | |     | | |_| |) X (| |_| | ${RESET}\n"
printf "${PINK}${BOLD}     |_|     |_|\\____(_/ \\_)\\__  | ${RESET}\n"
printf "${PINK}${BOLD}                           (____/   ${RESET}\n"
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

  printf "  ${BLUE}↓${RESET}  Downloading Node.js v${NODE_VERSION}...\n"

  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${PLATFORM}-${NODEARCH}.tar.xz"
  TMPFILE=$(mktemp /tmp/node-XXXXXX.tar.xz)

  # Download
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$TMPFILE" "$NODE_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMPFILE" "$NODE_URL"
  else
    printf "  ${RED}✗${RESET}  curl or wget required\n"
    exit 1
  fi

  # Extract
  mkdir -p "$TOOLS_DIR"
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"

  tar xf "$TMPFILE" -C "$NODE_DIR" --strip-components=1
  rm -f "$TMPFILE"

  # Verify
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    printf "  ${RED}✗${RESET}  Node.js download failed\n"
    exit 1
  fi

  printf "  ${BLUE}✔${RESET}  Node.js v${NODE_VERSION} installed\n"
}

# ─── Install Bloby ────────────────────────────────────────────────────────

install_bloby() {
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
  NPM_VERSION=$("$NPM" view bloby-bot version 2>/dev/null || echo "")
  if [ -n "$NPM_VERSION" ]; then
    printf "  ${DIM}Latest npm version: bloby-bot@${NPM_VERSION}${RESET}\n"
  fi

  printf "  ${BLUE}↓${RESET}  Installing bloby...\n"

  TARBALL_URL=$("$NPM" view bloby-bot dist.tarball 2>/dev/null)
  if [ -z "$TARBALL_URL" ]; then
    printf "  ${RED}✗${RESET}  Failed to fetch package info from npm\n"
    exit 1
  fi

  # Download and extract tarball
  TMPDIR=$(mktemp -d)
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$TMPDIR/bloby.tgz" "$TARBALL_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMPDIR/bloby.tgz" "$TARBALL_URL"
  fi

  tar xzf "$TMPDIR/bloby.tgz" -C "$TMPDIR"
  EXTRACTED="$TMPDIR/package"

  if [ ! -d "$EXTRACTED" ]; then
    rm -rf "$TMPDIR"
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  # Copy code directories (always safe to overwrite)
  for dir in bin supervisor worker shared scripts; do
    [ -d "$EXTRACTED/$dir" ] && cp -r "$EXTRACTED/$dir" "$BLOBY_HOME/"
  done

  # Copy workspace template only on first install (preserves user files)
  if [ ! -d "$BLOBY_HOME/workspace" ]; then
    [ -d "$EXTRACTED/workspace" ] && cp -r "$EXTRACTED/workspace" "$BLOBY_HOME/"
  fi

  # Copy code files (never touches config.json, memory.db, etc.)
  for f in package.json vite.config.ts vite.bloby.config.ts tsconfig.json postcss.config.js components.json; do
    [ -f "$EXTRACTED/$f" ] && cp "$EXTRACTED/$f" "$BLOBY_HOME/"
  done

  # Copy pre-built UI from tarball, or build from source
  if [ -d "$EXTRACTED/dist-bloby" ]; then
    rm -rf "$BLOBY_HOME/dist-bloby"
    cp -r "$EXTRACTED/dist-bloby" "$BLOBY_HOME/"
  elif [ ! -f "$BLOBY_HOME/dist-bloby/onboard.html" ]; then
    printf "  ${BLUE}↓${RESET}  Building chat interface...\n"
    if (cd "$BLOBY_HOME" && "$NPM" run build:bloby 2>/dev/null); then
      printf "  ${BLUE}✔${RESET}  Chat interface built\n"
    else
      printf "  ${YELLOW}!${RESET}  Chat build skipped — will build on first start\n"
    fi
  fi

  rm -rf "$TMPDIR"

  # Install dependencies inside ~/.bloby/
  printf "  ${BLUE}↓${RESET}  Installing dependencies...\n"
  INSTALL_LOG=$(mktemp)
  if ! (cd "$BLOBY_HOME" && "$NPM" install --omit=dev > "$INSTALL_LOG" 2>&1); then
    printf "  ${RED}✗${RESET}  Dependency install failed:\n"
    cat "$INSTALL_LOG"
    rm -f "$INSTALL_LOG"
    exit 1
  fi
  rm -f "$INSTALL_LOG"

  # Install workspace dependencies (rebuilds native modules for this platform —
  # workspace/node_modules is intentionally not shipped in the tarball so that
  # native deps like better-sqlite3 get a prebuild matching the target OS+arch)
  if [ -f "$BLOBY_HOME/workspace/package.json" ]; then
    printf "  ${BLUE}↓${RESET}  Installing workspace dependencies...\n"
    WS_INSTALL_LOG=$(mktemp)
    if ! (cd "$BLOBY_HOME/workspace" && "$NPM" install --omit=dev > "$WS_INSTALL_LOG" 2>&1); then
      printf "  ${RED}✗${RESET}  Workspace dependency install failed:\n"
      cat "$WS_INSTALL_LOG"
      rm -f "$WS_INSTALL_LOG"
      exit 1
    fi
    rm -f "$WS_INSTALL_LOG"
  fi

  # Verify
  if [ ! -f "$BLOBY_HOME/bin/cli.js" ]; then
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  VERSION=$("$NODE" -e "const p=JSON.parse(require('fs').readFileSync('$BLOBY_HOME/package.json','utf8'));console.log(p.version)" 2>/dev/null || echo "unknown")

  printf "  ${BLUE}✔${RESET}  Bloby v${VERSION} installed\n"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

create_wrapper() {
  mkdir -p "$BIN_DIR"

  # Remove any existing wrapper/symlink
  rm -f "$BIN_DIR/bloby"

  if [ "$USE_SYSTEM_NODE" = true ]; then
    cat > "$BIN_DIR/bloby" << 'WRAPPER'
#!/bin/sh
CLI="$HOME/.bloby/bin/cli.js"
exec node "$CLI" "$@"
WRAPPER
  else
    cat > "$BIN_DIR/bloby" << 'WRAPPER'
#!/bin/sh
BLOBY_HOME="$HOME/.bloby"
NODE="$BLOBY_HOME/tools/node/bin/node"
CLI="$BLOBY_HOME/bin/cli.js"
exec "$NODE" "$CLI" "$@"
WRAPPER
  fi

  chmod +x "$BIN_DIR/bloby"
  printf "  ${BLUE}✔${RESET}  Created ${DIM}~/.bloby/bin/bloby${RESET}\n"
}

# ─── Add to PATH ────────────────────────────────────────────────────────────

setup_path() {
  SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")
  EXPORT_LINE='export PATH="$HOME/.bloby/bin:$PATH"'
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
      if ! grep -q "bloby/bin" "$HOME/.config/fish/config.fish" 2>/dev/null; then
        echo 'set -gx PATH "$HOME/.bloby/bin" $PATH' >> "$HOME/.config/fish/config.fish"
      fi
      printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(~/.config/fish/config.fish)${RESET}\n"
      return 0
      ;;
    *)    PROFILE="$HOME/.profile" ;;
  esac

  if [ -n "$PROFILE" ]; then
    if ! grep -q "bloby/bin" "$PROFILE" 2>/dev/null; then
      printf "\n# Bloby\n%s\n" "$EXPORT_LINE" >> "$PROFILE"
    fi
    printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(${PROFILE})${RESET}\n"
  fi

  export PATH="$BIN_DIR:$PATH"
}

# ─── Main ────────────────────────────────────────────────────────────────────

mkdir -p "$BLOBY_HOME"

detect_platform
check_system_node || install_node
install_bloby
create_wrapper
setup_path

printf "\n"
printf "  ${PINK}${BOLD}✔  Bloby is ready!${RESET}\n"
printf "\n"
printf "  ${DIM}─────────────────────────────${RESET}\n"
printf "  ${BOLD}Get started:${RESET}\n"
printf "\n"
printf "    ${BLUE}bloby init${RESET}      Set up your bot\n"
printf "    ${BLUE}bloby start${RESET}     Start your bot\n"
printf "    ${BLUE}bloby status${RESET}    Check if it's running\n"
printf "\n"
printf "  ${PINK}>${RESET} Run ${BLUE}bloby init${RESET} to begin.\n"
printf "  ${DIM}(Open a new terminal if 'bloby' isn't found yet)${RESET}\n"
printf "\n"
printf "  ${DIM}https://bloby.bot${RESET}\n"
printf "\n"
