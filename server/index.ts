import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import clientRoutes, { getActiveClient } from './routes/clientRoutes';
import engineRoutes from './routes/engineRoutes';
import { flowEngine } from './engine/FlowEngine';
import { statsDb } from './database/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static reports
app.use('/Reports', express.static(path.join(__dirname, '../Reports')));

app.use('/api/client', clientRoutes);
app.use('/api/engine', engineRoutes);

// Queue for pending execution requests
interface ExecutionRequest {
  run_id: string;
  flow_name: string;
  configuration: string;
}

const executionQueue: ExecutionRequest[] = [];
const pendingResponses: express.Response[] = [];

// Subscribe to flow trigger events from the engine
flowEngine.subscribeToFlowTriggers((runId: string, flowName: string, configuration: string) => {
  console.log(`[Server] Flow triggered: ${flowName} (run: ${runId})`);

  const executionRequest: ExecutionRequest = {
    run_id: runId,
    flow_name: flowName,
    configuration: configuration
  };

  // If there's a client waiting, respond immediately
  if (pendingResponses.length > 0) {
    const res = pendingResponses.shift();
    res?.json(executionRequest);
    console.log(`[Server] Sent execution request to waiting Python client`);
  } else {
    // Otherwise queue it for later
    executionQueue.push(executionRequest);
    console.log(`[Server] Queued execution request (queue size: ${executionQueue.length})`);
  }
});

// Legacy endpoints for Python client compatibility
app.post('/api/flows', (req, res) => {
  try {
    const { autoTrigger, autoTriggerConfig, ...flowData } = req.body;
    const flow = flowEngine.registerFlow(flowData);

    // Only auto-trigger if autoTrigger flag is explicitly true
    if (autoTrigger === true) {
      const config = autoTriggerConfig || 'development';
      const activeClient = getActiveClient();
      const clientColor = activeClient?.color;
      const clientName = activeClient?.name;
      console.log(`[Server] Auto-triggering flow '${flow.name}' with config: ${config}${clientColor ? ` and client color: ${clientColor}` : ''}${clientName ? ` for client: ${clientName}` : ''}`);
      flowEngine.triggerFlow(flow.id, config, clientColor, clientName);
    } else {
      console.log(`[Server] Registered flow '${flow.name}' without auto-triggering (autoTrigger=${autoTrigger})`);
    }

    res.json({ success: true, flow });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/flows/:runId/logs', (req, res) => {
  try {
    const { runId } = req.params;
    const { log } = req.body;
    flowEngine.addFlowLog(runId, log);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Task state update endpoint
app.post('/api/runs/:runId/tasks/:taskIndex/state', (req, res) => {
  try {
    const { runId, taskIndex } = req.params;
    const { state, progress, durationMs, result, taskName, estimatedTime, crucialPass } = req.body;

    const success = flowEngine.updateTaskState(runId, parseInt(taskIndex), state, progress, durationMs, result, taskName, estimatedTime, crucialPass);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Run or task not found' });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Flow completion endpoint - signals that client finished executing a flow
app.post('/api/runs/:runId/complete', (req, res) => {
  try {
    const { runId } = req.params;
    const { taskCount } = req.body;

    const success = flowEngine.completeFlow(runId, taskCount);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Run not found' });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Heartbeat endpoint for Python client to signal it's alive
app.post('/api/heartbeat', (req, res) => {
  flowEngine.updateHeartbeat();
  res.json({ success: true });
});

// Delete a run from history
app.delete('/api/runs/:runId', (req, res) => {
  try {
    const { runId } = req.params;
    const success = flowEngine.deleteRun(runId);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Run not found or is currently running' });
    }
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get statistics endpoint
app.get('/api/statistics', (req, res) => {
  try {
    const taskStatistics = statsDb.getAllStats();
    const flowStatistics = statsDb.getAllFlowStats();
    res.json({ success: true, taskStatistics, flowStatistics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get task history endpoint (for time-series chart)
app.get('/api/statistics/task-history/:flowName/:taskName', (req, res) => {
  try {
    const { flowName, taskName } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const history = statsDb.getTaskHistory(decodeURIComponent(flowName), decodeURIComponent(taskName), limit);
    const stats = statsDb.getTaskStats(decodeURIComponent(flowName), decodeURIComponent(taskName));
    res.json({ success: true, history, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get flow history endpoint (for time-series chart)
app.get('/api/statistics/flow-history/:flowName', (req, res) => {
  try {
    const { flowName } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const history = statsDb.getFlowHistory(decodeURIComponent(flowName), limit);
    const stats = statsDb.getAllFlowStats().find(s => s.flowName === decodeURIComponent(flowName));
    res.json({ success: true, history, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all statistics
app.delete('/api/statistics', (req, res) => {
  try {
    flowEngine.deleteAllStats();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Long-poll endpoint for Python client to receive execution requests
app.get('/api/execution-requests', (req, res) => {
  // Update heartbeat when client polls
  flowEngine.updateHeartbeat();

  // If there's a queued request, return it immediately
  if (executionQueue.length > 0) {
    const executionRequest = executionQueue.shift()!;
    res.json(executionRequest);
    console.log(`[Server] Sent queued execution request to Python client`);
  } else {
    // Otherwise, hold the connection for long-polling (30 seconds timeout)
    pendingResponses.push(res);

    const timeout = setTimeout(() => {
      const index = pendingResponses.indexOf(res);
      if (index > -1) {
        pendingResponses.splice(index, 1);
        res.json(null); // Return null to signal no work available
      }
    }, 30000); // 30 second long-poll timeout

    // Clean up timeout if client disconnects
    req.on('close', () => {
      clearTimeout(timeout);
      const index = pendingResponses.indexOf(res);
      if (index > -1) {
        pendingResponses.splice(index, 1);
      }
    });
  }
});

app.listen(PORT, () => {
  console.log('Perfect Backend Server running on http://localhost:' + PORT);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
