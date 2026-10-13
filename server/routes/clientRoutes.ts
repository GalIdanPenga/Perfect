import express from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { flowEngine } from '../engine/FlowEngine';
import { ClientConfig } from '../types';
import { PerformanceSensitivity, DEFAULT_MIN_OVERAGE_MS, SENSITIVITY_LEVELS, isValidMinOverageMs, isValidSensitivity } from '../engine/services/PerformanceMonitor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Client process state
let pythonProcess: ChildProcess | null = null;
let clientStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
let clientLogs: string[] = [];
let activeClient: ClientConfig | null = null;
// Set by /stop before the process is killed, so the exit handler can tell a
// requested stop from a crash.
let stopRequested = false;

// Performance sensitivity levels - imported from PerformanceMonitor service
export type { PerformanceSensitivity };

// Client configurations (shape defined once in shared/types.ts)

/**
 * Drop invalid performance settings so the engine falls back to its defaults,
 * and say so in the log. Returns the same config object, mutated.
 */
export function sanitizeClientConfig(client: ClientConfig): ClientConfig {
  if (client.performanceSensitivity !== undefined && !isValidSensitivity(client.performanceSensitivity)) {
    console.warn(`[Server] Client '${client.id}': ignoring performanceSensitivity=${JSON.stringify(client.performanceSensitivity)} (expected one of ${SENSITIVITY_LEVELS.join(', ')}); using 'normal'`);
    delete client.performanceSensitivity;
  }
  if (client.performanceMinOverageMs !== undefined && !isValidMinOverageMs(client.performanceMinOverageMs)) {
    console.warn(`[Server] Client '${client.id}': ignoring performanceMinOverageMs=${JSON.stringify(client.performanceMinOverageMs)} (expected a number >= 0); using default ${DEFAULT_MIN_OVERAGE_MS}ms`);
    delete client.performanceMinOverageMs;
  }
  return client;
}

/**
 * Build the spawned client's environment. PERFECT_HEARTBEAT is only set when
 * the client config states it, so an inherited value is otherwise respected.
 */
export function buildClientEnv(client: Pick<ClientConfig, 'heartbeat'>, baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, PYTHONUNBUFFERED: '1' };
  if (client.heartbeat !== undefined) {
    env.PERFECT_HEARTBEAT = client.heartbeat ? '1' : '0';
  }
  return env;
}

interface ClientsConfig {
  clients: ClientConfig[];
}

let clientsConfig: ClientsConfig;
try {
  const configPath = path.join(__dirname, '../clients.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  clientsConfig = JSON.parse(configData);
  clientsConfig.clients.forEach(sanitizeClientConfig);
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
    if (selectedClient.heartbeat === false) {
      clientLogs.push('[Server] Heartbeat disabled: runs will not be failed automatically if the client crashes');
    }

    // Disarm the watchdog so a previous client's stale heartbeat can't fail
    // this client's runs. A managed client that crashed has already had its
    // runs failed by the exit handler below. (The watchdog is a single global
    // timestamp, so it cannot tell two clients' runs apart; a run left behind
    // by an external client is failed by the Stop button, not by this.)
    stopRequested = false;
    flowEngine.resetHeartbeat();

    // Resolve working directory relative to project root
    const workingDir = path.join(__dirname, '../..', selectedClient.workingDir);

    // Add -u flag for Python to ensure unbuffered output
    const commandArgs = selectedClient.command.includes('python')
      ? ['-u', ...selectedClient.args]
      : selectedClient.args;

    pythonProcess = spawn(selectedClient.command, commandArgs, {
      cwd: workingDir,
      env: buildClientEnv(selectedClient)
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

      // The server watched this process die. If nobody asked for it, fail the
      // runs it left behind right now instead of waiting on the heartbeat
      // watchdog (which a client with heartbeats off would never trigger).
      if (!stopRequested && flowEngine.hasActiveRuns()) {
        const reason = signal
          ? `Python client was killed (${signal})`
          : `Python client exited unexpectedly (code ${code})`;
        clientLogs.push(`[Server] ${reason}; failing its running flows`);
        flowEngine.failAllRunningFlows(reason, { includePending: true });
      }
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
    stopRequested = true;
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
