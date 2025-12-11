@echo off
REM Perfect - Start Script (Run from Windows for WSL projects)
REM This script starts the application in WSL and opens the browser from Windows

echo ========================================
echo Perfect - Starting Application (WSL)
echo ========================================
echo.

REM Get the WSL distribution name (default: Ubuntu)
set WSL_DISTRO=Ubuntu-24.04

REM Get the project path in WSL
set WSL_PROJECT_PATH=/home/user/development/Perfect

echo [INFO] Starting servers in WSL...
echo [INFO] Distribution: %WSL_DISTRO%
echo [INFO] Project path: %WSL_PROJECT_PATH%
echo.

REM Start the servers in WSL (in background)
start "Perfect Servers (WSL)" wsl -d %WSL_DISTRO% bash -c "cd %WSL_PROJECT_PATH% && npm run dev:all"

REM Wait for servers to start
echo [INFO] Waiting for servers to start...
timeout /t 7 /nobreak >nul

REM Open browser
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
echo The servers are running in the "Perfect Servers (WSL)" window.
echo Close that window to stop the servers.
echo.
pause
