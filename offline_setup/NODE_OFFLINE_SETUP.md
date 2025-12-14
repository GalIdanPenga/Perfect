# Perfect - Node.js Offline Installation

This guide explains how to set up the Perfect application (backend + frontend) on an offline computer without internet access.

## Overview

The Perfect application is a full-stack application with:
- **Frontend**: React + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (better-sqlite3)

All dependencies are bundled as npm tarballs for offline installation.

## Contents

After running the download script on an online computer, you will have:

- `offline_packages/` - Directory containing all npm package tarballs (.tgz files)
- `offline_packages/package.json` - Copy of the project's package.json
- `offline_packages/registry.json` - Mapping of packages to tarballs
- `setup_node_offline.bat` - Windows setup script
- `setup_node_offline.sh` - Linux/Mac setup script

## Step 1: Prepare on Online Computer

On a computer with internet access:

1. Clone or download the Perfect repository
2. Navigate to the project directory:
   ```bash
   cd Perfect
   ```

3. Run the download script:

   **Linux/Mac:**
   ```bash
   ./download_node_packages.sh
   ```

   **Windows:**
   ```bash
   bash download_node_packages.sh
   ```
   (Requires Git Bash or WSL on Windows)

4. This will:
   - Install all dependencies to analyze the full dependency tree
   - Download all packages (including transitive dependencies) as .tgz tarballs
   - Create the `offline_packages` directory (~200-300 MB)
   - Generate a registry mapping file

5. Copy these files/directories to your offline computer:
   - `offline_packages/` (entire directory)
   - `setup_node_offline.bat` (Windows)
   - `setup_node_offline.sh` (Linux/Mac)
   - `package.json`
   - All project source files (server/, src/, etc.)

## Step 2: Install on Offline Computer

### Prerequisites

- **Node.js 18 or higher** must be installed
- Approximately **500 MB** of free disk space (for packages + node_modules)

### Windows Installation

1. Copy all files to the offline computer
2. Open Command Prompt and navigate to the project directory:
   ```cmd
   cd path\to\Perfect
   ```

3. Run the setup script:
   ```cmd
   setup_node_offline.bat
   ```

4. The script will:
   - Verify Node.js installation
   - Remove existing node_modules (if any)
   - Install all packages from local tarballs
   - Resolve dependencies

### Linux/Mac Installation

1. Copy all files to the offline computer
2. Open a terminal and navigate to the project directory:
   ```bash
   cd path/to/Perfect
   ```

3. Make the script executable (if needed):
   ```bash
   chmod +x setup_node_offline.sh
   ```

4. Run the setup script:
   ```bash
   ./setup_node_offline.sh
   ```

5. The script will:
   - Verify Node.js installation
   - Remove existing node_modules (if any)
   - Install all packages from local tarballs
   - Resolve dependencies

## Step 3: Running the Application

After successful installation:

### Development Mode (Both Frontend & Backend)

```bash
npm run dev:all
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

### Individual Services

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run server
```

### Production Build

```bash
npm run build
npm run preview
```

## Included Dependencies

### Frontend Dependencies
- **react** & **react-dom** - UI framework
- **lucide-react** - Icon library
- **vite** - Build tool and dev server
- **@vitejs/plugin-react** - React plugin for Vite

### Backend Dependencies
- **express** - Web server framework
- **better-sqlite3** - SQLite database
- **cors** - Cross-origin resource sharing
- **tsx** - TypeScript execution
- **@google/genai** - Google Generative AI

### Development Tools
- **typescript** - Type checking
- **concurrently** - Run multiple commands
- All type definitions (@types/*)

**Total**: ~100+ packages including all transitive dependencies

## Troubleshooting

### "Node.js not found" error

Make sure Node.js 18+ is installed and added to your system PATH.

**Check Node.js version:**
```bash
node -v
```

### "offline_packages directory not found"

Ensure you've copied the entire `offline_packages` directory from the online computer to the same location as the setup script.

### Installation warnings

Some peer dependency warnings are normal and can be ignored. The application should still function correctly.

### Permission errors (Linux/Mac)

Make the script executable:
```bash
chmod +x setup_node_offline.sh
```

### Starting fresh

To reinstall from scratch:

1. Delete the `node_modules` directory
2. Delete `package-lock.json`
3. Run the setup script again

**Windows:**
```cmd
rmdir /s /q node_modules
del package-lock.json
setup_node_offline.bat
```

**Linux/Mac:**
```bash
rm -rf node_modules package-lock.json
./setup_node_offline.sh
```

### Binary dependencies (better-sqlite3)

The `better-sqlite3` package contains native binaries. The downloaded tarball should include pre-built binaries for your platform. If you encounter issues:

1. Ensure the download was performed on a system with the same OS and architecture as the offline computer
2. For Linux: glibc version must be compatible
3. For Windows: Ensure Visual C++ Redistributable is installed

If binary compatibility issues occur, you may need to:
- Use the same Node.js version on both online and offline computers
- Download packages on a system matching the offline computer's OS/architecture

## Updating Packages (Online Computer)

To update to newer versions of dependencies:

1. Update `package.json` with desired versions
2. Run the download script again:
   ```bash
   ./download_node_packages.sh
   ```
3. Copy the new `offline_packages` directory to the offline computer
4. Run the setup script again

## Storage Requirements

- **Tarballs** (`offline_packages/`): ~200-300 MB
- **Installed** (`node_modules/`): ~300-400 MB
- **Total**: ~500-700 MB

## Security Considerations

- All packages are downloaded from the official npm registry
- Package integrity can be verified using checksums in package-lock.json
- No modifications are made to package contents
- The setup scripts do not require elevated privileges

## Support

For issues specific to:
- **Node.js installation**: https://nodejs.org/
- **npm package issues**: Check the package's official repository
- **Perfect application**: See project documentation or contact the development team

## Additional Notes

### Combining with Python Client

If you also need the Python client offline setup (from `examples/`), you can:

1. Follow the Python offline setup instructions in `examples/OFFLINE_SETUP.md`
2. Copy both `offline_packages/` (Node.js) and `examples/wheels/` (Python) to the offline computer
3. Run both setup scripts

### Network-Isolated Environments

This offline setup is ideal for:
- Air-gapped networks
- Secure/classified environments
- Systems without internet access
- Development environments with restricted network access
- Testing deployment procedures

### Automation

These scripts can be integrated into automated deployment pipelines:

```bash
# On build server (online)
./download_node_packages.sh

# Package for deployment
tar -czf perfect-offline.tar.gz offline_packages/ setup_node_offline.sh package.json server/ src/ public/ index.html vite.config.ts tsconfig.json

# On target server (offline)
tar -xzf perfect-offline.tar.gz
./setup_node_offline.sh
```
