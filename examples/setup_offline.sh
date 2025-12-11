#!/bin/bash
# Perfect Python Client - Offline Setup Script
# This script creates a virtual environment and installs dependencies from local wheels

echo "========================================"
echo "Perfect Python Client - Offline Setup"
echo "========================================"
echo ""

# Check if .venv already exists
if [ -d ".venv" ]; then
    echo "[INFO] Virtual environment '.venv' already exists."
    echo "[INFO] Skipping creation..."
else
    echo "[INFO] Creating virtual environment '.venv'..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment!"
        echo "[ERROR] Make sure Python 3.8+ is installed."
        exit 1
    fi
    echo "[SUCCESS] Virtual environment created."
fi

echo ""
echo "[INFO] Activating virtual environment..."
source .venv/bin/activate
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to activate virtual environment!"
    exit 1
fi

echo "[INFO] Virtual environment activated."
echo ""

# Check if wheels directory exists
if [ ! -d "wheels" ]; then
    echo "[ERROR] 'wheels' directory not found!"
    echo "[ERROR] Make sure you have the wheels directory with all dependency packages."
    exit 1
fi

echo "[INFO] Installing packages from local wheels..."
echo "[INFO] This may take a few minutes..."
echo ""

# Upgrade pip first (from wheels if available)
python -m pip install --no-index --find-links=wheels --upgrade pip

# Install all requirements from wheels
python -m pip install --no-index --find-links=wheels -r requirements.txt
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to install some packages!"
    echo "[ERROR] Check the error messages above."
    exit 1
fi

echo ""
echo "========================================"
echo "[SUCCESS] Setup completed successfully!"
echo "========================================"
echo ""
echo "To activate the environment later, run:"
echo "  source .venv/bin/activate"
echo ""
echo "To run the example client, use:"
echo "  python example_flows.py"
echo ""
