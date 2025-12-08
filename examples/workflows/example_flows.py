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

from perfect_client.sdk import task, flow, get_registry, TaskResult
from perfect_client.api import create_client, ExecutionRequest


# ==========================================
# Flow 1: Daily Sales ETL
# ==========================================

@task(estimated_time=3000)
def fetch_db_connection():
    """Connect to postgres_prod"""
    print("Connecting to database...")
    time.sleep(3)
    return TaskResult(
        passed=True,
        note="Successfully connected to postgres_prod",
        table=[{"connection": "postgres_prod", "latency_ms": 45, "status": "OK"}]
    )


@task(estimated_time=8000)
def extract_sales_data(conn=None):
    """Query raw logs"""
    print("Extracting sales data...")
    time.sleep(8)
    return TaskResult(
        passed=True,
        note="Extracted 1000 rows from sales_raw table",
        table=[
            {"metric": "rows_extracted", "value": 1000},
            {"metric": "source_table", "value": "sales_raw"},
            {"metric": "query_time_ms", "value": 482}
        ]
    )


@task(estimated_time=6000)
def clean_dataframe(df=None):
    """Remove nulls"""
    print("Cleaning dataframe...")
    time.sleep(6)
    return TaskResult(
        passed=True,
        note="Removed 50 rows with null values",
        table=[
            {"field": "customer_id", "nulls_found": 10, "nulls_removed": 10},
            {"field": "amount", "nulls_found": 25, "nulls_removed": 25},
            {"field": "date", "nulls_found": 15, "nulls_removed": 15}
        ]
    )


@task(estimated_time=5000)
def load_to_warehouse(df=None):
    """Insert into sales_daily"""
    print("Loading to warehouse...")
    time.sleep(5)
    return TaskResult(
        passed=True,
        note="Successfully loaded 950 rows to BigQuery",
        table=[
            {"operation": "INSERT", "rows": 950, "time_ms": 187},
            {"operation": "UPDATE", "rows": 0, "time_ms": 0}
        ]
    )


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

@task(estimated_time=5000)
def fetch_training_set():
    """Load user behavior logs"""
    print("Fetching training data...")
    time.sleep(5)
    return TaskResult(
        passed=True,
        note="Loaded 50,000 training samples",
        table=[
            {"dataset": "user_behavior", "samples": 50000, "features": 23},
            {"dataset": "validation", "samples": 10000, "features": 23}
        ]
    )


@task(estimated_time=20000)
def train_xgboost(data=None):
    """Train classifier on GPU"""
    print("Training model...")
    time.sleep(20)
    auc_score = 0.87
    return TaskResult(
        passed=auc_score > 0.85,
        note=f"Model training completed with AUC: {auc_score}",
        table=[
            {"metric": "AUC", "value": auc_score, "threshold": 0.85},
            {"metric": "Precision", "value": 0.82, "threshold": 0.80},
            {"metric": "Recall", "value": 0.91, "threshold": 0.85}
        ]
    )


@task(estimated_time=7000)
def evaluate_model(model=None):
    """Check AUC metric"""
    print("Evaluating model...")
    time.sleep(7)
    # Extract passed status from model TaskResult
    passed = model.passed if (model and hasattr(model, 'passed')) else True
    return TaskResult(
        passed=passed,
        note="Model evaluation completed" if passed else "Model failed quality checks",
        table=[
            {"check": "AUC_threshold", "passed": passed, "details": "AUC > 0.85"},
            {"check": "No_overfitting", "passed": True, "details": "Train/Val gap < 5%"}
        ]
    )


@task(estimated_time=10000)
def deploy_if_better(passed=None):
    """Push to Sagemaker"""
    should_deploy = passed.passed if (passed and hasattr(passed, 'passed')) else True
    if should_deploy:
        print("Deploying model to production...")
        time.sleep(10)
        return TaskResult(
            passed=True,
            note="Model deployed to production successfully",
            table=[
                {"action": "deploy", "endpoint": "sagemaker-prod", "status": "success"}
            ]
        )
    else:
        print("Model did not meet threshold, skipping deployment")
        return TaskResult(
            passed=False,
            note="Model deployment skipped - failed quality checks",
            table=[
                {"action": "deploy", "endpoint": "sagemaker-prod", "status": "skipped"}
            ]
        )


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

@task(estimated_time=3000)
def check_api_latency():
    """Ping /health endpoint"""
    print("Checking API latency...")
    time.sleep(2)
    return TaskResult(
        passed=True,
        note="API health check passed - latency within normal range",
        table=[
            {"endpoint": "/health", "latency_ms": 45, "threshold_ms": 200, "status": "OK"}
        ]
    )


@task(estimated_time=3000)
def check_db_pool():
    """Query connection pool"""
    print("Checking DB connection pool...")
    time.sleep(2)
    return TaskResult(
        passed=True,
        note="Database connection pool healthy",
        table=[
            {"metric": "active_connections", "value": 12, "max": 100, "utilization_pct": 12}
        ]
    )


@task(estimated_time=3000)
def check_redis_memory():
    """Check memory usage"""
    print("Checking Redis memory...")
    time.sleep(2)
    return TaskResult(
        passed=True,
        note="Redis memory usage within acceptable limits",
        table=[
            {"metric": "memory_used_mb", "value": 450, "max_mb": 4096, "utilization_pct": 11}
        ]
    )


@task(estimated_time=3000)
def alert_pagerduty_if_critical():
    """Trigger alerts if needed"""
    print("Evaluating alert thresholds...")
    time.sleep(2)
    return TaskResult(
        passed=True,
        note="No critical alerts detected",
        table=[
            {"check": "API_latency", "triggered": False, "severity": "OK"},
            {"check": "DB_pool", "triggered": False, "severity": "OK"},
            {"check": "Redis_memory", "triggered": False, "severity": "OK"}
        ]
    )


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

@task(estimated_time=8000)
def compute_kpis():
    """Aggregate revenue metrics"""
    print("Computing KPIs...")
    time.sleep(8)
    return TaskResult(
        passed=True,
        note="KPIs computed successfully for current period",
        table=[
            {"metric": "revenue", "value": 1250000, "vs_target": 105, "unit": "USD"},
            {"metric": "users", "value": 45000, "vs_target": 98, "unit": "count"},
            {"metric": "conversion_rate", "value": 3.4, "vs_target": 102, "unit": "percent"}
        ]
    )


@task(estimated_time=5000)
def generate_charts(metrics=None):
    """Plot matplotlib figures"""
    print("Generating charts...")
    time.sleep(5)
    return TaskResult(
        passed=True,
        note="Generated 3 visualization charts",
        table=[
            {"chart": "revenue_trend.png", "type": "line", "size_kb": 124},
            {"chart": "user_growth.png", "type": "bar", "size_kb": 98},
            {"chart": "conversion_funnel.png", "type": "funnel", "size_kb": 156}
        ]
    )


@task(estimated_time=12000)
def render_pdf(charts=None):
    """Jinja2 to WeasyPrint"""
    print("Rendering PDF report...")
    time.sleep(10)
    return TaskResult(
        passed=True,
        note="PDF report rendered successfully",
        table=[
            {"file": "executive_report.pdf", "pages": 12, "size_mb": 2.4, "status": "ready"}
        ]
    )


@task(estimated_time=4000)
def email_report(pdf=None):
    """Send via SendGrid"""
    print("Emailing report to executives...")
    time.sleep(3)
    return TaskResult(
        passed=True,
        note="Report emailed to 5 executives",
        table=[
            {"recipient": "ceo@company.com", "status": "delivered", "opened": True},
            {"recipient": "cfo@company.com", "status": "delivered", "opened": False},
            {"recipient": "coo@company.com", "status": "delivered", "opened": True},
            {"recipient": "cmo@company.com", "status": "delivered", "opened": True},
            {"recipient": "cto@company.com", "status": "delivered", "opened": False}
        ]
    )


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
    task_results = []  # Store task results for passing between tasks

    try:
        # Execute tasks sequentially
        for i, task_def in enumerate(analyzed_flow.tasks):
            current_task_index = i
            client.send_log(request.run_id, f"[Python Client] Starting task {i+1}/{total_tasks}: {task_def.name}")
            client.update_task_state(request.run_id, i, 'RUNNING', 0)

            task_start = time.time()
            # Use estimated time from decorator
            estimated_ms = task_def.estimated_time
            update_interval = 0.01  # Update every 10ms

            # Start executing the task in a background thread
            task_result = None
            task_error = None

            def execute_task():
                nonlocal task_result, task_error
                try:
                    # Execute the task function (tasks are independent, no chaining)
                    task_result = task_def.func()
                except Exception as e:
                    task_error = e

            # Start task execution in background
            import threading
            task_thread = threading.Thread(target=execute_task, daemon=True)
            task_thread.start()

            # Update progress while task is running
            elapsed_ms = 0
            last_progress = 0

            while task_thread.is_alive() and elapsed_ms < estimated_ms:
                time.sleep(update_interval)
                elapsed_ms = (time.time() - task_start) * 1000

                # Calculate progress: min(99, elapsed/estimated * 100)
                progress = min(99, int((elapsed_ms / estimated_ms) * 100))

                if progress > last_progress:
                    client.update_task_state(request.run_id, i, 'RUNNING', progress)
                    last_progress = progress

            # Wait for task to complete
            task_thread.join()

            # Calculate actual duration
            actual_duration = int((time.time() - task_start) * 1000)

            # Check for errors
            if task_error:
                client.update_task_state(request.run_id, i, 'FAILED', 0)
                client.send_log(request.run_id, f"[Python Client] ❌ Task {task_def.name} failed: {str(task_error)}")

                # Check if this is a crucial task
                if task_def.crucial_pass:
                    # Crucial task failed - stop the entire flow
                    raise task_error
                else:
                    # Non-crucial task failed - log warning and continue
                    client.send_log(request.run_id, f"[Python Client] ⚠️ Task {task_def.name} failed but marked as non-crucial - continuing flow")
                    continue

            # Store result for next task
            task_results.append(task_result)

            # Send task result to server if it's a TaskResult object
            result_dict = None
            if task_result and hasattr(task_result, 'to_dict'):
                result_dict = task_result.to_dict()
                client.send_log(request.run_id, f"[Python Client] Task result: {task_result.note}")

            # Mark task as completed with actual duration and result
            client.update_task_state(
                request.run_id, i, 'COMPLETED', 100,
                duration_ms=actual_duration,
                result=result_dict
            )
            client.send_log(request.run_id, f"[Python Client] ✓ Task {task_def.name} completed in {actual_duration}ms")

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
