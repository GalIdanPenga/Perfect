import { describe, it, expect, afterAll, vi } from 'vitest';
import { EventEmitter } from 'events';
import express from 'express';
import request from 'supertest';
import clientRoutes, { buildClientEnv } from './clientRoutes';
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

  it('disarms a stale heartbeat when a client starts', async () => {
    flowEngine.updateHeartbeat();               // left over from a previous client
    const res = await request(app).post('/api/client/start').send({ clientId: 'perfect_example' });
    expect(res.body.success).toBe(true);
    expect(lastHeartbeat()).toBeNull();
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

// Importing clientRoutes creates the FlowEngine singleton; stop its intervals.
afterAll(() => {
  flowEngine.destroy();
});
