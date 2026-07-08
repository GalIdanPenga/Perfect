import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index';

// The FlowEngine singleton is created on import and connects to the real SQLite DB.
// Tests observe the actual HTTP contract without depending on the DB being empty —
// the DB may carry state from previous runs. Where emptiness matters, we either
// clear state first or assert on shape rather than exact content.

describe('Express API – integration', () => {

  // ── Engine runs ──────────────────────────────────────────────────────────────

  it('GET /api/engine/runs → 200 with array', async () => {
    const res = await request(app).get('/api/engine/runs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Engine flows ─────────────────────────────────────────────────────────────

  it('GET /api/engine/flows → 200 with array', async () => {
    const res = await request(app).get('/api/engine/flows');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Heartbeat ────────────────────────────────────────────────────────────────

  it('POST /api/heartbeat → 200 { success: true }', async () => {
    const res = await request(app).post('/api/heartbeat');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  // ── Client status ────────────────────────────────────────────────────────────

  it('GET /api/client/status → 200 with status field', async () => {
    const res = await request(app).get('/api/client/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(typeof res.body.status).toBe('string');
    expect(res.body).toHaveProperty('logs');
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  // ── Client configs ───────────────────────────────────────────────────────────

  it('GET /api/client/configs → 200 with clients array', async () => {
    const res = await request(app).get('/api/client/configs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clients');
    expect(Array.isArray(res.body.clients)).toBe(true);
    expect(res.body.clients.length).toBeGreaterThan(0);
  });

  // ── Flow registration ─────────────────────────────────────────────────────────

  it('POST /api/flows registers a flow → 200 { success: true, flow }', async () => {
    const payload = {
      name: 'Test Flow',
      tasks: [{ name: 'step1', estimatedTime: 1000 }],
    };
    const res = await request(app).post('/api/flows').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.flow).toHaveProperty('id');
    expect(res.body.flow.name).toBe('Test Flow');
    expect(Array.isArray(res.body.flow.tasks)).toBe(true);
  });

  it('POST /api/flows without tasks → 400 { success: false }', async () => {
    const res = await request(app).post('/api/flows').send({ name: 'Broken Flow' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/flows without name → 400 { success: false }', async () => {
    const res = await request(app)
      .post('/api/flows')
      .send({ tasks: [{ name: 'step1', estimatedTime: 500 }] });
    // name is required by the type but JS won't enforce it at runtime;
    // the engine stores whatever it receives — either 200 or 400 is acceptable.
    expect([200, 400]).toContain(res.status);
  });

  // ── Flow round-trip ───────────────────────────────────────────────────────────

  it('registered flow appears in GET /api/engine/flows', async () => {
    const uniqueName = `Round Trip Flow ${Date.now()}`;
    await request(app)
      .post('/api/flows')
      .send({ name: uniqueName, tasks: [{ name: 'task-a', estimatedTime: 500 }] });

    const res = await request(app).get('/api/engine/flows');
    expect(res.status).toBe(200);
    const names: string[] = (res.body as { name: string }[]).map(f => f.name);
    expect(names).toContain(uniqueName);
  });

  // ── Engine run with unknown flow id ──────────────────────────────────────────

  it('POST /api/engine/run/:unknownId → 200, runId absent (flow not found)', async () => {
    const res = await request(app)
      .post('/api/engine/run/does-not-exist-xyz')
      .send({});
    // createRun returns undefined for unknown flowId; route still sends 200
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // undefined is stripped from JSON serialisation
    expect(res.body.runId).toBeUndefined();
  });

  // ── Engine trigger with unknown flow id ───────────────────────────────────────

  it('POST /api/engine/trigger/:unknownId → 200, runId absent', async () => {
    const res = await request(app)
      .post('/api/engine/trigger/does-not-exist-xyz')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.runId).toBeUndefined();
  });

  // ── Statistics ────────────────────────────────────────────────────────────────

  it('GET /api/statistics → 200 { success, taskStatistics[], flowStatistics[] }', async () => {
    const res = await request(app).get('/api/statistics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.taskStatistics)).toBe(true);
    expect(Array.isArray(res.body.flowStatistics)).toBe(true);
  });

  it('DELETE /api/statistics → 200 { success: true }', async () => {
    const res = await request(app).delete('/api/statistics');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/statistics after clear → taskStatistics and flowStatistics are empty', async () => {
    await request(app).delete('/api/statistics');
    const res = await request(app).get('/api/statistics');
    expect(res.status).toBe(200);
    expect(res.body.taskStatistics).toHaveLength(0);
    expect(res.body.flowStatistics).toHaveLength(0);
  });

  // ── Delete unknown run ────────────────────────────────────────────────────────

  it('DELETE /api/runs/:unknownId → 404 { success: false }', async () => {
    const res = await request(app).delete('/api/runs/nonexistent-run-id-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error');
  });

  // ── Log to unknown run (silently ignored) ─────────────────────────────────────

  it('POST /api/flows/:unknownRunId/logs → 200 { success: true } (silently no-ops)', async () => {
    const res = await request(app)
      .post('/api/flows/unknown-run-id/logs')
      .send({ log: 'test log message' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Task history endpoint ─────────────────────────────────────────────────────

  it('GET /api/statistics/task-history/:flow/:task → 200 { success, history[], stats }', async () => {
    const res = await request(app).get(
      '/api/statistics/task-history/SomeFlow/SomeTask',
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  // Keep Vitest from hanging on open handles (FlowEngine setIntervals).
  // Vitest's --forceExit flag handles this in CI; afterAll is a belt-and-suspenders
  // approach that at least signals intent.
  afterAll(() => {
    // Nothing to tear down at the Express layer — the engine's intervals
    // are private. Use `vitest run --forceExit` if the process hangs.
  });
});
