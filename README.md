# Perfect - Workflow Orchestration Platform

A modern workflow orchestration platform for Python flows. Monitor, trigger, and analyze your data pipelines with ease.

View your app in AI Studio: https://ai.studio/apps/drive/1A2Sy8R_XLyH62O0HBsFmX4hU_S0x7uLI

## Features

- 🎯 **Python-First Design** - Define workflows using simple decorators
- 📊 **Real-Time Monitoring** - Track execution progress with live updates
- ⚡ **Weight-Based Progress** - Accurate progress tracking based on task complexity
- 🔄 **Flexible Scheduling** - Cron and interval-based scheduling support
- 🎨 **Modern UI** - Beautiful cyberpunk-themed dashboard
- 💾 **Persistent Storage** - SQLite database for flows and execution history
- 🔍 **Advanced Filtering** - Search and filter execution history by status, flow name, or ID

## Run Locally

**Prerequisites:**  Node.js 18+ and Python 3.8+

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs both frontend and backend):
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend (React UI): http://localhost:5173
   - Backend (Express API): http://localhost:3001

3. Open http://localhost:5173 in your browser

### Python Client

1. The Python SDK has no external dependencies (uses only standard library)

2. Run the example workflows to register flows:
   ```bash
   python examples/workflows/example_flows.py
   ```

3. The Python client will:
   - Register flows with the Perfect backend
   - Listen for execution requests from the UI
   - Execute tasks and report progress in real-time

4. In the Perfect UI, you can:
   - View registered flows in the Library panel
   - Trigger individual flows or run all flows
   - Monitor execution progress with live updates
   - Filter and search through execution history

## Project Structure

```
perfect/
├── src/
│   ├── App.tsx                    # Main React application
│   └── types.ts                   # TypeScript type definitions
├── server/
│   ├── server.ts                  # Express backend server
│   ├── engine/
│   │   └── FlowEngine.ts          # Workflow orchestration engine
│   ├── database/
│   │   └── db.ts                  # SQLite database operations
│   ├── routes/
│   │   ├── engineRoutes.ts        # Flow and run API endpoints
│   │   └── clientRoutes.ts        # Python client communication
│   └── types.ts                   # Server type definitions
├── examples/
│   ├── perfect_client/
│   │   ├── sdk.py                 # Python SDK (decorators, flow definitions)
│   │   ├── api.py                 # HTTP client for backend communication
│   │   └── PYTHON_CLIENT.md       # Python SDK documentation
│   └── workflows/
│       └── example_flows.py       # Example workflow definitions
└── README.md                      # This file
```

## Python Client Example

Define workflows using the Perfect Python SDK:

```python
from perfect_client import task, flow, CronSchedule

@task(weight=5, estimated_time=3000)
def extract_data():
    """Extract data from database"""
    # Your task logic here
    return data

@flow(
    name="Daily ETL Pipeline",
    description="Extract, transform, and load daily data",
    schedule=CronSchedule("0 0 * * *")
)
def daily_etl():
    """Main ETL workflow"""
    conn = connect_to_db()
    data = extract_data(conn)
    cleaned = transform_data(data)
    load_data(cleaned)
```

See [PYTHON_CLIENT.md](./examples/perfect_client/PYTHON_CLIENT.md) for detailed Python SDK documentation.

## How It Works

1. **Define Flows** - Write Python workflows using `@task` and `@flow` decorators
2. **Register Flows** - Python client registers flows with the backend via WebSocket
3. **Trigger Execution** - Click "Run" in the UI to trigger flows with different configurations
4. **Real-Time Updates** - Backend engine orchestrates task execution and streams progress
5. **Monitor Progress** - View live execution with weighted progress tracking in the UI
6. **Persistent History** - All flows and runs are stored in SQLite database
7. **Analyze Results** - Filter and search through execution history by status, flow name, or ID

## Architecture

Perfect uses a three-tier architecture:

- **Frontend (React + Vite)** - Modern UI built with React, displaying real-time flow execution
- **Backend (Express + TypeScript)** - RESTful API and WebSocket server for client communication
- **Database (SQLite)** - Persistent storage for flow definitions and execution history
- **Python Client** - SDK for defining and executing workflows in Python

## Example Workflows

The project includes 4 example workflows:

1. **Daily Sales ETL** - Extract, transform, and load sales data
2. **Churn Model Retraining** - ML pipeline for model training
3. **Infrastructure Health Check** - Monitor system health metrics
4. **Weekly Executive Report** - Generate and email PDF reports

## Database & Persistence

Perfect uses SQLite to persist all workflow data:

- **Location**: `server/database/flows.db`
- **Schema**: Normalized tables for flows, tasks, runs, and logs
- **WAL Mode**: Write-Ahead Logging enabled for better concurrent access
- **Auto-initialized**: Database and tables created automatically on first run

The database stores:
- Flow definitions and task configurations
- Complete execution history with state and progress
- Task-level and flow-level logs
- Timestamps for all operations

All data persists across server restarts, allowing you to:
- Review historical execution patterns
- Debug failed runs by examining logs
- Track performance metrics over time
- Maintain an audit trail of all workflow executions
