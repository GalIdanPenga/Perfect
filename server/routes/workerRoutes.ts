import express from 'express';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { flowEngine } from '../engine/FlowEngine';
import { WorkerConfig } from '../types';
import { PerformanceSensitivity, DEFAULT_MIN_OVERAGE_MS, SENSITIVITY_LEVELS, isValidMinOverageMs, isValidSensitivity } from '../engine/services/PerformanceMonitor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Worker process state
let pythonProcess: ChildProcess | null = null;
let workerStatus: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';
let workerLogs: string[] = [];
let activeWorker: WorkerConfig | null = null;
// Set by /stop before the process is killed, so the exit handler can tell a
// requested stop from a crash.
let stopRequested = false;

// Performance sensitivity levels - imported from PerformanceMonitor service
export type { PerformanceSensitivity };

// Worker configurations (shape defined once in shared/types.ts)

/**
 * Drop invalid performance settings so the engine falls back to its defaults,
 * and say so in the log. Returns the same config object, mutated.
 */
export function sanitizeWorkerConfig(worker: WorkerConfig): WorkerConfig {
  if (worker.performanceSensitivity !== undefined && !isValidSensitivity(worker.performanceSensitivity)) {
    console.warn(`[Server] Worker '${worker.id}': ignoring performanceSensitivity=${JSON.stringify(worker.performanceSensitivity)} (expected one of ${SENSITIVITY_LEVELS.join(', ')}); using 'normal'`);
    delete worker.performanceSensitivity;
  }
  if (worker.performanceMinOverageMs !== undefined && !isValidMinOverageMs(worker.performanceMinOverageMs)) {
    console.warn(`[Server] Worker '${worker.id}': ignoring performanceMinOverageMs=${JSON.stringify(worker.performanceMinOverageMs)} (expected a number >= 0); using default ${DEFAULT_MIN_OVERAGE_MS}ms`);
    delete worker.performanceMinOverageMs;
  }
  return worker;
}

/**
 * Build the spawned worker's environment. PERFECT_HEARTBEAT is only set when
 * the worker config states it, so an inherited value is otherwise respected.
 */
export function buildWorkerEnv(worker: Pick<WorkerConfig, 'heartbeat'>, baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, PYTHONUNBUFFERED: '1' };
  if (worker.heartbeat !== undefined) {
    env.PERFECT_HEARTBEAT = worker.heartbeat ? '1' : '0';
  }
  return env;
}

interface WorkersConfig {
  workers: WorkerConfig[];
}

let workersConfig: WorkersConfig;
try {
  const configPath = path.join(__dirname, '../workers.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  workersConfig = JSON.parse(configData);
  workersConfig.workers.forEach(sanitizeWorkerConfig);
  console.log(`[Server] Loaded ${workersConfig.workers.length} worker configurations`);
} catch (error) {
  console.error('[Server] Failed to load workers.json, using default config');
  workersConfig = {
    workers: [
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
 * GET /api/worker/configs
 * Get available worker configurations
 */
router.get('/configs', (req, res) => {
  res.json(workersConfig);
});

/**
 * GET /api/worker/status
 * Get current worker status and recent logs
 */
router.get('/status', (req, res) => {
  res.json({
    status: workerStatus,
    logs: workerLogs.slice(-50),
    activeWorker: activeWorker
  });
});

/**
 * POST /api/worker/start
 * Start the worker process
 */
router.post('/start', (req, res) => {
  if (pythonProcess) {
    return res.json({
      success: false,
      message: 'Worker is already running',
      status: workerStatus
    });
  }

  try {
    // Get worker ID from request body, default to first worker
    // Accept the legacy field name too
    const workerId = req.body.workerId ?? req.body.clientId;
    const selectedWorker = workersConfig.workers.find(c => c.id === workerId) || workersConfig.workers[0];

    activeWorker = selectedWorker;
    workerStatus = 'starting';
    workerLogs = [];
    workerLogs.push(`[Server] Starting worker: ${selectedWorker.name}...`);
    workerLogs.push(`[Server] Working directory: ${selectedWorker.workingDir}`);
    workerLogs.push(`[Server] Command: ${selectedWorker.command} ${selectedWorker.args.join(' ')}`);
    if (selectedWorker.heartbeat === false) {
      workerLogs.push('[Server] Heartbeat disabled: runs will not be failed automatically if the worker crashes');
    }

    // Disarm the watchdog so a previous worker's stale heartbeat can't fail
    // this worker's runs. A managed worker that crashed has already had its
    // runs failed by the exit handler below. (The watchdog is a single global
    // timestamp, so it cannot tell two workers' runs apart; a run left behind
    // by an external worker is failed by the Stop button, not by this.)
    stopRequested = false;
    flowEngine.resetHeartbeat();

    // Resolve working directory relative to project root
    const workingDir = path.join(__dirname, '../..', selectedWorker.workingDir);

    // Add -u flag for Python to ensure unbuffered output
    const commandArgs = selectedWorker.command.includes('python')
      ? ['-u', ...selectedWorker.args]
      : selectedWorker.args;

    pythonProcess = spawn(selectedWorker.command, commandArgs, {
      cwd: workingDir,
      env: buildWorkerEnv(selectedWorker)
    });

    pythonProcess.stdout?.on('data', (data) => {
      const log = data.toString().trim();
      workerLogs.push(log);
      console.log('[Worker]', log);
    });

    pythonProcess.stderr?.on('data', (data) => {
      const log = data.toString().trim();
      workerLogs.push(`[ERROR] ${log}`);
      console.error('[Worker Error]', log);
    });

    pythonProcess.on('spawn', () => {
      workerStatus = 'running';
      workerLogs.push('[Server] worker started successfully');
      console.log('[Server] worker process spawned');
    });

    pythonProcess.on('error', (error) => {
      workerStatus = 'error';
      workerLogs.push(`[Server] Failed to start worker: ${error.message}`);
      console.error('[Server] Failed to start worker:', error);
      pythonProcess = null;
    });

    pythonProcess.on('exit', (code, signal) => {
      const exitMsg = signal
        ? `[Server] worker stopped (signal: ${signal})`
        : `[Server] worker exited (code: ${code})`;

      workerLogs.push(exitMsg);
      console.log(exitMsg);

      workerStatus = 'stopped';
      pythonProcess = null;
      activeWorker = null;

      // The server watched this process die. If nobody asked for it, fail the
      // runs it left behind right now instead of waiting on the heartbeat
      // watchdog (which a worker with heartbeats off would never trigger).
      if (!stopRequested && flowEngine.hasActiveRuns()) {
        const reason = signal
          ? `worker was killed (${signal})`
          : `worker exited unexpectedly (code ${code})`;
        workerLogs.push(`[Server] ${reason}; failing its running flows`);
        flowEngine.failAllRunningFlows(reason, { includePending: true });
      }
    });

    res.json({
      success: true,
      message: 'worker starting...',
      status: workerStatus
    });

  } catch (error: any) {
    workerStatus = 'error';
    workerLogs.push(`[Server] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
      status: workerStatus
    });
  }
});

/**
 * POST /api/worker/stop
 * Stop the worker process and fail all running flows
 */
router.post('/stop', (req, res) => {
  if (!pythonProcess) {
    // Even if process is not running, ensure we clean up state
    workerStatus = 'stopped';
    activeWorker = null;
    flowEngine.failAllRunningFlows();
    return res.json({
      success: true,
      message: 'Worker already stopped',
      status: workerStatus
    });
  }

  try {
    workerLogs.push('[Server] Stopping worker...');

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
      message: 'worker stopping...',
      status: 'stopping'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
      status: workerStatus
    });
  }
});

// Export function to get active worker info
export function getActiveWorker(): WorkerConfig | null {
  return activeWorker;
}

export default router;
