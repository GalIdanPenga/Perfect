# Perfect Python Client

A Python SDK for defining and orchestrating data workflows with the Perfect platform.

## Installation

```bash
# Install Python dependencies
pip install -r requirements.txt
```

## Quick Start

### 1. Define Tasks

Use the `@task` decorator to define individual task functions:

```python
from perfect_client import task

@task(weight=5, estimated_time=3000)
def extract_data():
    """Extract data from database"""
    # Your task logic here
    return data
```

**Parameters:**
- `weight`: Relative importance for progress calculation (default: 1)
- `estimated_time`: Expected duration in milliseconds (default: 1000)

### 2. Define Flows

Use the `@flow` decorator to compose tasks into workflows:

```python
from perfect_client import flow, CronSchedule

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

**Parameters:**
- `name`: Human-readable flow name
- `description`: What the flow does
- `schedule`: Optional scheduling (CronSchedule or IntervalSchedule)

### 3. Run the Example

```bash
python client_example.py
```

This will:
1. Register all defined flows with the Perfect engine
2. Display flow metadata and task information
3. Make flows available in the Perfect UI for monitoring

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
