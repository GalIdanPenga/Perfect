@echo off
REM Perfect Python Client - Offline Setup Script
REM This script creates a virtual environment and installs dependencies from local wheels

echo ========================================
echo Perfect Python Client - Offline Setup
echo ========================================
echo.

REM Check if .venv already exists
if exist ".venv\" (
    echo [INFO] Virtual environment '.venv' already exists.
    echo [INFO] Skipping creation...
) else (
    echo [INFO] Creating virtual environment '.venv'...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        echo [ERROR] Make sure Python 3.8+ is installed and in PATH.
        pause
        exit /b 1
    )
    echo [SUCCESS] Virtual environment created.
)

echo.
echo [INFO] Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b 1
)

echo [INFO] Virtual environment activated.
echo.

REM Check if wheels directory exists
if not exist "wheels\" (
    echo [ERROR] 'wheels' directory not found!
    echo [ERROR] Make sure you have the wheels directory with all dependency packages.
    pause
    exit /b 1
)

echo [INFO] Installing packages from local wheels...
echo [INFO] This may take a few minutes...
echo.

REM Upgrade pip first (from wheels if available)
python -m pip install --no-index --find-links=wheels --upgrade pip

REM Install all requirements from wheels
python -m pip install --no-index --find-links=wheels -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install some packages!
    echo [ERROR] Check the error messages above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo [SUCCESS] Setup completed successfully!
echo ========================================
echo.
echo To activate the environment later, run:
echo   .venv\Scripts\activate.bat
echo.
echo To run the example client, use:
echo   python example_flows.py
echo.
pause
