#!/bin/bash
set -e

echo "[1/4] Running TypeScript tests"
npm test

echo "[2/4] Running Python tests"
python -m unittest discover -s tests -p "test_*.py"

echo "[3/4] Building Next.js"
npm run build

echo "[4/4] Docker validation (if available)"
if command -v docker >/dev/null 2>&1; then
  docker build -t fetchtiumv2:latest .
  echo "Docker build completed"
else
  echo "Docker not found, skipping container validation"
fi

echo "Deployment validation completed"
