#!/bin/bash
# Start script for Railway deployment
# Handles Railway's PORT environment variable and starts supervisord
# Requirements: 4.1, 4.2

set -e

# Use Railway's PORT or default to 3000 (Requirement 4.1)
export PORT=${PORT:-3000}

# Set sensible defaults for other environment variables (Requirement 4.2)
export NODE_ENV=${NODE_ENV:-production}
export PYTHONPATH=${PYTHONPATH:-/app}
export HOSTNAME=${HOSTNAME:-0.0.0.0}
export EXTRACTOR_PROFILE=${EXTRACTOR_PROFILE:-full}

# Update supervisord config with actual PORT
# This ensures Next.js binds to Railway's assigned port
sed -i "s/PORT=\"3000\"/PORT=\"$PORT\"/g" /etc/supervisor/conf.d/supervisord.conf

echo "============================================"
echo "Starting Fetchtium"
echo "============================================"
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "PYTHONPATH: $PYTHONPATH"
echo "EXTRACTOR_PROFILE: $EXTRACTOR_PROFILE"
echo "============================================"

# Start supervisord (manages both Next.js and Flask processes)
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
