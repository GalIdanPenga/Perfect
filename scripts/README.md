# Perfect - Scripts

This directory contains utility scripts to run and manage the Perfect application.

## Available Scripts

### Start Application

Starts both frontend and backend servers, then automatically opens the frontend in your default browser.

**Windows (Native):**
```cmd
scripts\start.bat
```

**Linux/Mac:**
```bash
./scripts/start.sh
```

**WSL (Windows Subsystem for Linux):**

Option 1 - Run from WSL terminal:
```bash
./scripts/start.sh
```

Option 2 - Run from Windows (double-click or run from Windows Command Prompt):
```cmd
scripts\start_from_windows.bat
```
Note: Edit the `WSL_DISTRO` and `WSL_PROJECT_PATH` variables in the script if needed.

#### What it does:
1. Checks if Node.js is installed
2. Installs dependencies if `node_modules` is missing
3. Starts both frontend (Vite) and backend (Express) servers
4. Waits 5 seconds for servers to initialize
5. Opens `http://localhost:5173` in your default browser

#### URLs:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

#### Stopping the servers:
- **Windows**: Close the "Perfect Servers" window or press Ctrl+C in it
- **Linux/Mac**: Press Ctrl+C in the terminal

## Running from Project Root

You can also run these scripts from the project root directory:

**Windows:**
```cmd
scripts\start.bat
```

**Linux/Mac:**
```bash
./scripts/start.sh
```

Or using npm (add to package.json if desired):
```bash
npm run dev:all
```

## Troubleshooting

### "Node.js not found"
Make sure Node.js 18+ is installed and in your PATH:
```bash
node -v
```

### "node_modules not found"
The script will automatically run `npm install` if `node_modules` is missing. If this fails, manually install dependencies:
```bash
npm install
```

### Browser doesn't open automatically

**WSL (Windows Subsystem for Linux):**
If the browser doesn't open when running from WSL:
1. Try the `start_from_windows.bat` script instead (run from Windows Explorer or Windows Command Prompt)
2. Or manually open http://localhost:5173 in your browser after starting the servers

**Linux:** Install `xdg-utils`:
```bash
sudo apt-get install xdg-utils
```

**Mac:** Should work by default with the `open` command

**WSL Alternative:** Install wslu for `wslview`:
```bash
sudo apt-get install wslu
```

If all else fails, manually open http://localhost:5173 in your browser.

### Port already in use

If port 5173 or 3000 is already in use:

**Find and kill the process (Windows):**
```cmd
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Find and kill the process (Linux/Mac):**
```bash
lsof -ti:5173 | xargs kill
lsof -ti:3000 | xargs kill
```

### Database issues

If you encounter database errors, the SQLite database might be locked or corrupted. The database is located at:
```
server/database/flows.db
```

## Additional Scripts

You can add more utility scripts here, such as:
- `build.bat` / `build.sh` - Production build
- `test.bat` / `test.sh` - Run tests
- `deploy.bat` / `deploy.sh` - Deployment scripts
- `backup.bat` / `backup.sh` - Database backup

## Development

To run only the frontend or backend:

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run server
```

**Both (without browser auto-open):**
```bash
npm run dev:all
```
