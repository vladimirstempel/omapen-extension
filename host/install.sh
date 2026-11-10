#!/bin/sh
# Installs the OmaPen host with one command, no checkout needed:
#
#   curl -fsSL https://raw.githubusercontent.com/vladimirstempel/omapen-extension/main/host/install.sh | sh
#
# Arguments go to install.mjs: add `-s -- --uninstall` after `sh` to remove it.
set -eu

REPO="vladimirstempel/omapen-extension"

if ! command -v node >/dev/null 2>&1; then
  echo "OmaPen needs Node.js. Install it from https://nodejs.org, then run this command again." >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

echo "Downloading the OmaPen host..."
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" | tar -xz -C "$work"
node "$work"/*/host/install.mjs "$@"
