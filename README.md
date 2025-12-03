# Perfect - Workflow Orchestration Platform

A modern workflow orchestration platform for Python flows. Monitor, trigger, and analyze your data pipelines with ease.

View your app in AI Studio: https://ai.studio/apps/drive/1A2Sy8R_XLyH62O0HBsFmX4hU_S0x7uLI

## Features

- 🎯 **Python-First Design** - Define workflows using simple decorators
- 📊 **Real-Time Monitoring** - Track execution progress with live updates
- ⚡ **Weight-Based Progress** - Accurate progress tracking based on task complexity
- 🔄 **Flexible Scheduling** - Cron and interval-based scheduling support
- 🎨 **Modern UI** - Beautiful cyberpunk-themed dashboard

## Run Locally

**Prerequisites:**  Node.js and Python 3.8+

### Frontend (React UI)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (if using AI features)

3. Run the app:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

### Python Client

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the example client to see flow definitions:
   ```bash
   python examples/client_app.py
   ```

3. In the Perfect UI, click "Simulate Client Connection" to load the example flows

## Project Structure

```
perfect/
├── App.tsx                 # Main React application
├── services/
│   └── engine.ts          # Workflow execution engine
├── examples/
│   ├── client_app.ts      # TypeScript bridge (browser simulation)
│   └── client_app.py      # Python client example
├── perfect_client/sdk.py              # Python SDK (decorators, flow definitions)
├── types.ts               # TypeScript type definitions
└── README.md              # This file
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

See [PYTHON_CLIENT.md](./PYTHON_CLIENT.md) for detailed Python SDK documentation.

## How It Works

1. **Define Flows** - Write Python workflows using `@task` and `@flow` decorators
2. **Register Flows** - Run the Python client to register flows with the engine
3. **Monitor Execution** - View real-time progress in the React dashboard
4. **Analyze Results** - Track execution history and performance metrics

## Example Workflows

The project includes 4 example workflows:

1. **Daily Sales ETL** - Extract, transform, and load sales data
2. **Churn Model Retraining** - ML pipeline for model training
3. **Infrastructure Health Check** - Monitor system health metrics
4. **Weekly Executive Report** - Generate and email PDF reports
