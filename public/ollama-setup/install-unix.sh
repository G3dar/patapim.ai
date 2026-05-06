#!/usr/bin/env bash
# PATAPIM — Ollama server installer (macOS / Linux)
# Usage:
#   curl -fsSL https://patapim.ai/ollama-setup/install-unix.sh | bash
#
# What it does:
#   1. Installs Ollama (if missing)
#   2. Pulls the default model (qwen2.5:7b)
#   3. Prints instructions for LAN binding + firewall

set -euo pipefail

DEFAULT_MODEL="${OLLAMA_DEFAULT_MODEL:-qwen2.5:7b}"
PORT=11434

step() { printf "\n==> %s\n" "$*"; }
ok()   { printf "    \033[32m%s\033[0m\n" "$*"; }
warn() { printf "    \033[33m%s\033[0m\n" "$*"; }
err()  { printf "    \033[31m%s\033[0m\n" "$*"; }

# ── 1. Install Ollama if missing ─────────────────────────────────────────
if command -v ollama >/dev/null 2>&1; then
  step "Ollama already installed: $(command -v ollama)"
else
  step "Installing Ollama..."
  case "$(uname -s)" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install ollama
      else
        err "Homebrew not found. Install from https://ollama.com/download/mac and re-run."
        exit 1
      fi
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    *)
      err "Unsupported OS: $(uname -s)"
      exit 1
      ;;
  esac
  ok "Ollama installed."
fi

# ── 2. Start Ollama ──────────────────────────────────────────────────────
step "Ensuring Ollama is running..."
if pgrep -x ollama >/dev/null 2>&1; then
  ok "Ollama already running."
else
  case "$(uname -s)" in
    Darwin)
      open -a Ollama || nohup ollama serve >/dev/null 2>&1 &
      ;;
    Linux)
      if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^ollama\.service'; then
        sudo systemctl enable --now ollama
      else
        nohup ollama serve >/dev/null 2>&1 &
      fi
      ;;
  esac
  sleep 3
  ok "Ollama started."
fi

# ── 3. Pull default model ────────────────────────────────────────────────
step "Pulling default model: $DEFAULT_MODEL"
ollama pull "$DEFAULT_MODEL" || warn "Model pull failed. Retry manually: ollama pull $DEFAULT_MODEL"

# ── 4. Print LAN instructions ────────────────────────────────────────────
step "LAN access (optional)"
cat <<'EOF'
    Ollama binds to 127.0.0.1 by default. To allow other devices on your
    network to reach it:

      macOS:
        launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
        # then restart Ollama.app

      Linux (systemd):
        sudo systemctl edit ollama.service
        # add under [Service]:
        #   Environment="OLLAMA_HOST=0.0.0.0:11434"
        sudo systemctl restart ollama

    Then make sure port 11434 is open on your firewall (ufw/firewalld).
EOF

# ── 5. Finish ────────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "")

echo ""
echo "════════════════════════════════════════════════════════"
echo " Ollama setup complete."
echo "════════════════════════════════════════════════════════"
echo ""
echo " Local URL:     http://localhost:$PORT"
[ -n "$LOCAL_IP" ] && echo " LAN URL:       http://$LOCAL_IP:$PORT (if you enabled LAN binding)"
echo ""
echo " Next: open https://patapim.ai/admin -> Ollama Server tab"
echo "       and save this server's address."
echo ""
