#!/bin/bash
set -e

export PORT=${PORT:-3000}
export NODE_ENV=${NODE_ENV:-production}
export PYTHONPATH=${PYTHONPATH:-/app}
export HOSTNAME=${HOSTNAME:-0.0.0.0}
export PYTHON_SERVER_PORT=${PYTHON_SERVER_PORT:-5000}

echo "============================================"
echo "Starting Fetchtium"
echo "Next.js port: ${PORT}"
echo "Python API port: ${PYTHON_SERVER_PORT}"
echo "============================================"

python -m api &
PYTHON_PID=$!

cleanup() {
  if kill -0 "$PYTHON_PID" >/dev/null 2>&1; then
    kill "$PYTHON_PID" >/dev/null 2>&1 || true
    wait "$PYTHON_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

node server.js
