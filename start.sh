#!/bin/bash

# Terminate all background processes spawned by this script on exit
trap "kill 0" EXIT

echo "=== Starting ECG CDSS Workstation ==="

# 1. Start Python backend server in the background
if [ -d "venv" ]; then
    echo "[Backend] Starting server via virtualenv..."
    ./venv/bin/uvicorn backend.server:app --port 8000 --host 127.0.0.1 > backend.log 2>&1 &
else
    echo "[Backend] Warning: venv not found. Attempting system uvicorn..."
    uvicorn backend.server:app --port 8000 --host 127.0.0.1 > backend.log 2>&1 &
fi

# Give backend a second to boot up
sleep 1.5

# 2. Run compilation and development server on frontend
echo "[Frontend] Navigating to frontend directory..."
cd frontend

echo "[Frontend] Running compilation..."
bun run compile

if [ $? -ne 0 ]; then
    echo "[Frontend] CRITICAL: Compilation failed. Aborting dev server launch."
    exit 1
fi

# Start frontend dev server in background
echo "[Frontend] Starting development server..."
bun run dev > dev_server.log 2>&1 &

# Wait for frontend to initialize
sleep 2.0

# Dynamically parse URLs from logs
BACKEND_URL=$(grep -oE "http://[0-9a-zA-Z.-]+:[0-9]+" ../backend.log | head -n 1)
if [ -z "$BACKEND_URL" ]; then
    BACKEND_URL="http://localhost:8000"
fi

FRONTEND_URL=$(grep -oE "http://[0-9a-zA-Z.-]+:[0-9]+" dev_server.log | head -n 1)
if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="http://localhost:5173"
fi

# Print green colored workspace links HUD
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=================================================="
echo -e "  GTT - AFIB DETECTION & ASSESSMENT TOOL ONLINE   "
echo -e "  - Backend API:  $BACKEND_URL"
echo -e "  - Frontend App: $FRONTEND_URL"
echo -e "==================================================${NC}"
echo ""

# Keep shell session active to handle cleanup trap on Ctrl+C
wait
