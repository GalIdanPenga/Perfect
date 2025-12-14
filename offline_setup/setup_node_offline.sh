#!/bin/bash
# Perfect - Node.js Offline Setup Script
# This script installs all Node.js dependencies from local tarballs

echo "========================================"
echo "Perfect - Node.js Offline Setup"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH!"
    echo "[ERROR] Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo "[INFO] Detected Node.js version: $NODE_VERSION"
echo ""

# Check if offline_packages directory exists
if [ ! -d "offline_packages" ]; then
    echo "[ERROR] 'offline_packages' directory not found!"
    echo "[ERROR] Make sure you have copied the offline_packages directory from the online computer."
    exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "[INFO] 'node_modules' directory already exists."
    echo "[INFO] Removing it to start fresh..."
    rm -rf node_modules
fi

# Check if package-lock.json exists
if [ -f "package-lock.json" ]; then
    echo "[INFO] Removing old package-lock.json..."
    rm -f package-lock.json
fi

echo "[INFO] Creating node_modules directory..."
mkdir -p node_modules

echo "[INFO] Installing packages from local tarballs..."
echo "[INFO] This may take several minutes..."
echo ""

# Copy package.json from offline_packages if it doesn't exist
if [ ! -f "package.json" ] && [ -f "offline_packages/package.json" ]; then
    echo "[INFO] Copying package.json from offline_packages..."
    cp offline_packages/package.json package.json
fi

# Count total tarballs
TOTAL=$(ls -1 offline_packages/*.tgz 2>/dev/null | wc -l)
echo "[INFO] Found $TOTAL packages to install"
echo ""

# Install each tarball
CURRENT=0
for tarball in offline_packages/*.tgz; do
    if [ -f "$tarball" ]; then
        CURRENT=$((CURRENT + 1))
        FILENAME=$(basename "$tarball" .tgz)
        echo "[$CURRENT/$TOTAL] Installing $FILENAME..."
        npm install --no-save --prefer-offline --cache-min 999999 --legacy-peer-deps "$tarball" > /dev/null 2>&1
    fi
done

echo ""
echo "[INFO] Running final dependency resolution..."

# Install from package.json using offline mode
npm install --prefer-offline --cache-min 999999 --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo ""
    echo "[WARNING] Some packages may not have installed correctly."
    echo "[WARNING] However, the installation may still be functional."
    echo "[WARNING] Try running your application to verify."
else
    echo ""
    echo "========================================"
    echo "[SUCCESS] Setup completed successfully!"
    echo "========================================"
fi

echo ""
echo "To verify the installation, you can run:"
echo "  npm list"
echo ""
echo "To start the application:"
echo "  npm run dev:all"
echo ""
