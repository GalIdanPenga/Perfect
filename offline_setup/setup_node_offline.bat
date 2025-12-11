@echo off
REM Perfect - Node.js Offline Setup Script
REM This script installs all Node.js dependencies from local tarballs

echo ========================================
echo Perfect - Node.js Offline Setup
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

REM Check Node.js version
for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Detected Node.js version: %NODE_VERSION%
echo.

REM Check if offline_packages directory exists
if not exist "offline_packages\" (
    echo [ERROR] 'offline_packages' directory not found!
    echo [ERROR] Make sure you have copied the offline_packages directory from the online computer.
    pause
    exit /b 1
)

REM Check if node_modules exists
if exist "node_modules\" (
    echo [INFO] 'node_modules' directory already exists.
    echo [INFO] Removing it to start fresh...
    rmdir /s /q node_modules
)

REM Check if package-lock.json exists
if exist "package-lock.json" (
    echo [INFO] Removing old package-lock.json...
    del /f package-lock.json
)

echo [INFO] Creating node_modules directory...
mkdir node_modules

echo [INFO] Installing packages from local tarballs...
echo [INFO] This may take several minutes...
echo.

REM Copy package.json from offline_packages if it doesn't exist
if not exist "package.json" (
    if exist "offline_packages\package.json" (
        echo [INFO] Copying package.json from offline_packages...
        copy offline_packages\package.json package.json
    )
)

REM Install packages using offline tarballs
REM First, we need to install all tarballs into node_modules

echo [INFO] Extracting and installing packages...

REM Count total tarballs
set COUNT=0
for %%f in (offline_packages\*.tgz) do set /a COUNT+=1
echo [INFO] Found %COUNT% packages to install
echo.

REM Install each tarball
set CURRENT=0
for %%f in (offline_packages\*.tgz) do (
    set /a CURRENT+=1
    echo [%CURRENT%/%COUNT%] Installing %%~nf...
    npm install --no-save --prefer-offline --cache-min 999999 --legacy-peer-deps "%%f" >nul 2>&1
)

echo.
echo [INFO] Running final dependency resolution...

REM Install from package.json using offline mode
npm install --prefer-offline --cache-min 999999 --legacy-peer-deps

if errorlevel 1 (
    echo.
    echo [WARNING] Some packages may not have installed correctly.
    echo [WARNING] However, the installation may still be functional.
    echo [WARNING] Try running your application to verify.
) else (
    echo.
    echo ========================================
    echo [SUCCESS] Setup completed successfully!
    echo ========================================
)

echo.
echo To verify the installation, you can run:
echo   npm list
echo.
echo To start the application:
echo   npm run dev:all
echo.
pause
