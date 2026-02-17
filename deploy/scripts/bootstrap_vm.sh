#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/drafted}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg jq rsync ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo usermod -aG docker "${SUDO_USER:-$USER}" || true
sudo systemctl enable docker
sudo systemctl start docker

sudo mkdir -p "${APP_ROOT}/releases"
sudo chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "${APP_ROOT}"

sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

echo "Bootstrap complete."
echo "Log out/in once so docker group membership is applied."
