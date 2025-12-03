# Perfect - Project Architecture

## Overview

Perfect is a workflow orchestration platform with a Python SDK for defining workflows and a React-based UI for monitoring executions in real-time.

## Project Structure

```
/
├── src/                          # Frontend React application
│   ├── components/              # React components (future)
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts            # FlowDefinition, FlowRun, TaskState, etc.
│   ├── App.tsx                  # Main React application
│   └── main.tsx                 # Application entry point
│
├── server/                       # Backend Express server
│   ├── engine/                  # Flow orchestration engine
│   │   └── FlowEngine.ts       # Core workflow execution engine
│   ├── routes/                  # API route handlers
│   │   ├── clientRoutes.ts     # Python client management endpoints
│   │   └── engineRoutes.ts     # Flow and run management endpoints
│   ├── types/                   # Shared TypeScript types
│   │   └── index.ts            # Backend type definitions
│   └── index.ts                 # Server entry point
│
├── examples/                     # Python client examples
│   ├── perfect_client/          # Perfect Python SDK
│   │   ├── __init__.py         # Package exports
│   │   ├── sdk.py              # Workflow decorators (@task, @flow)
│   │   └── api.py              # API client for Perfect backend
│   ├── workflows/               # Example workflow definitions
│   │   └── example_flows.py    # Sample workflows (ETL, ML, monitoring)
│   └── requirements.txt         # Python dependencies
│
├── index.html                    # HTML entry point
├── package.json                  # Node dependencies and scripts
├── vite.config.ts               # Vite configuration
└── tsconfig.json                # TypeScript configuration
```

## Architecture Layers

### 1. Frontend Layer (`src/`)

**Technology:** React + TypeScript + Vite

**Responsibilities:**
- Display flow library and execution history
- Real-time progress monitoring
- Client process management UI
- Configuration selection (dev/debug/release)

**Key Components:**
- `App.tsx` - Main application with flow library and live monitoring
- `types/index.ts` - Shared frontend types

### 2. Backend Layer (`server/`)

**Technology:** Express + TypeScript + tsx

**Responsibilities:**
- Flow registration and storage
- Execution state management
- Python client process lifecycle
- API endpoints for frontend and Python clients

**Key Modules:**

#### FlowEngine (`server/engine/FlowEngine.ts`)
- Singleton class managing all workflows
- Real-time progress simulation
- Pub/sub pattern for state updates
- Sequential task execution
- Weighted progress calculation

```typescript
export class FlowEngine {
  registerFlow(payload: FlowRegistrationPayload): FlowDefinition
  triggerFlow(flowId: string, configuration: string): void
  addFlowLog(runId: string, log: string): void
  subscribe(listener: () => void): () => void
}
```

#### Client Routes (`server/routes/clientRoutes.ts`)
- `POST /api/client/start` - Start Python client process
- `POST /api/client/stop` - Stop Python client process
- `GET /api/client/status` - Get client status and logs

#### Engine Routes (`server/routes/engineRoutes.ts`)
- `GET /api/engine/flows` - Get all registered flows
- `GET /api/engine/runs` - Get all flow runs
- `POST /api/engine/trigger/:flowId` - Trigger flow execution
- `POST /api/engine/register` - Register new flow (Python client)
- `POST /api/engine/runs/:runId/logs` - Add logs (Python client)

### 3. Python Client Layer (`examples/`)

**Technology:** Python 3 + requests

**Responsibilities:**
- Define workflows using decorators
- Register flows with Perfect backend
- Execute flows when triggered
- Send real-time logs during execution

**Key Modules:**

#### SDK (`examples/perfect_client/sdk.py`)
```python
@task(weight=5, estimated_time=3000)
def extract_data():
    # Task implementation
    pass

@flow(name="ETL Pipeline", schedule=CronSchedule("0 0 * * *"))
def etl_pipeline():
    extract_data()
```

#### API Client (`examples/perfect_client/api.py`)
```python
client = create_client(mock=False)
client.register_flow(flow_definition)
client.send_log(run_id, "Processing...")
client.listen_for_executions()
```

## Data Flow

```
┌─────────────────┐         HTTP API        ┌──────────────────┐
│  React Frontend │◄────────────────────────┤ Express Backend  │
│   (port 3000)   │     GET /api/engine/*   │   (port 3001)    │
└─────────────────┘                          └──────────────────┘
                                                      │
                                                      │ manages
                                                      ▼
                                             ┌──────────────────┐
                                             │   FlowEngine     │
                                             │  (Singleton)     │
                                             └──────────────────┘
                                                      ▲
                                                      │ registers/logs
                                             ┌────────┴────────┐
                                             │  Python Client  │
                                             │   (subprocess)  │
                                             └─────────────────┘
```

## Communication Protocols

### Frontend ↔ Backend
- **Protocol:** HTTP REST
- **Polling:** Every 1 second for flows/runs
- **Polling:** Every 2 seconds for client status

### Python Client ↔ Backend
- **Registration:** POST to `/api/flows` (or `/api/engine/register`)
- **Logging:** POST to `/api/flows/:runId/logs`
- **Future:** WebSocket for real-time bidirectional communication

## Class Diagrams

### FlowEngine (Backend)
```
FlowEngine
├── Properties
│   ├── flows: FlowDefinition[]
│   ├── runs: FlowRun[]
│   ├── stateChangeListeners: Function[]
│   └── flowTriggerListeners: Function[]
│
├── Public Methods
│   ├── getFlows(): FlowDefinition[]
│   ├── getRuns(): FlowRun[]
│   ├── registerFlow(payload): FlowDefinition
│   ├── triggerFlow(id, config): void
│   ├── addFlowLog(runId, log): void
│   ├── subscribe(listener): UnsubscribeFn
│   └── subscribeToFlowTriggers(listener): UnsubscribeFn
│
└── Private Methods
    ├── tick(): void
    ├── updateRunProgress(run): void
    ├── removeFlow(id): void
    └── generateId(): string
```

### PerfectAPIClient (Python)
```
PerfectAPIClient
├── Properties
│   ├── base_url: str
│   ├── session: requests.Session
│   └── _execution_callback: Callable
│
└── Methods
    ├── register_flow(definition): bool
    ├── send_log(run_id, log): bool
    ├── on_execution_request(callback): void
    └── listen_for_executions(): void
```

## Configuration Types

Flows can be triggered with different configurations:

- `development` - Standard execution mode
- `debug` - Verbose logging and debugging
- `release` - Optimized production mode

## Running the Application

### Development Mode (All Services)
```bash
# Terminal 1: Backend server
npm run server

# Terminal 2: Frontend dev server
npm run dev

# Terminal 3: Python client (optional - can use UI button)
python3 examples/workflows/example_flows.py
```

### Production Build
```bash
npm run build
npm run preview
```

## Extension Points

### Adding New Flows (Python)
```python
# examples/workflows/my_flows.py
from perfect_client import task, flow

@task
def my_task():
    pass

@flow(name="My Flow")
def my_flow():
    my_task()
```

### Adding New Frontend Components
```typescript
// src/components/MyComponent.tsx
export function MyComponent() {
  return <div>My Component</div>
}
```

### Adding New API Endpoints
```typescript
// server/routes/myRoutes.ts
import express from 'express';
const router = express.Router();

router.get('/my-endpoint', (req, res) => {
  res.json({ message: 'Hello' });
});

export default router;
```

## Future Enhancements

1. **WebSocket Communication** - Replace HTTP polling with real-time WebSocket connection
2. **Database Persistence** - Store flows and runs in PostgreSQL/MongoDB
3. **Authentication** - Add user authentication and authorization
4. **Distributed Execution** - Support for distributed task execution
5. **Advanced Scheduling** - Cron-based automatic flow triggering
6. **Flow Versioning** - Track and manage flow definition versions
7. **Metrics & Analytics** - Detailed performance metrics and dashboards

## Technology Stack

### Frontend
- React 19.2.0
- TypeScript 5.8.2
- Vite 6.2.0
- Tailwind CSS (CDN)
- Lucide React (icons)

### Backend
- Express 4.18.2
- TypeScript 5.8.2
- tsx 4.7.0 (TypeScript execution)
- cors 2.8.5

### Python Client
- Python 3.x
- requests library

## Design Patterns

1. **Singleton Pattern** - FlowEngine maintains single instance
2. **Observer Pattern** - Event subscription for state changes
3. **Decorator Pattern** - Python @task and @flow decorators
4. **Factory Pattern** - create_client() for API client creation
5. **Strategy Pattern** - Different execution configurations
6. **Repository Pattern** - Engine acts as repository for flows/runs

## Best Practices

1. **Type Safety** - Comprehensive TypeScript types across frontend and backend
2. **Separation of Concerns** - Clear layer separation (UI, API, Engine, Client)
3. **Single Responsibility** - Each module has one clear purpose
4. **DRY Principle** - Shared types between frontend and backend
5. **Error Handling** - Graceful error handling at all layers
6. **Process Management** - Proper cleanup on shutdown signals

---

**Last Updated:** 2025-11-27
**Version:** 2.0.0
**Architecture Type:** Client-Server with Subprocess Management
