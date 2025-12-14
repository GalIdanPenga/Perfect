# Perfect Python Client

A Python SDK for defining and orchestrating data workflows with the Perfect platform.

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt
```

## Quick Start

Here's a complete example - just 2 simple steps:

```python
from perfect_client.sdk import task, flow
import time

# 1. Define tasks and flows with decorators
@task(estimated_time=2000)
def extract_data():
    """Extract data from database"""
    print("Extracting data...")
    return {"records": 1000}

@task(estimated_time=3000)
def transform_data(data):
    """Clean and transform data"""
    print(f"Transforming {data['records']} records...")
    return {"clean_records": 950}

@flow(
    name="My ETL Pipeline",
    description="Extract, transform, and load daily data",
    tags={"version": "v1.0", "team": "data-eng"}
)
def my_etl():
    """Main ETL workflow"""
    data = extract_data()
    clean_data = transform_data(data)
    return clean_data

# 2. Call your flows - that's it!
if __name__ == "__main__":
    my_etl()  # SDK auto-connects, registers, and starts listening!

    # Keep script running
    while True:
        time.sleep(1)
```

**That's it!** Just 2 steps:
- ✅ **Define tasks and flows** using decorators
- ✅ **Call flows** - SDK automatically handles everything (connection, registration, listening, execution)

**Zero Configuration**: The SDK automatically:
- Connects to the backend when you call a flow
- Registers the flow with Perfect
- Starts listening for execution requests in background
- Handles execution and graceful shutdown

### Task Decorator Parameters

```python
@task(estimated_time=3000, crucial_pass=True)
```

**Parameters:**
- `estimated_time`: Expected duration in milliseconds (default: 1000)
  - Used for weight-based progress calculation
- `crucial_pass`: If True, task failure fails the entire flow (default: True)
  - Set to False for optional tasks that shouldn't stop the flow

### Flow Decorator Parameters

```python
@flow(
    name="My Flow",
    description="What this flow does",
    tags={"version": "v1.0", "team": "data-eng"}
)
```

**Parameters:**
- `name`: Human-readable flow name (required)
- `description`: What the flow does (optional)
- `tags`: Dictionary of metadata tags for organization (optional)
  - Example: `{"version": "v1.0", "team": "ml-ops", "priority": "high"}`

### Configuration (Optional)

By default, the SDK auto-connects to `http://localhost:3000` with client ID `perfect_example`.

To customize, use `configure()`:

```python
from perfect_client.sdk import configure

configure(
    backend_url="http://localhost:3000",  # Perfect backend URL
    client_id="my_custom_client",         # Unique client identifier
    mock=False                             # Set to True for testing without backend
)
```

Call `configure()` before calling any flows if you need custom settings.

### Listen Function

```python
listen()  # Start listening for execution requests
```

Call `listen()` after you've called all the flows you want to register. It:
- Ensures the client is connected (auto-connects if needed)
- Starts listening for execution requests from the Perfect UI
- Blocks until interrupted (Ctrl+C)
- Automatically shuts down gracefully

## Example Flows

The `client_example.py` includes 4 production-ready workflow examples:

1. **Daily Sales ETL** - Extract sales data, transform, and load to warehouse
2. **Churn Model Retraining** - ML pipeline for model training and deployment
3. **Infrastructure Health Check** - Monitor API and database health metrics
4. **Weekly Executive Report** - Generate and email PDF reports

## Architecture

```
┌─────────────────┐
│  Python Client  │  <- Your workflow definitions
│  client_example │
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐
│ Perfect Engine  │  <- Execution orchestration
│   (TypeScript)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   React UI      │  <- Real-time monitoring
│   Dashboard     │
└─────────────────┘
```

## API Reference

### Decorators

#### `@task(weight=1, estimated_time=1000)`
Registers a function as a task.

#### `@flow(name, description, schedule=None)`
Registers a function as a flow.

### Scheduling

#### `CronSchedule(expression)`
Cron-based scheduling:
```python
CronSchedule("0 0 * * *")      # Daily at midnight
CronSchedule("0 9 * * MON")     # Mondays at 9 AM
CronSchedule("*/15 * * * *")    # Every 15 minutes
```

#### `IntervalSchedule(expression)`
Interval-based scheduling:
```python
IntervalSchedule("*/5 * * * *")  # Every 5 minutes
```

## Development

### Project Structure

```
perfect/
├── perfect_client/sdk.py              # Python SDK (decorators, engine)
├── client_example.py      # Example workflows
├── requirements.txt       # Python dependencies
└── PYTHON_CLIENT.md      # This file
```

### Running Tests

```bash
pytest tests/
```

### Type Checking

```bash
mypy perfect_client/sdk.py client_example.py
```

### Code Formatting

```bash
black perfect_client/sdk.py client_example.py
```

## Integration with Perfect UI

Once flows are registered, they appear in the Perfect web dashboard where you can:

- ✅ View all registered flows and their tasks
- ⚡ Trigger flows manually with different configurations
- 📊 Monitor real-time execution progress
- 📝 View live task logs and metrics
- 📈 Track execution history and performance

## Next Steps

1. Modify `client_example.py` to add your own flows
2. Run the client to register flows with the engine
3. Open the Perfect UI to monitor and trigger executions
4. Build production workflows for ETL, ML, reporting, and more!

## License

See main project LICENSE file.
