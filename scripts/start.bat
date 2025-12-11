@echo off
REM Perfect - Start Script (Windows)
REM This script starts both frontend and backend, then opens the browser

echo ========================================
echo Perfect - Starting Application
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo [ERROR] Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [WARNING] node_modules directory not found!
    echo [INFO] Installing dependencies first...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting frontend and backend servers...
echo [INFO] Frontend will be available at: http://localhost:5173
echo [INFO] Backend will be available at: http://localhost:3000
echo.
echo [INFO] Press Ctrl+C to stop the servers
echo.

REM Start the servers in a new window and wait a bit
start "Perfect Servers" cmd /c "npm run dev:all"

REM Wait for servers to start (5 seconds)
echo [INFO] Waiting for servers to start...
timeout /t 5 /nobreak >nul

REM Open browser to frontend
echo [INFO] Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo [SUCCESS] Application started!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo.
echo The servers are running in a separate window.
echo Close that window or press Ctrl+C there to stop the servers.
echo.
pause
