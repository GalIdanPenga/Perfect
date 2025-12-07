#!/usr/bin/env python3
"""
Perfect Python Client - Flow Definitions

This file contains the workflow definitions using Perfect's Python SDK.
It defines all flows and tasks, registers them with Perfect, and handles execution.

To run:
    python examples/workflows/example_flows.py

The client will:
1. Register all defined flows with Perfect
2. Flows are automatically triggered upon registration
3. Listen for execution requests from Perfect
4. Execute flows when triggered
5. Send logs back to Perfect in real-time
"""

import sys
import os
import time
import threading

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from perfect_client.sdk import task, flow, get_registry
from perfect_client.api import create_client, ExecutionRequest


# ==========================================
# Flow 1: Daily Sales ETL
# ==========================================

@task(estimated_time=1000)
def fetch_db_connection():
    """Connect to postgres_prod"""
    print("Connecting to database...")
    time.sleep(0.1)
    return {"connection": "postgres_prod"}


@task(estimated_time=5000)
def extract_sales_data(conn):
    """Query raw logs"""
    print("Extracting sales data...")
    time.sleep(0.5)
    return {"rows": 1000, "source": "sales_raw"}


@task(estimated_time=3000)
def clean_dataframe(df):
    """Remove nulls"""
    print("Cleaning dataframe...")
    time.sleep(0.3)
    return {"rows": 950, "cleaned": True}


@task(estimated_time=2000)
def load_to_warehouse(df):
    """Insert into sales_daily"""
    print("Loading to warehouse...")
    time.sleep(0.2)
    return {"status": "success"}


@flow(
    name="Daily Sales ETL",
    description="Extracts sales data from SQL, transforms via Pandas, and loads to BigQuery.",
    tags={"version": "v2.1", "team": "data-eng", "priority": "high"}
)
def daily_sales_etl():
    """Daily ETL pipeline for sales data"""
    conn = fetch_db_connection()
    data = extract_sales_data(conn)
    clean = clean_dataframe(data)
    load_to_warehouse(clean)


# ==========================================
# Flow 2: Churn Model Retraining
# ==========================================

@task(estimated_time=2000)
def fetch_training_set():
    """Load user behavior logs"""
    print("Fetching training data...")
    time.sleep(0.2)
    return {"samples": 50000}


@task(estimated_time=15000)
def train_xgboost(data):
    """Train classifier on GPU"""
    print("Training model...")
    time.sleep(1.5)
    return {"auc": 0.87, "model_id": "xgb_v123"}


@task(estimated_time=1000)
def evaluate_model(model):
    """Check AUC metric"""
    print("Evaluating model...")
    time.sleep(0.1)
    return model.get("auc", 0) > 0.85


@task(estimated_time=3000)
def deploy_if_better(passed):
    """Push to Sagemaker"""
    if passed:
        print("Deploying model to production...")
        time.sleep(0.3)
        return {"deployed": True}
    else:
        print("Model did not meet threshold, skipping deployment")
        return {"deployed": False}


@flow(
    name="Churn Model Retraining",
    description="Retrains the churn prediction model on new user data.",
    tags={"version": "v1.0", "team": "ml-ops", "model": "xgboost"}
)
def churn_model_retraining():
    """Weekly ML model retraining pipeline"""
    data = fetch_training_set()
    model = train_xgboost(data)
    passed = evaluate_model(model)
    deploy_if_better(passed)


# ==========================================
# Flow 3: Infrastructure Health Check
# ==========================================

@task(estimated_time=500)
def check_api_latency():
    """Ping /health endpoint"""
    print("Checking API latency...")
    time.sleep(0.05)
    return {"latency_ms": 45}


@task(estimated_time=500)
def check_db_pool():
    """Query connection pool"""
    print("Checking DB connection pool...")
    time.sleep(0.05)
    return {"active_connections": 12, "max_connections": 100}


@task(estimated_time=500)
def check_redis_memory():
    """Check memory usage"""
    print("Checking Redis memory...")
    time.sleep(0.05)
    return {"memory_used_mb": 450, "memory_max_mb": 4096}


@task(estimated_time=500)
def alert_pagerduty_if_critical():
    """Trigger alerts if needed"""
    print("Evaluating alert thresholds...")
    time.sleep(0.05)
    return {"alerts_triggered": 0}


@flow(
    name="Infrastructure Health Check",
    description="Checks API latency and database connection pool status."
)
def infra_health_check():
    """Monitor infrastructure health metrics"""
    check_api_latency()
    check_db_pool()
    check_redis_memory()
    alert_pagerduty_if_critical()


# ==========================================
# Flow 4: Weekly Executive Report
# ==========================================

@task(estimated_time=3000)
def compute_kpis():
    """Aggregate revenue metrics"""
    print("Computing KPIs...")
    time.sleep(0.3)
    return {"revenue": 1250000, "users": 45000, "conversion": 0.034}


@task(estimated_time=2000)
def generate_charts(metrics):
    """Plot matplotlib figures"""
    print("Generating charts...")
    time.sleep(0.2)
    return {"charts": ["revenue_trend.png", "user_growth.png"]}


@task(estimated_time=4000)
def render_pdf(charts):
    """Jinja2 to WeasyPrint"""
    print("Rendering PDF report...")
    time.sleep(0.4)
    return {"pdf_path": "/tmp/executive_report.pdf"}


@task(estimated_time=1000)
def email_report(pdf):
    """Send via SendGrid"""
    print("Emailing report to executives...")
    time.sleep(0.1)
    return {"email_sent": True}


@flow(
    name="Weekly Executive Report",
    description="Generates PDF report and emails it to the C-suite."
)
def weekly_report():
    """Weekly executive reporting pipeline"""
    metrics = compute_kpis()
    charts = generate_charts(metrics)
    pdf = render_pdf(charts)
    email_report(pdf)


# ==========================================
# Client Logic
# ==========================================

def register_all_flows(client):
    """Register all defined flows with Perfect"""
    registry = get_registry()
    flows = registry.get_flows()

    print(f"\n[Perfect Client] Found {len(flows)} flows to register")
    print("=" * 60)

    for flow_def in flows:
        # Analyze flow to get task information
        analyzed_flow = registry.analyze_flow(flow_def.func.__name__)

        # Convert to API format
        payload = registry.to_dict(analyzed_flow)

        # Register with Perfect
        client.register_flow(payload)

    print("=" * 60)
    print(f"[Perfect Client] Registered {len(flows)} flows\n")


def handle_execution_request(client, request: ExecutionRequest):
    """
    Handle an execution request from Perfect.

    Args:
        client: Perfect API client for sending logs
        request: Execution request with run_id, flow_name, and configuration
    """
    config_upper = request.configuration.upper()

    # Send initial logs
    client.send_log(request.run_id, f"[Python Client] Received execution request with configuration: {config_upper}")
    client.send_log(request.run_id, f"[Python Client] Initializing flow execution...")

    # Get the flow to execute
    registry = get_registry()
    flow_def = None
    for f in registry.get_flows():
        if f.name == request.flow_name:
            flow_def = f
            break

    if not flow_def:
        client.send_log(request.run_id, f"[Python Client] ❌ Flow '{request.flow_name}' not found")
        return

    # Analyze flow to get tasks
    analyzed_flow = registry.analyze_flow(flow_def.func.__name__)
    total_tasks = len(analyzed_flow.tasks)

    # Execute the flow
    start_time = time.time()
    current_task_index = -1

    try:
        # Execute tasks sequentially with time-based progress tracking
        for i, task_def in enumerate(analyzed_flow.tasks):
            current_task_index = i
            client.send_log(request.run_id, f"[Python Client] Starting task {i+1}/{total_tasks}: {task_def.name}")
            client.update_task_state(request.run_id, i, 'RUNNING', 0)

            task_start = time.time()
            estimated_ms = task_def.estimated_time
            update_interval = 0.01  # Update every 10ms

            # Execute task with progress updates
            elapsed_ms = 0
            last_progress = 0

            while elapsed_ms < estimated_ms:
                time.sleep(update_interval)
                elapsed_ms = (time.time() - task_start) * 1000

                # Calculate progress: min(100, elapsed/estimated * 100)
                progress = min(100, int((elapsed_ms / estimated_ms) * 100))

                if progress > last_progress:
                    client.update_task_state(request.run_id, i, 'RUNNING', progress)
                    last_progress = progress

            # Calculate actual duration
            actual_duration = int((time.time() - task_start) * 1000)

            # Mark task as completed with actual duration
            client.update_task_state(request.run_id, i, 'COMPLETED', 100, duration_ms=actual_duration)
            client.send_log(request.run_id, f"[Python Client] ✓ Task {task_def.name} completed in {actual_duration}ms")

        # Execute the actual flow function (for any side effects/logging)
        flow_def.func()

        duration = int((time.time() - start_time) * 1000)
        client.send_log(request.run_id, f"[Python Client] ✓ Flow execution completed successfully in {duration}ms")

    except Exception as e:
        duration = int((time.time() - start_time) * 1000)
        # Mark the current task as failed if we were executing one
        if current_task_index >= 0:
            client.update_task_state(request.run_id, current_task_index, 'FAILED', 0)
        client.send_log(request.run_id, f"[Python Client] ❌ Flow execution failed after {duration}ms: {str(e)}")


def main():
    """Main entry point for the Perfect Python client"""
    print("\n" + "=" * 60)
    print("Perfect Python Client")
    print("=" * 60)

    # Create API client - connect to Perfect backend
    client = create_client(mock=False)

    try:
        # Set client on registry - this automatically registers all flows
        registry = get_registry()
        registry.set_client(client)

        # Track completed executions
        total_flows = len(registry.get_flows())
        completed_executions = {'count': 0}
        execution_lock = threading.Lock()

        # Set up execution handler to run in separate threads for concurrency
        def threaded_execution_handler(req):
            def wrapped_handler():
                handle_execution_request(client, req)

                # Track completion
                with execution_lock:
                    completed_executions['count'] += 1
                    print(f"\n[Perfect Client] Completed {completed_executions['count']}/{total_flows} flows")

                    # Auto-shutdown after all flows complete (safe since no auto-trigger is used)
                    if completed_executions['count'] >= total_flows:
                        print("[Perfect Client] All flows completed. Shutting down...")
                        client.stop_listening()

            thread = threading.Thread(
                target=wrapped_handler,
                daemon=True
            )
            thread.start()

        client.on_execution_request(threaded_execution_handler)

        # Start listening for execution requests
        # Note: This requires a running Perfect backend server
        # For now, this will show connection errors since there's no backend
        client.listen_for_executions()

    except KeyboardInterrupt:
        print("\n\n[Perfect Client] Shutting down...")
    finally:
        client.close()


if __name__ == "__main__":
    main()
