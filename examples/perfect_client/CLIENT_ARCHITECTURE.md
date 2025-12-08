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
update_task_state(run_id: str, task_index: int, state: str, progress: int, ...) -> bool
send_heartbeat() -> bool
listen_for_executions(poll_interval: float) -> None
```

**Backend Endpoints:**
- `POST /api/flows` - Register a flow
- `POST /api/flows/{run_id}/logs` - Send log message
- `POST /api/runs/{run_id}/tasks/{task_index}/state` - Update task state
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

**Responsibility:** Flow execution orchestration and progress tracking

**Key Components:**
- `FlowExecutor` - Orchestrates flow execution
- `create_execution_handler()` - Creates threaded execution handlers

**Execution Flow:**
1. Receive execution request from backend
2. Look up flow definition in registry
3. Execute tasks sequentially
4. For each task:
   - Send "RUNNING" state update
   - Capture stdout/stderr
   - Execute task function in background thread
   - Send progress updates (0-99%)
   - Handle errors (crucial vs non-crucial tasks)
   - Send task result
   - Mark as "COMPLETED" or "FAILED"
5. Send final flow completion/failure log

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
