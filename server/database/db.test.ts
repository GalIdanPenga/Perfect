import { describe, it, expect, test, beforeEach } from 'vitest'
import { createDatabase } from '../database/db'
import { TaskState, type FlowDefinition, type FlowRun } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlowDefinition(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
  return {
    id: 'flow-1',
    name: 'Test Flow',
    description: 'A flow used in tests',
    codeSnippet: '// test',
    tags: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    tasks: [],
    ...overrides,
  }
}

function makeFlowRun(overrides: Partial<FlowRun> = {}): FlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    flowName: 'TestFlow',
    state: TaskState.COMPLETED,
    startTime: '2024-01-01T00:00:00.000Z',
    endTime: '2024-01-01T00:05:00.000Z',
    configuration: 'prod',
    tags: { version: '1.0' },
    logs: ['started', 'finished'],
    progress: 1.0,
    clientColor: '#ff0000',
    tasks: [
      {
        id: 'tr-1',
        taskId: 'task-1',
        taskName: 'Load Data',
        state: TaskState.COMPLETED,
        startTime: '2024-01-01T00:00:01.000Z',
        endTime: '2024-01-01T00:04:59.000Z',
        durationMs: 298000,
        logs: ['data loaded'],
        weight: 1,
        estimatedTime: 300000,
        progress: 1.0,
        crucialPass: true,
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createDatabase factory
// ---------------------------------------------------------------------------

describe('createDatabase', () => {
  it('returns flowDb, runDb, and statsDb', () => {
    const { flowDb, runDb, statsDb } = createDatabase(':memory:')
    expect(flowDb).toBeDefined()
    expect(runDb).toBeDefined()
    expect(statsDb).toBeDefined()
  })

  it('each call returns completely separate instances', () => {
    const db1 = createDatabase(':memory:')
    const db2 = createDatabase(':memory:')

    db1.statsDb.updateTaskStats('myFlow', 'taskA', 1000)

    // db2 must be unaffected
    expect(db2.statsDb.getTaskStats('myFlow', 'taskA')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// statsDb — task stats (Welford online algorithm)
// ---------------------------------------------------------------------------

describe('statsDb — updateTaskStats / getTaskStats', () => {
  let statsDb: ReturnType<typeof createDatabase>['statsDb']

  beforeEach(() => {
    statsDb = createDatabase(':memory:').statsDb
  })

  it('first insert: avg=duration, sampleCount=1, stdDev=0', () => {
    statsDb.updateTaskStats('myFlow', 'taskA', 500)
    const stats = statsDb.getTaskStats('myFlow', 'taskA')
    expect(stats).toBeDefined()
    expect(stats!.avgDurationMs).toBe(500)
    expect(stats!.sampleCount).toBe(1)
    expect(stats!.stdDevDurationMs).toBe(0)
  })

  it('two inserts: avg=(d1+d2)/2, sampleCount=2, stdDev correct', () => {
    statsDb.updateTaskStats('myFlow', 'taskA', 100)
    statsDb.updateTaskStats('myFlow', 'taskA', 200)
    const stats = statsDb.getTaskStats('myFlow', 'taskA')!

    expect(stats.sampleCount).toBe(2)
    expect(stats.avgDurationMs).toBeCloseTo(150, 5)
    // sample stdDev = sqrt(((100-150)^2 + (200-150)^2) / 1) = sqrt(5000)
    expect(stats.stdDevDurationMs).toBeCloseTo(Math.sqrt(5000), 5)
  })

  it('three inserts: avg=(a+b+c)/3, sampleCount=3, stdDev correct', () => {
    statsDb.updateTaskStats('myFlow', 'taskA', 100)
    statsDb.updateTaskStats('myFlow', 'taskA', 200)
    statsDb.updateTaskStats('myFlow', 'taskA', 300)
    const stats = statsDb.getTaskStats('myFlow', 'taskA')!

    expect(stats.sampleCount).toBe(3)
    expect(stats.avgDurationMs).toBeCloseTo(200, 5)
    // sample stdDev = sqrt(((100-200)^2 + 0 + (300-200)^2) / 2) = sqrt(10000) = 100
    expect(stats.stdDevDurationMs).toBeCloseTo(100, 5)
  })

  it('getTaskStats returns undefined for a missing entry', () => {
    expect(statsDb.getTaskStats('noFlow', 'noTask')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// statsDb — flow stats (Welford online algorithm)
// ---------------------------------------------------------------------------

describe('statsDb — updateFlowStats / getFlowStatsForFlow', () => {
  let statsDb: ReturnType<typeof createDatabase>['statsDb']

  beforeEach(() => {
    statsDb = createDatabase(':memory:').statsDb
  })

  it('first insert: avg=duration, sampleCount=1, stdDev=0', () => {
    statsDb.updateFlowStats('myFlow', 800)
    const stats = statsDb.getFlowStatsForFlow('myFlow')
    expect(stats).toBeDefined()
    expect(stats!.avgDurationMs).toBe(800)
    expect(stats!.sampleCount).toBe(1)
    expect(stats!.stdDevDurationMs).toBe(0)
  })

  it('two inserts: avg=(d1+d2)/2, sampleCount=2, stdDev correct', () => {
    statsDb.updateFlowStats('myFlow', 100)
    statsDb.updateFlowStats('myFlow', 200)
    const stats = statsDb.getFlowStatsForFlow('myFlow')!

    expect(stats.sampleCount).toBe(2)
    expect(stats.avgDurationMs).toBeCloseTo(150, 5)
    expect(stats.stdDevDurationMs).toBeCloseTo(Math.sqrt(5000), 5)
  })

  it('three inserts: avg=(a+b+c)/3, sampleCount=3, stdDev correct', () => {
    statsDb.updateFlowStats('myFlow', 100)
    statsDb.updateFlowStats('myFlow', 200)
    statsDb.updateFlowStats('myFlow', 300)
    const stats = statsDb.getFlowStatsForFlow('myFlow')!

    expect(stats.sampleCount).toBe(3)
    expect(stats.avgDurationMs).toBeCloseTo(200, 5)
    expect(stats.stdDevDurationMs).toBeCloseTo(100, 5)
  })

  it('getFlowStatsForFlow returns undefined for a missing flow', () => {
    expect(statsDb.getFlowStatsForFlow('nonexistent')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// statsDb — getTaskHistory / getFlowHistory
// ---------------------------------------------------------------------------

describe('statsDb — getTaskHistory / getFlowHistory', () => {
  let db: ReturnType<typeof createDatabase>

  beforeEach(() => {
    db = createDatabase(':memory:')
  })

  it('getTaskHistory returns empty array when there is no data', () => {
    expect(db.statsDb.getTaskHistory('myFlow', 'taskA')).toEqual([])
  })

  it('getTaskHistory returns rows in ascending end_time order', () => {
    // Two completed runs for the same flow/task with different end times
    db.runDb.saveRun({
      id: 'run-early',
      flowId: 'flow-1',
      flowName: 'myFlow',
      state: TaskState.COMPLETED,
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:01:00.000Z',
      configuration: 'cfg',
      tags: {},
      logs: [],
      progress: 1.0,
      tasks: [
        {
          id: 'tr-early',
          taskId: 'task-1',
          taskName: 'taskA',
          state: TaskState.COMPLETED,
          endTime: '2024-01-01T00:00:30.000Z',
          durationMs: 1000,
          logs: [],
          weight: 1,
          estimatedTime: 1000,
          progress: 1.0,
          crucialPass: true,
        },
      ],
    })

    db.runDb.saveRun({
      id: 'run-later',
      flowId: 'flow-1',
      flowName: 'myFlow',
      state: TaskState.COMPLETED,
      startTime: '2024-01-02T00:00:00.000Z',
      endTime: '2024-01-02T00:01:00.000Z',
      configuration: 'cfg',
      tags: {},
      logs: [],
      progress: 1.0,
      tasks: [
        {
          id: 'tr-later',
          taskId: 'task-1',
          taskName: 'taskA',
          state: TaskState.COMPLETED,
          endTime: '2024-01-02T00:00:30.000Z',
          durationMs: 2000,
          logs: [],
          weight: 1,
          estimatedTime: 1000,
          progress: 1.0,
          crucialPass: true,
        },
      ],
    })

    const history = db.statsDb.getTaskHistory('myFlow', 'taskA')
    expect(history).toHaveLength(2)
    // Ascending: the earlier run comes first
    expect(history[0].durationMs).toBe(1000)
    expect(history[1].durationMs).toBe(2000)
  })

  it('getFlowHistory returns empty array when there is no data', () => {
    expect(db.statsDb.getFlowHistory('myFlow')).toEqual([])
  })

  it('getFlowHistory returns rows in ascending end_time order', () => {
    db.runDb.saveRun({
      id: 'run-early',
      flowId: 'flow-1',
      flowName: 'myFlow',
      state: TaskState.COMPLETED,
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:01:00.000Z',
      configuration: 'cfg',
      tags: {},
      logs: [],
      progress: 1.0,
      tasks: [],
    })

    db.runDb.saveRun({
      id: 'run-later',
      flowId: 'flow-1',
      flowName: 'myFlow',
      state: TaskState.COMPLETED,
      startTime: '2024-01-02T00:00:00.000Z',
      endTime: '2024-01-02T00:01:30.000Z',
      configuration: 'cfg',
      tags: {},
      logs: [],
      progress: 1.0,
      tasks: [],
    })

    const history = db.statsDb.getFlowHistory('myFlow')
    expect(history).toHaveLength(2)
    // Ascending: the earlier run must come first
    expect(history[0].runId).toBe('run-early')
    expect(history[1].runId).toBe('run-later')
  })
})

// ---------------------------------------------------------------------------
// statsDb — deleteFlowStats
// ---------------------------------------------------------------------------

describe('statsDb — deleteFlowStats', () => {
  it('removes task stats, flow stats, and task structure only for the named flow', () => {
    const { statsDb } = createDatabase(':memory:')

    // Populate flow-A
    statsDb.updateTaskStats('flow-A', 'taskX', 100)
    statsDb.updateFlowStats('flow-A', 500)
    statsDb.saveFlowTaskStructure('flow-A', [{ taskName: 'taskX', estimatedTime: 100 }])

    // Populate flow-B (should survive deletion of flow-A)
    statsDb.updateTaskStats('flow-B', 'taskY', 200)
    statsDb.updateFlowStats('flow-B', 600)
    statsDb.saveFlowTaskStructure('flow-B', [{ taskName: 'taskY', estimatedTime: 200 }])

    statsDb.deleteFlowStats('flow-A')

    expect(statsDb.getTaskStats('flow-A', 'taskX')).toBeUndefined()
    expect(statsDb.getFlowStatsForFlow('flow-A')).toBeUndefined()
    expect(statsDb.getFlowTaskStructure('flow-A')).toBeNull()

    // flow-B must be completely untouched
    expect(statsDb.getTaskStats('flow-B', 'taskY')).toBeDefined()
    expect(statsDb.getFlowStatsForFlow('flow-B')).toBeDefined()
    expect(statsDb.getFlowTaskStructure('flow-B')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// statsDb — deleteAllStats
// ---------------------------------------------------------------------------

describe('statsDb — deleteAllStats', () => {
  it('clears all stats; getAllStats returns an empty array', () => {
    const { statsDb } = createDatabase(':memory:')

    statsDb.updateTaskStats('flow-A', 'taskX', 100)
    statsDb.updateTaskStats('flow-B', 'taskY', 200)
    statsDb.updateFlowStats('flow-A', 500)
    statsDb.saveFlowTaskStructure('flow-A', [{ taskName: 'taskX', estimatedTime: 100 }])

    statsDb.deleteAllStats()

    expect(statsDb.getAllStats()).toEqual([])
    expect(statsDb.getTaskStats('flow-A', 'taskX')).toBeUndefined()
    expect(statsDb.getFlowStatsForFlow('flow-A')).toBeUndefined()
    expect(statsDb.getFlowTaskStructure('flow-A')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// statsDb — saveFlowTaskStructure / getFlowTaskStructure
// ---------------------------------------------------------------------------

describe('statsDb — saveFlowTaskStructure / getFlowTaskStructure', () => {
  it('round-trips task names and estimated times', () => {
    const { statsDb } = createDatabase(':memory:')
    const tasks = [
      { taskName: 'setup', estimatedTime: 500 },
      { taskName: 'run', estimatedTime: 2000 },
      { taskName: 'teardown', estimatedTime: 300 },
    ]
    statsDb.saveFlowTaskStructure('myFlow', tasks)
    expect(statsDb.getFlowTaskStructure('myFlow')).toEqual(tasks)
  })

  it('returns null for a flow with no saved structure', () => {
    const { statsDb } = createDatabase(':memory:')
    expect(statsDb.getFlowTaskStructure('nonexistent')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// flowDb — saveFlow / getAllFlows / getFlowById / deleteFlow
// ---------------------------------------------------------------------------

describe('flowDb — saveFlow / getAllFlows / getFlowById / deleteFlow', () => {
  it('saveFlow + getAllFlows round-trips id, name, tasks (name, weight, estimatedTime, crucialPass)', () => {
    const { flowDb } = createDatabase(':memory:')
    const flow = makeFlowDefinition({
      tasks: [
        {
          id: 'task-1',
          name: 'Step One',
          description: 'First step',
          weight: 2,
          estimatedTime: 1500,
          crucialPass: true,
        },
        {
          id: 'task-2',
          name: 'Step Two',
          description: 'Second step',
          weight: 1,
          estimatedTime: 500,
          crucialPass: false,
        },
      ],
    })

    flowDb.saveFlow(flow)
    const flows = flowDb.getAllFlows()

    expect(flows).toHaveLength(1)
    const saved = flows[0]
    expect(saved.id).toBe('flow-1')
    expect(saved.name).toBe('Test Flow')
    expect(saved.tasks).toHaveLength(2)

    const t1 = saved.tasks[0]
    expect(t1.name).toBe('Step One')
    expect(t1.weight).toBe(2)
    expect(t1.estimatedTime).toBe(1500)
    expect(t1.crucialPass).toBe(true)

    const t2 = saved.tasks[1]
    expect(t2.name).toBe('Step Two')
    expect(t2.weight).toBe(1)
    expect(t2.estimatedTime).toBe(500)
    expect(t2.crucialPass).toBe(false)
  })

  it('getFlowById returns the correct flow', () => {
    const { flowDb } = createDatabase(':memory:')
    flowDb.saveFlow(makeFlowDefinition({ id: 'flow-abc', name: 'Alpha Flow' }))
    const retrieved = flowDb.getFlowById('flow-abc')
    expect(retrieved).toBeDefined()
    expect(retrieved!.id).toBe('flow-abc')
    expect(retrieved!.name).toBe('Alpha Flow')
  })

  it('getFlowById returns undefined for a missing flow', () => {
    const { flowDb } = createDatabase(':memory:')
    expect(flowDb.getFlowById('does-not-exist')).toBeUndefined()
  })

  it('deleteFlow removes the flow; getFlowById returns undefined afterwards', () => {
    const { flowDb } = createDatabase(':memory:')
    flowDb.saveFlow(makeFlowDefinition({ id: 'flow-del' }))
    flowDb.deleteFlow('flow-del')
    expect(flowDb.getFlowById('flow-del')).toBeUndefined()
    expect(flowDb.getAllFlows()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// runDb — saveRun / getAllRuns / getRunById / deleteRun
// ---------------------------------------------------------------------------

describe('runDb — saveRun / getAllRuns / getRunById / deleteRun', () => {
  it('saveRun + getAllRuns round-trips state, startTime, endTime, progress, tags, configuration', () => {
    const { runDb } = createDatabase(':memory:')
    runDb.saveRun(makeFlowRun())
    const runs = runDb.getAllRuns()

    expect(runs).toHaveLength(1)
    const run = runs[0]
    expect(run.id).toBe('run-1')
    expect(run.state).toBe(TaskState.COMPLETED)
    expect(run.startTime).toBe('2024-01-01T00:00:00.000Z')
    expect(run.endTime).toBe('2024-01-01T00:05:00.000Z')
    expect(run.progress).toBe(1.0)
    expect(run.tags).toEqual({ version: '1.0' })
    expect(run.configuration).toBe('prod')
  })

  it('round-trips run-level logs and task-level logs', () => {
    const { runDb } = createDatabase(':memory:')
    runDb.saveRun(makeFlowRun())
    const runs = runDb.getAllRuns()

    expect(runs[0].logs).toEqual(['started', 'finished'])
    expect(runs[0].tasks[0].logs).toEqual(['data loaded'])
  })

  it('getRunById returns the correct run', () => {
    const { runDb } = createDatabase(':memory:')
    runDb.saveRun(makeFlowRun({ id: 'run-xyz', flowName: 'SpecialFlow' }))
    const run = runDb.getRunById('run-xyz')
    expect(run).toBeDefined()
    expect(run!.id).toBe('run-xyz')
    expect(run!.flowName).toBe('SpecialFlow')
  })

  it('getRunById returns undefined for a missing run', () => {
    const { runDb } = createDatabase(':memory:')
    expect(runDb.getRunById('not-here')).toBeUndefined()
  })

  it('deleteRun removes the run; getRunById returns undefined afterwards', () => {
    const { runDb } = createDatabase(':memory:')
    runDb.saveRun(makeFlowRun({ id: 'run-del' }))
    runDb.deleteRun('run-del')
    expect(runDb.getRunById('run-del')).toBeUndefined()
    expect(runDb.getAllRuns()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// crucialPass regression — known bug: getAllRuns hardcodes crucialPass: true
// ---------------------------------------------------------------------------

// The db.ts getAllRuns / getRunById implementation ignores the stored
// crucial_pass column and always returns `crucialPass: true`. This test
// documents the bug and is expected to fail until the bug is fixed.
test.fails('crucialPass=false round-trips correctly (known bug: hardcoded true)', () => {
  const { runDb } = createDatabase(':memory:')

  const run: FlowRun = {
    id: 'run-bug',
    flowId: 'flow-1',
    flowName: 'BugFlow',
    state: TaskState.PENDING,
    startTime: '2024-01-01T00:00:00.000Z',
    configuration: 'cfg',
    tags: {},
    logs: [],
    progress: 0,
    tasks: [
      {
        id: 'tr-bug',
        taskId: 'task-bug',
        taskName: 'NonCritical',
        state: TaskState.PENDING,
        logs: [],
        weight: 1,
        estimatedTime: 1000,
        progress: 0,
        // Intentionally false — should survive the round-trip, but the bug
        // means the code returns true instead.
        crucialPass: false,
      },
    ],
  }

  runDb.saveRun(run)
  const retrieved = runDb.getAllRuns()
  // This assertion will fail due to the hardcoded `crucialPass: true` in getAllRuns
  expect(retrieved[0].tasks[0].crucialPass).toBe(false)
})
