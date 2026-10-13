import { describe, it, expect, afterAll, vi } from 'vitest';
import { EventEmitter } from 'events';
import express from 'express';
import request from 'supertest';
import clientRoutes, { buildClientEnv, sanitizeClientConfig } from './clientRoutes';
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
app.use('/api/client', clientRoutes);

describe('buildClientEnv', () => {
  const base = { PATH: '/usr/bin', HOME: '/home/test' };

  it('always sets PYTHONUNBUFFERED and keeps the base environment', () => {
    const env = buildClientEnv({}, base);
    expect(env.PYTHONUNBUFFERED).toBe('1');
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/test');
  });

  it('passes PERFECT_HEARTBEAT=0 when the client disables heartbeats', () => {
    expect(buildClientEnv({ heartbeat: false }, base).PERFECT_HEARTBEAT).toBe('0');
  });

  it('passes PERFECT_HEARTBEAT=1 when the client enables heartbeats', () => {
    expect(buildClientEnv({ heartbeat: true }, base).PERFECT_HEARTBEAT).toBe('1');
  });

  it('leaves an inherited PERFECT_HEARTBEAT alone when the client does not set it', () => {
    expect(buildClientEnv({}, base).PERFECT_HEARTBEAT).toBeUndefined();
    expect(buildClientEnv({}, { ...base, PERFECT_HEARTBEAT: '0' }).PERFECT_HEARTBEAT).toBe('0');
  });

  it('lets the client config override an inherited PERFECT_HEARTBEAT', () => {
    expect(buildClientEnv({ heartbeat: true }, { ...base, PERFECT_HEARTBEAT: '0' }).PERFECT_HEARTBEAT).toBe('1');
  });

  it('does not mutate the base environment', () => {
    const original = { ...base };
    buildClientEnv({ heartbeat: false }, base);
    expect(base).toEqual(original);
  });

});

describe('client process lifecycle and the heartbeat watchdog', () => {
  const lastHeartbeat = () => (flowEngine as any).lastClientHeartbeat;

  it('disarms a stale heartbeat when a client starts and nothing is running', async () => {
    flowEngine.updateHeartbeat();               // left over from a previous client
    const res = await request(app).post('/api/client/start').send({ clientId: 'perfect_example' });
    expect(res.body.success).toBe(true);
    expect(lastHeartbeat()).toBeNull();
  });

  it('keeps the watchdog armed on start while a previous client\'s runs are still active', async () => {
    // Client A crashed mid-run; its heartbeat is stale and its run is still RUNNING.
    const flow = flowEngine.registerFlow({ name: 'Orphan', description: '', tasks: [{ name: 't', estimatedTime: 100 }] });
    const runId = flowEngine.createRun(flow.id)!;
    flowEngine.updateHeartbeat();
    spawned[spawned.length - 1].emit('exit', null, 'SIGKILL');

    // User starts client B within the 10s window.
    const res = await request(app).post('/api/client/start').send({ clientId: 'perfect_example' });
    expect(res.body.success).toBe(true);
    expect(lastHeartbeat()).not.toBeNull();   // pending timeout survives, so A's run will be failed

    flowEngine.failAllRunningFlows();
    expect(flowEngine.getRun(runId)!.state).toBe('FAILED');
    spawned[spawned.length - 1].emit('exit', null, 'SIGTERM');
  });

  it('keeps the watchdog armed when the client process exits, so a crash is still detected', () => {
    const proc = spawned[spawned.length - 1];
    flowEngine.updateHeartbeat();               // the running client sent heartbeats
    proc.emit('exit', null, 'SIGKILL');         // then it crashed
    expect(lastHeartbeat()).not.toBeNull();
  });

  afterAll(() => {
    flowEngine.resetHeartbeat();
  });
});

const base = {
  id: 'c1',
  name: 'Client',
  description: '',
  workingDir: '.',
  command: 'python3',
  args: [] as string[],
};

describe('sanitizeClientConfig', () => {
  it('keeps a valid performanceMinOverageMs', () => {
    expect(sanitizeClientConfig({ ...base, performanceMinOverageMs: 500 }).performanceMinOverageMs).toBe(500);
    expect(sanitizeClientConfig({ ...base, performanceMinOverageMs: 0 }).performanceMinOverageMs).toBe(0);
  });

  it('leaves the field absent when not set', () => {
    expect('performanceMinOverageMs' in sanitizeClientConfig({ ...base })).toBe(false);
  });

  it('keeps a valid performanceSensitivity and drops an unknown one with a warning', () => {
    expect(sanitizeClientConfig({ ...base, performanceSensitivity: 'aggressive' }).performanceSensitivity).toBe('aggressive');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = sanitizeClientConfig({ ...base, performanceSensitivity: 'high' as any });
    expect(client.performanceSensitivity).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('performanceSensitivity');
    warn.mockRestore();
  });

  it('drops an invalid value and warns, so the engine uses the default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of [-1, NaN, '1000', null, true]) {
      const client = sanitizeClientConfig({ ...base, performanceMinOverageMs: bad as any });
      expect(client.performanceMinOverageMs).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls[0][0]).toContain("Client 'c1'");
    warn.mockRestore();
  });
});

// Importing clientRoutes creates the FlowEngine singleton; stop its intervals.
afterAll(() => {
  flowEngine.destroy();
});
