#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

ok()   { echo -e "${GREEN}✓${NC} $1"; pass=$((pass+1)); }
bad()  { echo -e "${RED}✗${NC} $1"; fail=$((fail+1)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "CrowdSec Dashboard — dependency check"
echo "======================================"
echo ""

# --- Python 3.14 ---
echo -n "Checking Python 3.14 ... "
PY=""
for c in python3.14 python3 python; do
  if command -v "$c" >/dev/null 2>&1; then
    ver=$("$c" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    major=$(echo "$ver" | cut -d. -f1)
    minor=$(echo "$ver" | cut -d. -f2)
    if [ "$major" = "3" ] && [ "$minor" = "14" ]; then
      PY="$c ($ver)"
      break
    fi
  fi
done
if [ -n "$PY" ]; then
  ok "Python 3.14 found: $PY"
else
  if command -v python3 >/dev/null 2>&1; then
    ver=$(python3 --version 2>&1)
    bad "Python 3.14 not found (found: $ver). Install: https://www.python.org/downloads/ or via deadsnakes PPA / pyenv"
  else
    bad "Python 3.14 not found (python3 not on PATH). Install: https://www.python.org/downloads/"
  fi
fi

# --- uv ---
echo -n "Checking uv ... "
if command -v uv >/dev/null 2>&1; then
  ok "uv found: $(uv --version 2>&1)"
else
  bad "uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# --- FastAPI ---
echo -n "Checking FastAPI ... "
FASTAPI_FOUND=0
for py in python3.14 python3 python; do
  if command -v "$py" >/dev/null 2>&1; then
    if "$py" -c "import fastapi" 2>/dev/null; then
      ver=$("$py" -c "import fastapi; print(fastapi.__version__)" 2>/dev/null)
      ok "FastAPI found: $ver (via $py)"
      FASTAPI_FOUND=1
      break
    fi
  fi
done
if [ "$FASTAPI_FOUND" -eq 0 ]; then
  if command -v uv >/dev/null 2>&1 && [ -f "backend/pyproject.toml" ]; then
    if uv run --project backend python -c "import fastapi" 2>/dev/null; then
      ver=$(uv run --project backend python -c "import fastapi; print(fastapi.__version__)" 2>/dev/null)
      ok "FastAPI found: $ver (via uv run)"
      FASTAPI_FOUND=1
    fi
  fi
fi
if [ "$FASTAPI_FOUND" -eq 0 ]; then
  bad "FastAPI not found. Install: uv sync  (or: pip install \"fastapi[standard]>=0.141.1\")"
fi

# --- Node 22 ---
echo -n "Checking Node 22 ... "
if command -v node >/dev/null 2>&1; then
  ver=$(node --version 2>&1)        # v22.x.x
  major=$(echo "$ver" | grep -oE '[0-9]+' | head -1)
  if [ "$major" = "22" ]; then
    ok "Node found: $ver"
  else
    bad "Node 22 required (found: $ver). Install: https://nodejs.org or via nvm: nvm install 22 && nvm use 22"
  fi
else
  bad "Node not found. Install Node 22: https://nodejs.org or via nvm: nvm install 22"
fi

# --- PM2 ---
echo -n "Checking PM2 ... "
if command -v pm2 >/dev/null 2>&1; then
  ok "PM2 found: $(pm2 --version 2>&1)"
else
  bad "PM2 not found. Install: npm i -g pm2"
fi

echo ""
echo "--------------------------------------"
if [ "$fail" -eq 0 ]; then
  echo -e "${GREEN}All $pass checks passed.${NC}"
  exit 0
else
  echo -e "${RED}$fail check(s) failed, $pass passed.${NC}"
  echo "Fix the failures above, then re-run: bash check.sh"
  exit 1
fi
