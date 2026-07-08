import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { FlowEngine } from './FlowEngine';
import { createDatabase } from '../database/db';
import { TaskState, FlowRegistrationPayload } from '../types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
//
// 1. reportGenerator – prevents FlowEngine from writing HTML files to disk
//    when flows complete or fail during tests.
// 2. clientRoutes – prevents the circular-import singleton from affecting
//    our isolated test engine and keeps getActiveClient() returning null.
// ---------------------------------------------------------------------------

vi.mock('../utils/reportGenerator', () => ({
  generateFlowReport: vi.fn().mockReturnValue(null),
  generateReportHTML: vi.fn().mockReturnValue('<html></html>'),
}));

vi.mock('../routes/clientRoutes', () => ({
  getActiveClient: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(name = 'TestFlow', taskCount = 2): FlowRegistrationPayload {
  return {
    name,
    description: 'Automated test flow',
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      name: `Task ${i + 1}`,
      estimatedTime: 1000,
    })),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('FlowEngine', () => {
  let engine: FlowEngine;

  // Install fake timers once for the whole suite so that the setInterval calls
  // inside the FlowEngine constructor never actually fire. Each test creates a
  // fresh in-memory engine; afterEach clears any pending fake timers and calls
  // destroy() to release the interval handles.
  beforeAll(() => {
    vi.useFakeTimers();
  });

  beforeEach(() => {
    const dbDeps = createDatabase(':memory:');
    engine = new FlowEngine(false, dbDeps);
  });

  afterEach(() => {
    vi.clearAllTimers();
    engine.destroy();
  });

  // ── registerFlow ───────────────────────────────────────────────────────────

  describe('registerFlow', () => {
    it('adds the flow to getFlows() and returns the definition', () => {
      const flow = engine.registerFlow(makePayload('MyFlow'));
      const flows = engine.getFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0].id).toBe(flow.id);
      expect(flows[0].name).toBe('MyFlow');
    });

    it('sets a non-empty id and a valid ISO createdAt timestamp', () => {
      const flow = engine.registerFlow(makePayload());
      expect(flow.id).toBeTruthy();
      expect(typeof flow.id).toBe('string');
      expect(new Date(flow.createdAt).getTime()).not.toBeNaN();
    });

    it('task weights sum to approximately 1.0 (proportional to estimatedTime)', () => {
      const flow = engine.registerFlow(makePayload('WeightFlow', 3));
      const total = flow.tasks.reduce((sum, t) => sum + t.weight, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('defaults crucialPass to true when the payload omits it', () => {
      const flow = engine.registerFlow({
        name: 'CrucialTest',
        description: '',
        tasks: [{ name: 'Task', estimatedTime: 1000 }],
      });
      expect(flow.tasks[0].crucialPass).toBe(true);
    });

    it('preserves explicit crucialPass: false on a task', () => {
      const flow = engine.registerFlow({
        name: 'NonCrucialTest',
        description: '',
        tasks: [{ name: 'Task', estimatedTime: 1000, crucialPass: false }],
      });
      expect(flow.tasks[0].crucialPass).toBe(false);
    });
  });

  // ── createRun ──────────────────────────────────────────────────────────────

  describe('createRun', () => {
    it('returns a string run ID for a known flowId', () => {
      const flow = engine.registerFlow(makePayload());
      const runId = engine.createRun(flow.id);
      expect(typeof runId).toBe('string');
      expect(runId).toBeTruthy();
    });

    it('adds the run to getRuns() with RUNNING state', () => {
      const flow = engine.registerFlow(makePayload());
      const runId = engine.createRun(flow.id)!;
      const run = engine.getRuns().find(r => r.id === runId);
      expect(run).toBeDefined();
      expect(run!.state).toBe(TaskState.RUNNING);
    });

    it('removes the flow from getFlows() after the run is created', () => {
      const flow = engine.registerFlow(makePayload());
      engine.createRun(flow.id);
      expect(engine.getFlows().find(f => f.id === flow.id)).toBeUndefined();
    });

    it('returns undefined for an unknown flowId', () => {
      expect(engine.createRun('no-such-flow-id')).toBeUndefined();
    });
  });

  // ── updateTaskState ────────────────────────────────────────────────────────

  describe('updateTaskState', () => {
    let runId: string;

    beforeEach(() => {
      // Flow with 2 tasks so index 2 is safely beyond the pre-existing array.
      const flow = engine.registerFlow(makePayload('UpdateFlow', 2));
      runId = engine.createRun(flow.id)!;
    });

    it('sets task.startTime when transitioning to RUNNING', () => {
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.tasks[0].startTime).toBeTruthy();
    });

    it('sets task.endTime and state=COMPLETED when transitioning to COMPLETED', () => {
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.COMPLETED);
      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.tasks[0].state).toBe(TaskState.COMPLETED);
      expect(run.tasks[0].endTime).toBeTruthy();
    });

    it('sets task.state to FAILED and returns true', () => {
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      const result = engine.updateTaskState(runId, 0, TaskState.FAILED);
      expect(result).toBe(true);
      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.tasks[0].state).toBe(TaskState.FAILED);
    });

    it('returns false when trying to transition out of COMPLETED (terminal guard)', () => {
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.COMPLETED);
      const result = engine.updateTaskState(runId, 0, TaskState.RUNNING);
      expect(result).toBe(false);
    });

    it('returns false when trying to transition out of FAILED (terminal guard)', () => {
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.FAILED);
      const result = engine.updateTaskState(runId, 0, TaskState.RUNNING);
      expect(result).toBe(false);
    });

    it('dynamically creates a task for a taskIndex beyond the current task list', () => {
      // Index 2 is one past the two tasks the flow registered.
      // The while-loop fill only runs once, so there are no duplicate IDs.
      const result = engine.updateTaskState(
        runId, 2, TaskState.RUNNING,
        undefined, undefined, undefined, 'DynamicTask'
      );
      expect(result).toBe(true);
      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.tasks[2]).toBeDefined();
      expect(run.tasks[2].taskName).toBe('DynamicTask');
    });

    it('returns false for an unknown runId', () => {
      expect(engine.updateTaskState('no-such-run', 0, TaskState.RUNNING)).toBe(false);
    });
  });

  // ── completeFlow ───────────────────────────────────────────────────────────

  describe('completeFlow', () => {
    it('sets run.state to COMPLETED when all tasks finished successfully', () => {
      const flow = engine.registerFlow(makePayload('CompleteFlow', 1));
      const runId = engine.createRun(flow.id)!;

      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.COMPLETED);
      engine.completeFlow(runId, 1);

      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.state).toBe(TaskState.COMPLETED);
    });

    it('sets run.state to FAILED when a crucial task has failed', () => {
      const flow = engine.registerFlow(makePayload('FailFlow', 1));
      const runId = engine.createRun(flow.id)!;

      // Tasks without an explicit crucialPass in the TaskRun are treated as
      // crucial because the guard is `crucialPass !== false` (undefined passes).
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.FAILED);
      engine.completeFlow(runId, 1);

      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.state).toBe(TaskState.FAILED);
    });

    it('returns false for a non-existent runId', () => {
      expect(engine.completeFlow('no-such-run', 0)).toBe(false);
    });
  });

  // ── subscribe (state-change pub/sub) ───────────────────────────────────────

  describe('subscribe', () => {
    it('calls the listener when task state changes', () => {
      const flow = engine.registerFlow(makePayload('PubSubFlow', 1));
      const runId = engine.createRun(flow.id)!;

      // Subscribe after setup so we only capture the updateTaskState notification.
      const listener = vi.fn();
      engine.subscribe(listener);

      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      expect(listener).toHaveBeenCalled();
    });

    it('stops calling the listener after the returned unsubscribe is invoked', () => {
      const flow = engine.registerFlow(makePayload('UnsubFlow', 1));
      const runId = engine.createRun(flow.id)!;

      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);
      unsubscribe();

      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── subscribeToFlowTriggers ────────────────────────────────────────────────

  describe('subscribeToFlowTriggers', () => {
    it('calls the trigger listener with (runId, flowName, configuration) when triggerFlow is called', () => {
      const triggerListener = vi.fn();
      engine.subscribeToFlowTriggers(triggerListener);
      const flow = engine.registerFlow(makePayload('TriggerFlow', 1));

      engine.triggerFlow(flow.id, 'staging');

      expect(triggerListener).toHaveBeenCalledTimes(1);
      const [calledRunId, calledFlowName, calledConfig] = triggerListener.mock.calls[0];
      expect(typeof calledRunId).toBe('string');
      expect(calledFlowName).toBe('TriggerFlow');
      expect(calledConfig).toBe('staging');
    });

    it('does NOT call the trigger listener when createRun is used instead of triggerFlow', () => {
      const triggerListener = vi.fn();
      engine.subscribeToFlowTriggers(triggerListener);
      const flow = engine.registerFlow(makePayload('CreateRunFlow', 1));

      engine.createRun(flow.id);

      expect(triggerListener).not.toHaveBeenCalled();
    });
  });

  // ── deleteRun ──────────────────────────────────────────────────────────────

  describe('deleteRun', () => {
    it('returns true and removes a COMPLETED run from getRuns()', () => {
      const flow = engine.registerFlow(makePayload('DeleteFlow', 1));
      const runId = engine.createRun(flow.id)!;
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.COMPLETED);
      engine.completeFlow(runId, 1);

      expect(engine.deleteRun(runId)).toBe(true);
      expect(engine.getRuns().find(r => r.id === runId)).toBeUndefined();
    });

    it('returns false and keeps a RUNNING run in getRuns()', () => {
      const flow = engine.registerFlow(makePayload('RunningFlow', 1));
      const runId = engine.createRun(flow.id)!;

      expect(engine.deleteRun(runId)).toBe(false);
      expect(engine.getRuns().find(r => r.id === runId)).toBeDefined();
    });

    it('returns false for an unknown runId', () => {
      expect(engine.deleteRun('no-such-run')).toBe(false);
    });
  });

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  //
  // checkHeartbeat() is private, but at JS runtime there are no access
  // modifiers. We call it directly via `(engine as any)` to keep the tests
  // fast and deterministic (no need to fire 100-ms tick intervals).
  // vi.setSystemTime() shifts Date.now() without firing interval callbacks.

  describe('heartbeat', () => {
    it('is a no-op when no heartbeat has ever been received (null initial state)', () => {
      const flow = engine.registerFlow(makePayload('NoHeartbeatFlow', 1));
      const runId = engine.createRun(flow.id)!;

      // lastClientHeartbeat is null – checkHeartbeat should return early.
      (engine as any).checkHeartbeat();

      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.state).toBe(TaskState.RUNNING);
    });

    it('fails running flows once the heartbeat timeout elapses after a recorded heartbeat', () => {
      const flow = engine.registerFlow(makePayload('HeartbeatFlow', 1));
      const runId = engine.createRun(flow.id)!;

      engine.updateHeartbeat();                    // records T = Date.now()
      vi.setSystemTime(Date.now() + 11_000);       // jump clock: timeSinceLastHeartbeat = 11 s
      (engine as any).checkHeartbeat();            // 11 000 > HEARTBEAT_TIMEOUT_MS (10 000) → fail

      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.state).toBe(TaskState.FAILED);
    });
  });

  // ── failAllRunningFlows ────────────────────────────────────────────────────

  describe('failAllRunningFlows', () => {
    it('marks all RUNNING flows as FAILED', () => {
      const flow1 = engine.registerFlow(makePayload('Flow1', 1));
      const flow2 = engine.registerFlow(makePayload('Flow2', 1));
      const runId1 = engine.createRun(flow1.id)!;
      const runId2 = engine.createRun(flow2.id)!;

      engine.failAllRunningFlows();

      const runs = engine.getRuns();
      expect(runs.find(r => r.id === runId1)!.state).toBe(TaskState.FAILED);
      expect(runs.find(r => r.id === runId2)!.state).toBe(TaskState.FAILED);
    });

    it('leaves already-COMPLETED runs unchanged', () => {
      const flow = engine.registerFlow(makePayload('AlreadyDone', 1));
      const runId = engine.createRun(flow.id)!;
      engine.updateTaskState(runId, 0, TaskState.RUNNING);
      engine.updateTaskState(runId, 0, TaskState.COMPLETED);
      engine.completeFlow(runId, 1);

      engine.failAllRunningFlows();

      const run = engine.getRuns().find(r => r.id === runId)!;
      expect(run.state).toBe(TaskState.COMPLETED);
    });
  });
});
