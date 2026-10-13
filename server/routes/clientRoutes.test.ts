import { describe, it, expect, afterAll, vi } from 'vitest';
import { sanitizeClientConfig } from './clientRoutes';
import { flowEngine } from '../engine/FlowEngine';

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
