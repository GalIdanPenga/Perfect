# Perfect - Workflow Orchestration Platform

A modern workflow orchestration platform for Python flows. Monitor, trigger, and analyze your data pipelines with ease.

## Features

- 🎯 **Python-First Design** - Define workflows using simple decorators
- 📊 **Real-Time Monitoring** - Track execution progress with live updates
- ⚡ **Weight-Based Progress** - Accurate progress tracking based on task complexity
- 🏷️ **Flow Tagging** - Organize flows with custom tags (version, team, priority, etc.)
- 🎨 **Modern UI** - Beautiful cyberpunk-themed dashboard
- 💾 **Persistent Storage** - SQLite database for flows and execution history
- 🔍 **Advanced Filtering** - Search and filter execution history by status, flow name, date, or tag values
- 💓 **Client Heartbeat** - Automatic failure detection when Python client disconnects
- 📈 **Performance Analytics** - Track task performance with configurable sensitivity levels for outlier detection

## Run Locally

**Prerequisites:**  Node.js 18+ and Python 3.8+

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (runs both frontend and backend):
   ```bash
   npm run dev:all
   ```

   This will start:
   - Frontend (React UI): http://localhost:5173
   - Backend (Express API): http://localhost:3000

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
   - Automatically shut down after all flows complete

4. In the Perfect UI, you can:
   - Trigger flows directly from the execution panel
   - Monitor execution progress with live updates
   - View task-level logs and progress tracking
   - Filter and search through execution history
   - See flow metadata including tags and descriptions

## Project Structure

```
perfect/
├── shared/
│   └── types.ts                   # Domain types shared by frontend & backend
├── src/                           # React frontend
│   ├── App.tsx                    # Root component (composition + session state)
│   ├── main.tsx                   # Entry point
│   ├── components/                # UI components (+ dialogs/, progress/)
│   ├── hooks/                     # Data-fetching, storage & animation hooks
│   ├── utils/                     # Pure helpers (format, color, filter, progress, audio)
│   ├── constants/                 # API URL, polling intervals, theme color
│   └── types/                     # Client-only types (re-exports shared/)
├── server/                        # Express backend
│   ├── index.ts                   # Server entry + top-level routes
│   ├── engine/
│   │   ├── FlowEngine.ts          # Orchestration engine (facade)
│   │   ├── runFactory.ts          # Builds run/task structures
│   │   ├── failureHandler.ts      # Shared run-failure logic
│   │   ├── progress.ts            # Weighted-progress calculation
│   │   └── services/
│   │       └── PerformanceMonitor.ts  # Outlier detection
│   ├── database/
│   │   ├── db.ts                  # Composition root (createDatabase + singletons)
│   │   ├── schema.ts              # Tables, indexes, migrations
│   │   ├── flowDb.ts / runDb.ts / statsDb.ts  # Per-domain data access
│   │   └── mappers.ts             # Row → domain-object mapping
│   ├── routes/
│   │   ├── engineRoutes.ts        # Flow and run API endpoints
│   │   └── clientRoutes.ts        # Python client communication
│   ├── utils/
│   │   ├── reportGenerator.ts     # HTML report generation
│   │   └── reportStyles.ts        # Report CSS
│   └── types/                     # Server-only types (re-exports shared/)
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
from perfect_client.sdk import task, flow
import time

@task(estimated_time=3000)
def extract_data():
    """Extract data from database"""
    # Your task logic here
    return data

@task(estimated_time=2000)
def transform_data(data):
    """Clean and transform data"""
    # Your transformation logic
    return cleaned_data

@task(estimated_time=1000)
def load_data(data):
    """Load data to warehouse"""
    # Your loading logic
    pass

@flow(
    name="Daily ETL Pipeline",
    description="Extract, transform, and load daily data",
    tags={"version": "v1.0", "team": "data-eng", "priority": "high"}
)
def daily_etl():
    """Main ETL workflow"""
    data = extract_data()
    cleaned = transform_data(data)
    load_data(cleaned)

# Just call your flows - SDK does the rest!
if __name__ == "__main__":
    daily_etl()  # SDK auto-handles everything

    # Keep running
    while True:
        time.sleep(1)
```

See [PYTHON_CLIENT.md](./examples/perfect_client/PYTHON_CLIENT.md) for detailed Python SDK documentation.

## How It Works

1. **Define Flows** - Write Python workflows using `@task` and `@flow` decorators
2. **Call Flows** - Flows are registered with Perfect only when you call them (lazy registration)
3. **Register Flows** - Python client registers flows with the backend via REST API on first call
4. **Trigger Execution** - Click trigger button in the UI to execute flows
5. **Long Polling** - Python client continuously polls the backend for execution requests
6. **Execute & Report** - Client executes tasks and sends progress updates back to the server
7. **Real-Time Updates** - UI displays live execution progress with weighted progress bars
8. **Persistent History** - All flows and runs are stored in SQLite database
9. **Heartbeat Monitoring** - Client sends heartbeats; flows marked failed if client disconnects. Set `"heartbeat": false` on a client in `server/clients.json`, or `PERFECT_HEARTBEAT=0` for a client you run yourself, to turn this off. See `examples/perfect_client/PYTHON_CLIENT.md`.

## Architecture

Perfect uses a three-tier architecture:

- **Frontend (React + Vite)** - Modern UI built with React, displaying real-time flow execution
- **Backend (Express + TypeScript)** - RESTful API server for flow management and client communication
- **Database (SQLite)** - Persistent storage for flow definitions and execution history
- **Python Client** - SDK for defining and executing workflows, with long-polling for requests

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
- Flow definitions with task configurations and metadata tags
- Complete execution history with state and progress
- Task-level and flow-level logs
- Timestamps for all operations
- Configuration settings for each flow run

All data persists across server restarts, allowing you to:
- Review historical execution patterns
- Debug failed runs by examining logs
- Track performance metrics over time
- Maintain an audit trail of all workflow executions

## Performance Monitoring

Perfect automatically tracks task performance and detects outliers using statistical analysis:

### Statistics Tracking
- **Average Duration**: Rolling average of task execution times
- **Standard Deviation**: Measure of execution time variability
- **Sample Count**: Number of historical executions tracked
- **Last Updated**: Timestamp of most recent execution

### Outlier Detection

Tasks are flagged with performance warnings using statistical analysis (z-score based on standard deviations from mean). The system uses **configurable sensitivity levels** that adapt thresholds based on sample size:

#### Sensitivity Levels

Configure per-client in `server/clients.json` using the `performanceSensitivity` field:

- **Conservative** (fewer alerts, higher confidence)
  - Samples < 20: Requires 7σ deviation
  - Samples ≥ 20: Requires 5σ deviation
  - Best for: Production environments, stable workflows

- **Normal** (balanced, default)
  - Samples < 20: Requires 5σ deviation
  - Samples ≥ 20: Requires 3.3σ deviation
  - Best for: General use, mixed workloads

- **Aggressive** (more alerts, early detection)
  - Samples < 20: Requires 3σ deviation
  - Samples ≥ 20: Requires 2.5σ deviation
  - Best for: Development, performance testing

**Sample-Size Adaptation**: Higher thresholds for small sample sizes prevent false positives when historical data is limited. As more samples accumulate (≥20), thresholds lower for more reliable detection.

### Performance Warning Display

Performance warnings appear in multiple locations:

- **Task Row**: Warning badge with severity indicator (SLOW/CRITICAL)
- **Flow Header**: Summary badge when any task has warnings
- **Statistics Window**: Historical performance data with standard deviation
- **Reports**: Performance issues highlighted in generated HTML reports

**Real-Time Detection**: Warnings appear during task execution, not just after completion, allowing for proactive monitoring.

### Configuration

Configure sensitivity per client in `server/clients.json`:

```json
{
  "clients": [
    {
      "id": "perfect_example",
      "name": "Perfect Example Flows",
      "performanceSensitivity": "normal"
    }
  ]
}
```

Advanced users can modify thresholds in `server/engine/FlowEngine.ts` under the `SENSITIVITY_THRESHOLDS` constant.
