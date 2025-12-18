# Perfect Client Architecture

This document describes the architecture of the Perfect client and provides guidance for implementing clients in other languages.

## Overview

The Perfect client is organized into three clean layers:

```
┌─────────────────────────────────────┐
│     Application Layer               │
│  (User's Flow Definitions)          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     SDK Layer                       │
│  (Decorators, Data Structures)      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Executor Layer                  │
│  (Flow Execution Orchestration)     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Transport Layer (API)           │
│  (HTTP Communication)                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│     Perfect Backend Server          │
│  (Node.js/TypeScript)                │
└─────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Transport Layer (`api.py`)

**Responsibility:** Low-level HTTP communication with Perfect backend

**Key Components:**
- `PerfectAPIClient` - HTTP client for Perfect backend
- `ExecutionRequest` - Data structure for execution requests

**API Methods:**
```python
register_flow(flow_definition: Dict) -> bool
send_log(run_id: str, log_message: str) -> bool
update_task_state(run_id: str, task_index: int, state: str, progress: int,
                  duration_ms: int, result: Dict, task_name: str, estimated_time: int) -> bool
complete_flow(run_id: str, task_count: int) -> bool  # Signal flow completion
send_heartbeat() -> bool
listen_for_executions(poll_interval: float) -> None
```

**Backend Endpoints:**
- `POST /api/flows` - Register a flow
- `POST /api/flows/{run_id}/logs` - Send log message
- `POST /api/runs/{run_id}/tasks/{task_index}/state` - Update task state (supports dynamic task creation)
- `POST /api/runs/{run_id}/complete` - Signal flow completion from client
- `POST /api/heartbeat` - Send keepalive signal
- `GET /api/execution-requests` - Poll for execution requests (long-polling)

### 2. SDK Layer (`sdk.py`)

**Responsibility:** Decorators, data structures, and workflow registry

**Key Components:**
- `@task` - Decorator to define tasks
- `@flow` - Decorator to define flows
- `TaskResult` - Data structure for task results
- `TaskState` - Enum for task states (PENDING, RUNNING, COMPLETED, FAILED)
- `WorkflowRegistry` - Central registry for flows and tasks
- `LogCapture` - Stdout capture for sending print() statements as logs

**Core Data Structures:**
```python
@dataclass
class TaskResult:
    passed: bool
    note: str
    table: List[Dict[str, Any]]

@dataclass
class TaskDefinition:
    name: str
    func: Callable
    description: str
    weight: int
    estimated_time: int
    crucial_pass: bool

@dataclass
class FlowDefinition:
    name: str
    func: Callable
    description: str
    tasks: List[TaskDefinition]
    tags: Dict[str, str]
```

### 3. Executor Layer (`executor.py`)

**Responsibility:** Handle execution requests from the Perfect backend (UI-triggered flows)

**Key Components:**
- `create_execution_handler()` - Creates threaded execution handlers for backend requests

**Execution Flow:**
1. Backend sends execution request (user clicked "Run" in UI)
2. Executor looks up flow by name
3. Executor calls the flow function directly
4. SDK's `@flow` and `@task` decorators handle all tracking automatically
5. Completion callback is invoked

**Note:** The executor is minimal - it just looks up and calls the flow function. All task tracking, progress updates, and completion signaling is handled by the SDK decorators.

**SDK-based Task Tracking:**
1. User calls flow function directly (or triggered via execution request)
2. SDK creates a run on the server
3. Flow function executes normally
4. Each `@task` decorated function:
   - Sends "RUNNING" state with task name and estimated time
   - Executes task function in background thread
   - Sends progress updates (0-99%) based on elapsed/estimated time
   - Handles errors (crucial vs non-crucial tasks)
   - Sends task result and duration
   - Marks as "COMPLETED" or "FAILED"
5. SDK calls `complete_flow()` with actual task count
6. Server removes unused predefined tasks and finalizes the run

**Dynamic Task Support:**
- Tasks can be added dynamically during execution (e.g., in loops)
- Tasks can be skipped (e.g., conditionals) - server removes unused tasks
- Task names and estimated times are sent with each task update
- Server uses statistics or client-provided estimates for progress calculation

**Parallel Flow Support:**
- Multiple flows can run in parallel threads
- Execution context (run_id, task_index) is thread-local
- Each flow maintains its own task counter

### 4. Application Layer (`example_flows.py`)

**Responsibility:** User's flow definitions

**Example:**
```python
from perfect_client import task, flow, TaskResult

@task(estimated_time=3000)
def my_task():
    print("Executing task...")  # Automatically captured as log
    return TaskResult(
        passed=True,
        note="Task completed successfully",
        table=[{"metric": "rows", "value": 100}]
    )

@flow(
    name="My Flow",
    description="Example flow",
    tags={"version": "v1.0"}
)
def my_flow():
    my_task()
```

## Implementing a Client in Another Language

To implement a Perfect client in another language (e.g., JavaScript, Go, Rust), you need to implement the three core layers:

### Step 1: Transport Layer

Implement HTTP client with these methods:
- Register flow (POST request with flow definition)
- Send logs (POST request with log messages)
- Update task state (POST request with state updates)
- Send heartbeat (POST request every 3 seconds)
- Listen for executions (GET request with polling or WebSocket)

### Step 2: SDK Layer

Implement language-appropriate decorators/annotations:
- Task decorator/annotation with `estimated_time` and `crucial_pass` parameters
- Flow decorator/annotation with `name`, `description`, and `tags` parameters
- Data structures for `TaskResult`, `TaskDefinition`, `FlowDefinition`
- Registry to track all defined flows and tasks

### Step 3: Executor Layer

Implement execution orchestration:
- Receive execution requests from backend
- Execute tasks sequentially
- Capture stdout/stderr and send as logs
- Send progress updates (0-99%) during task execution
- Handle task failures (stop flow if crucial, continue if non-crucial)
- Send task results and duration statistics

### Step 4: Example Usage

Provide simple examples showing how users define flows:
```
# Pseudocode for other languages

@task(estimated_time=3000)
function myTask() {
    console.log("Executing task...");  // Captured as log
    return new TaskResult({
        passed: true,
        note: "Task completed",
        table: [{ metric: "rows", value: 100 }]
    });
}

@flow(name="My Flow", tags={ version: "v1.0" })
function myFlow() {
    myTask();
}
```

## Key Implementation Details

### Progress Tracking

Tasks send progress updates during execution:
- Progress = min(99, (elapsed_time / estimated_time) * 100)
- Updates sent every 10ms
- Final 100% sent only on completion

### Estimated Time Resolution

The server determines estimated time for each task using this priority:
1. **Statistics** - Historical average from previous runs (most accurate)
2. **Client-provided** - Sent with task state update (for new/dynamic tasks)
3. **Default** - 1000ms fallback

### Weight Calculation

Task weights for progress calculation:
- Weights are calculated from estimated times: `weight = task_estimated_time / total_estimated_time`
- Recalculated when tasks are added or removed dynamically
- Used for overall flow progress: `flow_progress = sum(task_weight * task_progress)`

### Dynamic Task Execution

Flows can have dynamic task structures:
- Tasks in loops are tracked individually (each call = separate task)
- Conditional tasks that don't run are removed on flow completion
- Server learns task structure from completed runs
- Learned structure is used to predict tasks for future runs

### Flow Completion

Flow completion is controlled by the client:
- Client calls `complete_flow(run_id, actual_task_count)` when done
- Server removes any predefined tasks beyond `actual_task_count`
- Flow is only marked COMPLETED after this call (not when last task finishes)
- This prevents premature completion when more tasks might be added

### Stdout/Stderr Capture

All print statements are captured and sent as logs:
- Redirect stdout/stderr to custom handler
- Buffer partial lines until newline
- Send complete lines with `[Task Output]` prefix
- Restore original stdout/stderr after task completes

### Task Failure Handling

Tasks have a `crucial_pass` flag:
- `crucial_pass=true`: Task failure stops entire flow
- `crucial_pass=false`: Task failure logs warning, flow continues

### Heartbeat

Client sends heartbeat every 3 seconds:
- Backend fails flows if no heartbeat for 10 seconds
- Prevents stuck flows when client crashes

### Parallel Flow Execution

Multiple flows can run concurrently:
- Use `threading.Thread` to run flows in parallel
- SDK uses thread-local storage for execution context
- Each thread has isolated `run_id` and `task_index`
- No interference between parallel flows

## File Structure

```
examples/perfect_client/
├── __init__.py           # Package exports
├── api.py               # Transport layer
├── sdk.py               # SDK layer
├── executor.py          # Executor layer
├── CLIENT_ARCHITECTURE.md  # This file
└── PYTHON_CLIENT.md     # Python-specific docs

examples/workflows/
└── example_flows.py     # Application layer (user's flows)
```

## Testing Your Implementation

1. Start Perfect backend server:
   ```bash
   npm run server
   ```

2. Run your client with example flows:
   ```bash
   python examples/workflows/example_flows.py
   ```

3. Verify in the Perfect UI:
   - Flows are registered
   - Tasks execute in sequence
   - Progress updates are smooth
   - Logs appear in real-time
   - HTML reports are generated

## Reference Implementation

The Python client in this repository serves as the reference implementation. When in doubt, refer to:
- `api.py` - HTTP communication patterns
- `executor.py` - Execution orchestration logic
- `sdk.py` - Data structures and decorator patterns

## Questions?

For questions about implementing clients in other languages, refer to:
- Backend API documentation: `server/index.ts`
- Frontend integration: `src/App.tsx`
- Example flows: `examples/workflows/example_flows.py`
