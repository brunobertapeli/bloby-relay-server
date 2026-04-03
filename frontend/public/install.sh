#!/bin/sh
set -e

# ─── Fluxy Installer ────────────────────────────────────────────────────────
# curl -fsSL https://fluxy.bot/install | sh
#
# Downloads Node.js + Fluxy into ~/.fluxy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

MIN_NODE_MAJOR=18
NODE_VERSION="22.14.0"
FLUXY_HOME="$HOME/.fluxy"
TOOLS_DIR="$FLUXY_HOME/tools"
NODE_DIR="$TOOLS_DIR/node"
BIN_DIR="$FLUXY_HOME/bin"
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

# ─── Install Fluxy ────────────────────────────────────────────────────────

install_fluxy() {
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
  NPM_VERSION=$("$NPM" view fluxy-bot version 2>/dev/null || echo "")
  if [ -n "$NPM_VERSION" ]; then
    printf "  ${DIM}Latest npm version: fluxy-bot@${NPM_VERSION}${RESET}\n"
  fi

  printf "  ${BLUE}↓${RESET}  Installing fluxy...\n"

  TARBALL_URL=$("$NPM" view fluxy-bot dist.tarball 2>/dev/null)
  if [ -z "$TARBALL_URL" ]; then
    printf "  ${RED}✗${RESET}  Failed to fetch package info from npm\n"
    exit 1
  fi

  # Download and extract tarball
  TMPDIR=$(mktemp -d)
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$TMPDIR/fluxy.tgz" "$TARBALL_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMPDIR/fluxy.tgz" "$TARBALL_URL"
  fi

  tar xzf "$TMPDIR/fluxy.tgz" -C "$TMPDIR"
  EXTRACTED="$TMPDIR/package"

  if [ ! -d "$EXTRACTED" ]; then
    rm -rf "$TMPDIR"
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  # Copy code directories (always safe to overwrite)
  for dir in bin supervisor worker shared scripts; do
    [ -d "$EXTRACTED/$dir" ] && cp -r "$EXTRACTED/$dir" "$FLUXY_HOME/"
  done

  # Copy workspace template only on first install (preserves user files)
  if [ ! -d "$FLUXY_HOME/workspace" ]; then
    [ -d "$EXTRACTED/workspace" ] && cp -r "$EXTRACTED/workspace" "$FLUXY_HOME/"
  fi

  # Copy code files (never touches config.json, memory.db, etc.)
  for f in package.json vite.config.ts vite.fluxy.config.ts tsconfig.json postcss.config.js components.json; do
    [ -f "$EXTRACTED/$f" ] && cp "$EXTRACTED/$f" "$FLUXY_HOME/"
  done

  # Copy pre-built UI from tarball, or build from source
  if [ -d "$EXTRACTED/dist-fluxy" ]; then
    rm -rf "$FLUXY_HOME/dist-fluxy"
    cp -r "$EXTRACTED/dist-fluxy" "$FLUXY_HOME/"
  elif [ ! -f "$FLUXY_HOME/dist-fluxy/onboard.html" ]; then
    printf "  ${BLUE}↓${RESET}  Building chat interface...\n"
    if (cd "$FLUXY_HOME" && "$NPM" run build:fluxy 2>/dev/null); then
      printf "  ${BLUE}✔${RESET}  Chat interface built\n"
    else
      printf "  ${YELLOW}!${RESET}  Chat build skipped — will build on first start\n"
    fi
  fi

  rm -rf "$TMPDIR"

  # Install dependencies inside ~/.fluxy/
  printf "  ${BLUE}↓${RESET}  Installing dependencies...\n"
  (cd "$FLUXY_HOME" && "$NPM" install --omit=dev 2>/dev/null)

  # Install workspace dependencies (rebuilds native modules for this platform)
  if [ -f "$FLUXY_HOME/workspace/package.json" ]; then
    printf "  ${BLUE}↓${RESET}  Installing workspace dependencies...\n"
    (cd "$FLUXY_HOME/workspace" && "$NPM" install --omit=dev 2>/dev/null)
  fi

  # Verify
  if [ ! -f "$FLUXY_HOME/bin/cli.js" ]; then
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  VERSION=$("$NODE" -e "const p=JSON.parse(require('fs').readFileSync('$FLUXY_HOME/package.json','utf8'));console.log(p.version)" 2>/dev/null || echo "unknown")

  printf "  ${BLUE}✔${RESET}  Fluxy v${VERSION} installed\n"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

create_wrapper() {
  mkdir -p "$BIN_DIR"

  # Remove any existing wrapper/symlink
  rm -f "$BIN_DIR/fluxy"

  if [ "$USE_SYSTEM_NODE" = true ]; then
    cat > "$BIN_DIR/fluxy" << 'WRAPPER'
#!/bin/sh
CLI="$HOME/.fluxy/bin/cli.js"
exec node "$CLI" "$@"
WRAPPER
  else
    cat > "$BIN_DIR/fluxy" << 'WRAPPER'
#!/bin/sh
FLUXY_HOME="$HOME/.fluxy"
NODE="$FLUXY_HOME/tools/node/bin/node"
CLI="$FLUXY_HOME/bin/cli.js"
exec "$NODE" "$CLI" "$@"
WRAPPER
  fi

  chmod +x "$BIN_DIR/fluxy"
  printf "  ${BLUE}✔${RESET}  Created ${DIM}~/.fluxy/bin/fluxy${RESET}\n"
}

# ─── Add to PATH ────────────────────────────────────────────────────────────

setup_path() {
  SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")
  EXPORT_LINE='export PATH="$HOME/.fluxy/bin:$PATH"'
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
      if ! grep -q "fluxy/bin" "$HOME/.config/fish/config.fish" 2>/dev/null; then
        echo 'set -gx PATH "$HOME/.fluxy/bin" $PATH' >> "$HOME/.config/fish/config.fish"
      fi
      printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(~/.config/fish/config.fish)${RESET}\n"
      return 0
      ;;
    *)    PROFILE="$HOME/.profile" ;;
  esac

  if [ -n "$PROFILE" ]; then
    if ! grep -q "fluxy/bin" "$PROFILE" 2>/dev/null; then
      printf "\n# Fluxy\n%s\n" "$EXPORT_LINE" >> "$PROFILE"
    fi
    printf "  ${BLUE}✔${RESET}  Added to PATH ${DIM}(${PROFILE})${RESET}\n"
  fi

  export PATH="$BIN_DIR:$PATH"
}

# ─── Main ────────────────────────────────────────────────────────────────────

mkdir -p "$FLUXY_HOME"

detect_platform
check_system_node || install_node
install_fluxy
create_wrapper
setup_path

printf "\n"
printf "  ${PINK}${BOLD}✔  Fluxy is ready!${RESET}\n"
printf "\n"
printf "  ${DIM}─────────────────────────────${RESET}\n"
printf "  ${BOLD}Get started:${RESET}\n"
printf "\n"
printf "    ${BLUE}fluxy init${RESET}      Set up your bot\n"
printf "    ${BLUE}fluxy start${RESET}     Start your bot\n"
printf "    ${BLUE}fluxy status${RESET}    Check if it's running\n"
printf "\n"
printf "  ${PINK}>${RESET} Run ${BLUE}fluxy init${RESET} to begin.\n"
printf "  ${DIM}(Open a new terminal if 'fluxy' isn't found yet)${RESET}\n"
printf "\n"
printf "  ${DIM}https://fluxy.bot${RESET}\n"
printf "\n"
