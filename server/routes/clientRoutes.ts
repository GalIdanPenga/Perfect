import express from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { flowEngine } from '../engine/FlowEngine';
import { PerformanceSensitivity } from '../engine/services/PerformanceMonitor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Client process state
let pythonProcess: ChildProcess | null = null;
let clientStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
let clientLogs: string[] = [];
let activeClient: ClientConfig | null = null;

// Performance sensitivity levels - imported from PerformanceMonitor service
export type { PerformanceSensitivity };

// Load client configurations
interface ClientConfig {
  id: string;
  name: string;
  description: string;
  workingDir: string;
  command: string;
  args: string[];
  color?: string;
  performanceSensitivity?: PerformanceSensitivity;
}

interface ClientsConfig {
  clients: ClientConfig[];
}

let clientsConfig: ClientsConfig;
try {
  const configPath = path.join(__dirname, '../clients.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  clientsConfig = JSON.parse(configData);
  console.log(`[Server] Loaded ${clientsConfig.clients.length} client configurations`);
} catch (error) {
  console.error('[Server] Failed to load clients.json, using default config');
  clientsConfig = {
    clients: [
      {
        id: 'perfect_example',
        name: 'Perfect Example Flows',
        description: 'Default example workflows',
        workingDir: 'examples/workflows',
        command: 'python3',
        args: ['example_flows.py']
      }
    ]
  };
}

/**
 * GET /api/client/configs
 * Get available client configurations
 */
router.get('/configs', (req, res) => {
  res.json(clientsConfig);
});

/**
 * GET /api/client/status
 * Get current client status and recent logs
 */
router.get('/status', (req, res) => {
  res.json({
    status: clientStatus,
    logs: clientLogs.slice(-50),
    activeClient: activeClient
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
    // Get client ID from request body, default to first client
    const { clientId } = req.body;
    const selectedClient = clientsConfig.clients.find(c => c.id === clientId) || clientsConfig.clients[0];

    activeClient = selectedClient;
    clientStatus = 'starting';
    clientLogs = [];
    clientLogs.push(`[Server] Starting Python client: ${selectedClient.name}...`);
    clientLogs.push(`[Server] Working directory: ${selectedClient.workingDir}`);
    clientLogs.push(`[Server] Command: ${selectedClient.command} ${selectedClient.args.join(' ')}`);

    // Resolve working directory relative to project root
    const workingDir = path.join(__dirname, '../..', selectedClient.workingDir);

    // Add -u flag for Python to ensure unbuffered output
    const commandArgs = selectedClient.command.includes('python')
      ? ['-u', ...selectedClient.args]
      : selectedClient.args;

    pythonProcess = spawn(selectedClient.command, commandArgs, {
      cwd: workingDir,
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
      activeClient = null;
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
 * Stop the Python client process and fail all running flows
 */
router.post('/stop', (req, res) => {
  if (!pythonProcess) {
    // Even if process is not running, ensure we clean up state
    clientStatus = 'stopped';
    activeClient = null;
    flowEngine.failAllRunningFlows();
    return res.json({
      success: true,
      message: 'Client already stopped',
      status: clientStatus
    });
  }

  try {
    clientLogs.push('[Server] Stopping Python client...');

    // Store reference to current process before killing
    const processToKill = pythonProcess;

    // Kill the process first to stop it from sending more updates
    processToKill.kill('SIGTERM');

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      try {
        if (processToKill && !processToKill.killed) {
          processToKill.kill('SIGKILL');
        }
      } catch (e) {
        // Process already dead, ignore
      }
    }, 5000);

    // Fail all running flows immediately
    flowEngine.failAllRunningFlows();

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

// Export function to get active client info
export function getActiveClient(): ClientConfig | null {
  return activeClient;
}

export default router;
