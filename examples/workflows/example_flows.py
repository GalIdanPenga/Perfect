#!/usr/bin/env python3
"""
Perfect Python Client - Flow Definitions

This file demonstrates Perfect's fully automatic Python SDK.
Just define tasks/flows with decorators and call them. That's it!

To run:
    python examples/workflows/example_flows.py

How it works:
1. Calling a flow auto-connects to Perfect and registers it
2. SDK automatically starts listening for execution requests in background
3. Flows execute and report progress in real-time
4. No manual setup, connection, or listener management needed!
"""

import sys
import os
import time

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from perfect.sdk import task, flow, TaskResult


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
    for i in range(2):
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
# Register Flows with Perfect
# ==========================================

if __name__ == "__main__":
    # make a thread for each flow to register them concurrently
    print("[Perfect] Registering flows with Perfect platform...")
    import threading
    threads = []
    for flow_func in [daily_sales_etl, churn_model_retraining, infra_health_check, weekly_report]:
        t = threading.Thread(target=flow_func)
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    # That's it! SDK auto-connects, registers, and listens in background.
    # Keep the script running to handle execution requests.
    import time
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Perfect] Shutting down...")
