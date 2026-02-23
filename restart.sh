#!/bin/bash
# Restart Flask server with clean cache

echo "Stopping existing Python processes..."
pkill -f "python.*api" 2>/dev/null || true

echo "Clearing Python bytecode cache..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -name "*.pyc" -delete 2>/dev/null

echo "Starting Flask server..."
python -m api &
echo "Server started on http://127.0.0.1:5000"
