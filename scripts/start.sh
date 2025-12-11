#!/bin/bash
# Perfect - Start Script (Linux/Mac)
# This script starts both frontend and backend, then opens the browser

echo "========================================"
echo "Perfect - Starting Application"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "[ERROR] Please install Node.js 18+ first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[WARNING] node_modules directory not found!"
    echo "[INFO] Installing dependencies first..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies!"
        exit 1
    fi
    echo ""
fi

echo "[INFO] Starting frontend and backend servers..."
echo "[INFO] Frontend will be available at: http://localhost:5173"
echo "[INFO] Backend will be available at: http://localhost:3000"
echo ""
echo "[INFO] Press Ctrl+C to stop the servers"
echo ""

# Function to open browser
open_browser() {
    local url=$1

    # Check if running in WSL
    if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "[INFO] Detected WSL environment"
        # Try multiple WSL browser opening methods
        if command -v cmd.exe &> /dev/null; then
            echo "[INFO] Opening browser using Windows cmd..."
            cmd.exe /c start "$url" 2>/dev/null &
            return 0
        elif command -v powershell.exe &> /dev/null; then
            echo "[INFO] Opening browser using PowerShell..."
            powershell.exe -Command "Start-Process '$url'" 2>/dev/null &
            return 0
        elif command -v explorer.exe &> /dev/null; then
            echo "[INFO] Opening browser using explorer.exe..."
            explorer.exe "$url" 2>/dev/null &
            return 0
        elif command -v wslview &> /dev/null; then
            echo "[INFO] Opening browser using wslview..."
            wslview "$url" &> /dev/null &
            return 0
        fi
    fi

    # Linux
    if command -v xdg-open &> /dev/null; then
        echo "[INFO] Opening browser using xdg-open..."
        xdg-open "$url" &> /dev/null &
        return 0
    fi

    # macOS
    if command -v open &> /dev/null; then
        echo "[INFO] Opening browser using open..."
        open "$url"
        return 0
    fi

    # If nothing worked
    echo "[WARNING] Could not detect browser command."
    echo "[INFO] Please open http://localhost:5173 manually."
}

# Start servers in background and capture PID
npm run dev:all &
SERVER_PID=$!

# Wait for servers to start (5 seconds)
echo "[INFO] Waiting for servers to start..."
sleep 5

# Open browser to frontend
echo "[INFO] Opening browser..."
open_browser "http://localhost:5173"

echo ""
echo "========================================"
echo "[SUCCESS] Application started!"
echo "========================================"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the servers"
echo ""

# Handle Ctrl+C gracefully
trap "echo ''; echo '[INFO] Stopping servers...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

# Wait for the background process
wait $SERVER_PID
