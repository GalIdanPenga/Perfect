import express from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Client process state
let pythonProcess: ChildProcess | null = null;
let clientStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
let clientLogs: string[] = [];

/**
 * GET /api/client/status
 * Get current client status and recent logs
 */
router.get('/status', (req, res) => {
  res.json({
    status: clientStatus,
    logs: clientLogs.slice(-50)
  });
});

/**
 * POST /api/client/start
 * Start the Python client process
 */
router.post('/start', (req, res) => {
  if (pythonProcess) {
    return res.json({
      success: false,
      message: 'Client is already running',
      status: clientStatus
    });
  }

  try {
    clientStatus = 'starting';
    clientLogs = [];
    clientLogs.push('[Server] Starting Python client...');

    const pythonPath = 'python3';
    const scriptPath = path.join(__dirname, '../../examples/workflows/example_flows.py');

    pythonProcess = spawn(pythonPath, ['-u', scriptPath], {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    pythonProcess.stdout?.on('data', (data) => {
      const log = data.toString().trim();
      clientLogs.push(log);
      console.log('[Python Client]', log);
    });

    pythonProcess.stderr?.on('data', (data) => {
      const log = data.toString().trim();
      clientLogs.push(`[ERROR] ${log}`);
      console.error('[Python Client Error]', log);
    });

    pythonProcess.on('spawn', () => {
      clientStatus = 'running';
      clientLogs.push('[Server] Python client started successfully');
      console.log('[Server] Python client process spawned');
    });

    pythonProcess.on('error', (error) => {
      clientStatus = 'error';
      clientLogs.push(`[Server] Failed to start Python client: ${error.message}`);
      console.error('[Server] Failed to start Python client:', error);
      pythonProcess = null;
    });

    pythonProcess.on('exit', (code, signal) => {
      const exitMsg = signal
        ? `[Server] Python client stopped (signal: ${signal})`
        : `[Server] Python client exited (code: ${code})`;

      clientLogs.push(exitMsg);
      console.log(exitMsg);

      clientStatus = 'stopped';
      pythonProcess = null;
    });

    res.json({
      success: true,
      message: 'Python client starting...',
      status: clientStatus
    });

  } catch (error: any) {
    clientStatus = 'error';
    clientLogs.push(`[Server] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
      status: clientStatus
    });
  }
});

/**
 * POST /api/client/stop
 * Stop the Python client process
 */
router.post('/stop', (req, res) => {
  if (!pythonProcess) {
    return res.json({
      success: false,
      message: 'Client is not running',
      status: clientStatus
    });
  }

  try {
    clientLogs.push('[Server] Stopping Python client...');
    pythonProcess.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (pythonProcess) {
        pythonProcess.kill('SIGKILL');
      }
    }, 5000);

    res.json({
      success: true,
      message: 'Python client stopping...',
      status: 'stopping'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      status: clientStatus
    });
  }
});

export default router;
