#!/bin/sh
set -e

# ─── Fluxy Installer ────────────────────────────────────────────────────────
# curl -fsSL https://fluxy.bot/install | sh
#
# Downloads Node.js + Fluxy into ~/.fluxy — no system dependencies needed.
# ─────────────────────────────────────────────────────────────────────────────

VERSION="0.1.0"
NODE_VERSION="22.14.0"
FLUXY_HOME="$HOME/.fluxy"
TOOLS_DIR="$FLUXY_HOME/tools"
NODE_DIR="$TOOLS_DIR/node"
BIN_DIR="$FLUXY_HOME/bin"

CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

printf "\n${CYAN}${BOLD}  ╔═══════════════════════════════╗${RESET}\n"
printf "${CYAN}${BOLD}  ║       FLUXY  v${VERSION}          ║${RESET}\n"
printf "${CYAN}${BOLD}  ╚═══════════════════════════════╝${RESET}\n"
printf "${DIM}  Self-hosted AI bot${RESET}\n\n"

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

# ─── Download Node.js ───────────────────────────────────────────────────────

install_node() {
  # Check if we already have a bundled node that works
  if [ -x "$NODE_DIR/bin/node" ]; then
    EXISTING=$("$NODE_DIR/bin/node" -v 2>/dev/null || echo "")
    if [ -n "$EXISTING" ]; then
      printf "  ${GREEN}✔${RESET}  Node.js ${EXISTING} (bundled)\n"
      return 0
    fi
  fi

  printf "  ${CYAN}↓${RESET}  Downloading Node.js v${NODE_VERSION}...\n"

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

  printf "  ${GREEN}✔${RESET}  Node.js v${NODE_VERSION} installed\n"
}

# ─── Install Fluxy via bundled npm ──────────────────────────────────────────

install_fluxy() {
  NODE="$NODE_DIR/bin/node"
  NPM="$NODE_DIR/bin/npm"

  printf "  ${CYAN}↓${RESET}  Installing fluxy...\n"

  # Install fluxy-bot globally using bundled node, into our own prefix
  "$NPM" install -g fluxy-bot --prefix "$FLUXY_HOME" 2>/dev/null

  # Verify
  if [ ! -f "$FLUXY_HOME/lib/node_modules/fluxy-bot/bin/cli.js" ]; then
    printf "  ${RED}✗${RESET}  Installation failed\n"
    exit 1
  fi

  printf "  ${GREEN}✔${RESET}  Fluxy v${VERSION} installed\n"
}

# ─── Create wrapper script ──────────────────────────────────────────────────

create_wrapper() {
  mkdir -p "$BIN_DIR"

  cat > "$BIN_DIR/fluxy" << 'WRAPPER'
#!/bin/sh
FLUXY_HOME="$HOME/.fluxy"
NODE="$FLUXY_HOME/tools/node/bin/node"
CLI="$FLUXY_HOME/lib/node_modules/fluxy-bot/bin/cli.js"
exec "$NODE" "$CLI" "$@"
WRAPPER

  chmod +x "$BIN_DIR/fluxy"
  printf "  ${GREEN}✔${RESET}  Created ${DIM}~/.fluxy/bin/fluxy${RESET}\n"
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
      # Fish uses a different syntax
      mkdir -p "$HOME/.config/fish"
      if ! grep -q "fluxy/bin" "$HOME/.config/fish/config.fish" 2>/dev/null; then
        echo 'set -gx PATH "$HOME/.fluxy/bin" $PATH' >> "$HOME/.config/fish/config.fish"
      fi
      printf "  ${GREEN}✔${RESET}  Added to PATH ${DIM}(~/.config/fish/config.fish)${RESET}\n"
      return 0
      ;;
    *)    PROFILE="$HOME/.profile" ;;
  esac

  if [ -n "$PROFILE" ]; then
    if ! grep -q "fluxy/bin" "$PROFILE" 2>/dev/null; then
      printf "\n# Fluxy\n%s\n" "$EXPORT_LINE" >> "$PROFILE"
    fi
    printf "  ${GREEN}✔${RESET}  Added to PATH ${DIM}(${PROFILE})${RESET}\n"
  fi

  # Also export for current session
  export PATH="$BIN_DIR:$PATH"
}

# ─── Main ────────────────────────────────────────────────────────────────────

mkdir -p "$FLUXY_HOME"

detect_platform
install_node
install_fluxy
create_wrapper
setup_path

printf "\n  ${GREEN}${BOLD}✔  Fluxy is ready!${RESET}\n\n"
printf "  Get started:\n\n"
printf "    ${CYAN}fluxy init${RESET}      Set up your bot\n"
printf "    ${CYAN}fluxy start${RESET}     Start your bot\n"
printf "    ${CYAN}fluxy status${RESET}    Check if it's running\n\n"
printf "  ${DIM}Run ${RESET}${CYAN}fluxy init${RESET}${DIM} to begin.${RESET}\n"
printf "  ${DIM}(Open a new terminal if 'fluxy' isn't found yet)${RESET}\n\n"
