import { describe, it, expect, afterAll, vi } from 'vitest';
import { EventEmitter } from 'events';
import express from 'express';
import request from 'supertest';
import workerRoutes, { buildWorkerEnv, sanitizeWorkerConfig } from './workerRoutes';
import { flowEngine } from '../engine/FlowEngine';

// Fake child process so the start route never launches Python.
const spawned: Array<EventEmitter & { kill: () => void; stdout: EventEmitter; stderr: EventEmitter; env?: NodeJS.ProcessEnv }> = [];
vi.mock('child_process', () => ({
  spawn: vi.fn((_cmd: string, _args: string[], opts: { env?: NodeJS.ProcessEnv }) => {
    const proc = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: () => {},
      env: opts.env,
    });
    spawned.push(proc);
    return proc;
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/worker', workerRoutes);

describe('buildWorkerEnv', () => {
  const base = { PATH: '/usr/bin', HOME: '/home/test' };

  it('always sets PYTHONUNBUFFERED and keeps the base environment', () => {
    const env = buildWorkerEnv({}, base);
    expect(env.PYTHONUNBUFFERED).toBe('1');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/test');
  });

  it('passes PERFECT_HEARTBEAT=0 when the worker disables heartbeats', () => {
    expect(buildWorkerEnv({ heartbeat: false }, base).PERFECT_HEARTBEAT).toBe('0');
  });

  it('passes PERFECT_HEARTBEAT=1 when the worker enables heartbeats', () => {
    expect(buildWorkerEnv({ heartbeat: true }, base).PERFECT_HEARTBEAT).toBe('1');
  });

  it('leaves an inherited PERFECT_HEARTBEAT alone when the worker does not set it', () => {
    expect(buildWorkerEnv({}, base).PERFECT_HEARTBEAT).toBeUndefined();
    expect(buildWorkerEnv({}, { ...base, PERFECT_HEARTBEAT: '0' }).PERFECT_HEARTBEAT).toBe('0');
  });

  it('lets the worker config override an inherited PERFECT_HEARTBEAT', () => {
    expect(buildWorkerEnv({ heartbeat: true }, { ...base, PERFECT_HEARTBEAT: '0' }).PERFECT_HEARTBEAT).toBe('1');
  });

  it('does not mutate the base environment', () => {
    const original = { ...base };
    buildWorkerEnv({ heartbeat: false }, base);
    expect(base).toEqual(original);
  });

});

describe('worker process lifecycle and the heartbeat watchdog', () => {
  const lastHeartbeat = () => (flowEngine as any).lastWorkerHeartbeat;

  it('disarms a stale heartbeat when a worker starts and nothing is running', async () => {
    flowEngine.updateHeartbeat();               // left over from a previous worker
    const res = await request(app).post('/api/worker/start').send({ workerId: 'perfect_example' });
    expect(res.body.success).toBe(true);
    expect(lastHeartbeat()).toBeNull();
  });

  it('fails the running flows immediately when the worker process dies without a stop request', async () => {
    await request(app).post('/api/worker/start').send({ workerId: 'perfect_example' });
    const flow = flowEngine.registerFlow({ name: 'Orphan', description: '', tasks: [{ name: 't1', estimatedTime: 100 }, { name: 't2', estimatedTime: 100 }] });
    const runId = flowEngine.createRun(flow.id)!;
    expect(flowEngine.getRun(runId)!.state).toBe('RUNNING');

    spawned[spawned.length - 1].emit('exit', null, 'SIGKILL');   // crash

    const run = flowEngine.getRun(runId)!;
    expect(run.state).toBe('FAILED');
    expect(run.tasks.every(t => t.state === 'FAILED')).toBe(true);   // pending tasks too
    expect(run.logs.some(l => l.includes('killed (SIGKILL)'))).toBe(true);
    const status = await request(app).get('/api/worker/status');
    expect(status.body.logs.some((l: string) => l.includes('failing its running flows'))).toBe(true);
  });

  it('does not touch runs when the process exits after a requested stop', async () => {
    await request(app).post('/api/worker/start').send({ workerId: 'perfect_example' });
    const flow = flowEngine.registerFlow({ name: 'Stopped', description: '', tasks: [{ name: 't', estimatedTime: 100 }] });
    const runId = flowEngine.createRun(flow.id)!;

    await request(app).post('/api/worker/stop');                 // /stop fails the run itself ...
    const afterStop = flowEngine.getRun(runId)!;
    expect(afterStop.state).toBe('FAILED');
    expect(afterStop.logs.some(l => l.includes('User stopped the worker'))).toBe(true);

    spawned[spawned.length - 1].emit('exit', null, 'SIGTERM');   // ... and the exit that follows adds nothing
    expect(flowEngine.getRun(runId)!.logs.some(l => l.includes('killed'))).toBe(false);
  });

  it('a clean exit with nothing running is harmless', async () => {
    await request(app).post('/api/worker/start').send({ workerId: 'perfect_example' });
    expect(() => spawned[spawned.length - 1].emit('exit', 0, null)).not.toThrow();
    expect(flowEngine.hasActiveRuns()).toBe(false);
  });

  it('keeps the watchdog armed when the worker process exits, so a crash is still detected', () => {
    const proc = spawned[spawned.length - 1];
    flowEngine.updateHeartbeat();               // the running worker sent heartbeats
    proc.emit('exit', null, 'SIGKILL');         // then it crashed
    expect(lastHeartbeat()).not.toBeNull();
  });

  afterAll(() => {
    flowEngine.resetHeartbeat();
  });
});

const base = {
  id: 'c1',
  name: 'Worker',
  description: '',
  workingDir: '.',
  command: 'python3',
  args: [] as string[],
};

describe('sanitizeWorkerConfig', () => {
  it('keeps a valid performanceMinOverageMs', () => {
    expect(sanitizeWorkerConfig({ ...base, performanceMinOverageMs: 500 }).performanceMinOverageMs).toBe(500);
    expect(sanitizeWorkerConfig({ ...base, performanceMinOverageMs: 0 }).performanceMinOverageMs).toBe(0);
  });

  it('leaves the field absent when not set', () => {
    expect('performanceMinOverageMs' in sanitizeWorkerConfig({ ...base })).toBe(false);
  });

  it('keeps a valid performanceSensitivity and drops an unknown one with a warning', () => {
    expect(sanitizeWorkerConfig({ ...base, performanceSensitivity: 'aggressive' }).performanceSensitivity).toBe('aggressive');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const worker = sanitizeWorkerConfig({ ...base, performanceSensitivity: 'high' as any });
    expect(worker.performanceSensitivity).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('performanceSensitivity');
    warn.mockRestore();
  });

  it('drops an invalid value and warns, so the engine uses the default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of [-1, NaN, '1000', null, true]) {
      const worker = sanitizeWorkerConfig({ ...base, performanceMinOverageMs: bad as any });
      expect(worker.performanceMinOverageMs).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls[0][0]).toContain("Worker 'c1'");
    warn.mockRestore();
  });
});

// Importing workerRoutes creates the FlowEngine singleton; stop its intervals.
afterAll(() => {
  flowEngine.destroy();
});
