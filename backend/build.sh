#!/usr/bin/env bash
#
# build.sh — reproducible native Linux build for the CrowdSec dashboard.
#
# Produces a single self-contained Linux binary that embeds the production
# frontend static bundle (architecture §9, task 11). No Docker, no Podman, no
# containers: the Go toolchain and Node.js run natively on the build host.
#
# Prerequisites (native, on the build host):
#   - Go >= 1.22            (matches backend/go.mod)
#   - Node.js >= 18.18      (matches frontend/package.json engines)
#   - npm install executed  (frontend/node_modules present)
#
# Output:
#   backend/bin/crowdsec-dashboard   (Linux, amd64 by default)
#
# Usage:
#   backend/build.sh [output-path]
#
# The binary is built with CGO_ENABLED=0 so it is fully static and runs on a
# clean CrowdSec host without shared-library dependencies. Cross-compilation
# is supported through the standard GOOS/GOARCH/CGO_ENABLED environment
# variables; the default target is linux/amd64.
set -euo pipefail

# Resolve this script's directory and the repo root.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

FRONTEND_DIR="${REPO_ROOT}/frontend"
ASSETS_PKG_DIR="${SCRIPT_DIR}/internal/assets/bundle"
OUTPUT="${1:-${SCRIPT_DIR}/bin/crowdsec-dashboard}"

build_frontend() {
  echo "==> Building frontend static export (frontend/out)…"
  if [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    echo "error: frontend/node_modules is missing; run 'npm install' in ${FRONTEND_DIR}" >&2
    exit 1
  fi
  (cd "${FRONTEND_DIR}" && npm run build)
}

stage_bundle() {
  echo "==> Staging frontend bundle into ${ASSETS_PKG_DIR}…"
  # Remove the previous staged bundle so stale files never survive a rebuild.
  rm -rf "${ASSETS_PKG_DIR}"
  mkdir -p "${ASSETS_PKG_DIR}"
  # Copy the static export (frontend/out). The embed package serves these
  # files at their serving path (index.html, _next/...).
  cp -a "${FRONTEND_DIR}/out/." "${ASSETS_PKG_DIR}/"
}

build_binary() {
  echo "==> Building Go binary…"
  mkdir -p "$(dirname "${OUTPUT}")"
  (cd "${SCRIPT_DIR}" && CGO_ENABLED=0 go build -trimpath \
    -o "${OUTPUT}" ./cmd/crowdsec-dashboard)
}

echo "CrowdSec dashboard native build"
echo "  repo:    ${REPO_ROOT}"
echo "  output:  ${OUTPUT}"

build_frontend
stage_bundle
build_binary

echo "==> Done: ${OUTPUT}"
ls -lh "${OUTPUT}"