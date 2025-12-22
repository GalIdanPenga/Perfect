import express from 'express';
import { flowEngine } from '../engine/FlowEngine';
import { getActiveClient } from './clientRoutes';

const router = express.Router();

/**
 * GET /api/engine/flows
 * Get all registered flow definitions
 */
router.get('/flows', (req, res) => {
  try {
    const flows = flowEngine.getFlows();
    res.json(flows);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/engine/runs
 * Get all flow runs
 */
router.get('/runs', (req, res) => {
  try {
    const runs = flowEngine.getRuns();
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engine/trigger/:flowId
 * Trigger a flow execution (server-initiated, sends execution request to clients)
 */
router.post('/trigger/:flowId', (req, res) => {
  try {
    const { flowId } = req.params;
    const { configuration } = req.body;
    const activeClient = getActiveClient();
    const clientColor = activeClient?.color;
    const clientName = activeClient?.name;
    const runId = flowEngine.triggerFlow(flowId, configuration || 'development', clientColor, clientName);
    res.json({ success: true, runId });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/engine/run/:flowId
 * Create a run for client-initiated execution (no execution request sent)
 */
router.post('/run/:flowId', (req, res) => {
  try {
    const { flowId } = req.params;
    const { configuration } = req.body;
    const activeClient = getActiveClient();
    const clientColor = activeClient?.color;
    const clientName = activeClient?.name;
    const runId = flowEngine.createRun(flowId, configuration || 'development', clientColor, clientName);
    res.json({ success: true, runId });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows
 * Register a new flow (called by Python clients)
 */
router.post('/register', (req, res) => {
  try {
    const flow = flowEngine.registerFlow(req.body);
    res.json({ success: true, flow });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/flows/:runId/logs
 * Add a log message to a running flow (called by Python clients)
 */
router.post('/runs/:runId/logs', (req, res) => {
  try {
    const { runId } = req.params;
    const { log } = req.body;

    flowEngine.addFlowLog(runId, log);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
