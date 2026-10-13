"""
Perfect Python SDK

A minimal workflow orchestration framework for Python with automatic
connection, registration, and execution handling.

Usage:
    from perfect.sdk import task, flow

    @task(estimated_time=2000)
    def my_task():
        return "result"

    @flow(name="My Flow")
    def my_flow():
        my_task()

    if __name__ == "__main__":
        my_flow()  # Auto-connects, registers, and listens

        # Keep running
        import time
        while True:
            time.sleep(1)
"""

import functools
import math
import os
import sys
import threading
import atexit
import time
from typing import Callable, Optional, Any, List, Dict
from dataclasses import dataclass, field, asdict
from enum import Enum


# ============================================================================
# Data Classes
# ============================================================================

class TaskState(Enum):
    """Execution states for tasks and flows"""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


@dataclass
class TaskResult:
    """
    Result of a task execution.

    Attributes:
        passed: Whether the task passed or failed
        note: Optional message about the execution
        table: Optional tabular data (list of dicts with same fields)
    """
    passed: bool
    note: str = ""
    table: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API transmission"""
        return asdict(self)


@dataclass
class TaskDefinition:
    """Metadata for a task function"""
    name: str
    func: Callable
    description: str = ""
    estimated_time: int = 1000  # milliseconds
    crucial_pass: bool = True


@dataclass
class FlowDefinition:
    """Metadata for a flow function"""
    name: str
    func: Callable
    description: str = ""
    tasks: List[TaskDefinition] = field(default_factory=list)
    auto_trigger: bool = False
    auto_trigger_config: str = "development"
    tags: Dict[str, str] = field(default_factory=dict)


# ============================================================================
# Log Capture (for flow execution)
# ============================================================================

# Thread-local storage for tracking which thread is running which flow
_thread_local = threading.local()


class ThreadAwareStdout:
    """
    A stdout wrapper that captures output only from threads running flows.
    Other threads' output goes directly to the real stdout.
    """

    def __init__(self):
        self._lock = threading.Lock()

    def write(self, text: str):
        """Write text - capture if thread is running a flow, otherwise pass through"""
        # Check if current thread has an active log capture
        log_capture = getattr(_thread_local, 'log_capture', None)

        if log_capture is not None:
            # This thread is running a flow - capture the log
            log_capture.write(text)
        else:
            # Normal thread - write directly to real stdout
            sys.__stdout__.write(text)
            sys.__stdout__.flush()

    def flush(self):
        """Flush the stream"""
        log_capture = getattr(_thread_local, 'log_capture', None)
        if log_capture is not None:
            log_capture.flush()
        sys.__stdout__.flush()


class LogCapture:
    """Captures stdout during flow execution and sends to Perfect backend"""

    def __init__(self, client, run_id: str):
        self.client = client
        self.run_id = run_id
        self.buffer = ""
        self._lock = threading.Lock()

    def write(self, text: str):
        """Write text to stdout and buffer for transmission"""
        # Always write to real stdout
        sys.__stdout__.write(text)
        sys.__stdout__.flush()

        with self._lock:
            self.buffer += text

            # Send complete lines as logs to the flow
            while '\n' in self.buffer:
                line, self.buffer = self.buffer.split('\n', 1)
                if line.strip():
                    self.client.send_log(self.run_id, line)

    def flush(self):
        """Flush remaining buffered content"""
        sys.__stdout__.flush()
        with self._lock:
            if self.buffer.strip():
                self.client.send_log(self.run_id, self.buffer)
                self.buffer = ""

    def start_capture(self):
        """Start capturing logs for the current thread"""
        _thread_local.log_capture = self

    def stop_capture(self):
        """Stop capturing logs for the current thread"""
        self.flush()
        _thread_local.log_capture = None


# Global thread-aware stdout - installed once
_thread_aware_stdout = None
_stdout_installed = False


def _ensure_thread_aware_stdout():
    """Install the thread-aware stdout wrapper if not already installed"""
    global _thread_aware_stdout, _stdout_installed
    if not _stdout_installed:
        _thread_aware_stdout = ThreadAwareStdout()
        sys.stdout = _thread_aware_stdout
        _stdout_installed = True


# ============================================================================
# Heartbeat settings from the environment
# ============================================================================

# The backend fails a client's running flows when its heartbeats stop for this
# long. Keep in sync with HEARTBEAT_TIMEOUT_MS in server/engine/FlowEngine.ts;
# the SDK only uses it to warn about an interval that is too long.
HEARTBEAT_SERVER_TIMEOUT_S = 10.0
DEFAULT_HEARTBEAT_INTERVAL_S = 3.0

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off"}


def _env_flag(name: str, default: bool) -> bool:
    """Read a boolean env var such as PERFECT_HEARTBEAT=0. Unknown values keep the default."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    value = raw.strip().lower()
    if value in _TRUE_VALUES:
        return True
    if value in _FALSE_VALUES:
        return False
    print(f"[Perfect SDK] Ignoring {name}={raw!r}: expected one of "
          f"{sorted(_TRUE_VALUES | _FALSE_VALUES)}")
    return default


def _env_positive_float(name: str, default: float) -> float:
    """Read a positive float env var such as PERFECT_HEARTBEAT_INTERVAL=2. Bad values keep the default."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except ValueError:
        value = 0.0
    if not math.isfinite(value) or value <= 0:
        print(f"[Perfect SDK] Ignoring {name}={raw!r}: expected a finite number greater than 0")
        return default
    return value


# ============================================================================
# Workflow Registry (Core Engine)
# ============================================================================

class WorkflowRegistry:
    """
    Core orchestration engine for Perfect.

    Manages task/flow registration and automatic connection to backend.
    """

    def __init__(self):
        # Registry storage
        self._flows: Dict[str, FlowDefinition] = {}
        self._tasks: Dict[str, TaskDefinition] = {}
        self._pending_flows: List[FlowDefinition] = []

        # Client connection
        self._client = None
        self._backend_url = "http://localhost:3000"
        self._client_id = "perfect_example"
        self._mock = False

        # Auto-connection and listening
        self._auto_connect_enabled = True
        self._listener_started = False
        self._listening = False
        # Several flows can start in parallel threads; only one may create the client
        self._client_lock = threading.Lock()

        # Heartbeat lets the backend detect a crashed client. On by default;
        # PERFECT_HEARTBEAT=0 or configure(heartbeat=False) turns it off.
        self._heartbeat_enabled = _env_flag("PERFECT_HEARTBEAT", True)
        self._heartbeat_interval = _env_positive_float(
            "PERFECT_HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL_S
        )

        # Execution context (thread-local for parallel flow support)
        self._execution_context = threading.local()

    # ------------------------------------------------------------------------
    # Thread-local execution context helpers
    # ------------------------------------------------------------------------

    @property
    def _current_run_id(self) -> Optional[str]:
        return getattr(self._execution_context, 'run_id', None)

    @_current_run_id.setter
    def _current_run_id(self, value: Optional[str]):
        self._execution_context.run_id = value

    @property
    def _current_task_index(self) -> int:
        return getattr(self._execution_context, 'task_index', 0)

    @_current_task_index.setter
    def _current_task_index(self, value: int):
        self._execution_context.task_index = value

    # ------------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------------

    def configure(
        self,
        backend_url: Optional[str] = None,
        client_id: Optional[str] = None,
        mock: Optional[bool] = None,
        heartbeat: Optional[bool] = None,
        heartbeat_interval: Optional[float] = None,
    ):
        """
        Configure Perfect client settings. Arguments left as None keep their current value.

        Heartbeat changes made after the client has connected take effect immediately.
        """
        if heartbeat_interval is not None and not (math.isfinite(heartbeat_interval) and heartbeat_interval > 0):
            raise ValueError("heartbeat_interval must be a finite number greater than 0")
        if mock is not None and mock != self._mock and self._client is not None:
            # The client object is built for one mode; swapping it under running
            # flows would strand their run context. Decide before the first flow.
            raise ValueError("mock mode cannot be changed after the client has connected")

        if backend_url is not None:
            self._backend_url = backend_url
        if client_id is not None:
            self._client_id = client_id
        if mock is not None:
            self._mock = mock

        interval_changed = (
            heartbeat_interval is not None and heartbeat_interval != self._heartbeat_interval
        )
        if heartbeat is not None:
            self._heartbeat_enabled = heartbeat
        if heartbeat_interval is not None:
            self._heartbeat_interval = heartbeat_interval

        # Apply to an already-connected client. A real client that is switched
        # to mock mode must stop heartbeating too.
        if self._client is not None:
            if not self._heartbeat_enabled or self._mock:
                self._client.stop_heartbeat()
            else:
                if interval_changed:
                    self._client.stop_heartbeat()
                self._start_heartbeat()

    @property
    def heartbeat_enabled(self) -> bool:
        """Whether this client sends heartbeats to the backend."""
        return self._heartbeat_enabled

    def _start_heartbeat(self):
        """Start heartbeats on the connected client if enabled. Safe to call repeatedly."""
        if not self._client or self._mock or not self._heartbeat_enabled:
            return
        if self._heartbeat_interval >= HEARTBEAT_SERVER_TIMEOUT_S:
            print(f"[Perfect SDK] Warning: heartbeat interval {self._heartbeat_interval}s is not "
                  f"below the backend's {HEARTBEAT_SERVER_TIMEOUT_S:.0f}s timeout; "
                  f"running flows may be failed as disconnected")
        if self._client.start_heartbeat(self._heartbeat_interval):
            print(f"[Perfect SDK] Sending heartbeats every {self._heartbeat_interval:g}s")

    # ------------------------------------------------------------------------
    # Client Connection (Auto)
    # ------------------------------------------------------------------------

    def _ensure_client(self):
        """Auto-connect to backend if not already connected"""
        if self._client or not self._auto_connect_enabled:
            return

        with self._client_lock:
            # Another flow thread may have connected while we waited for the lock
            if self._client:
                return

            print("\n[Perfect SDK] Auto-connecting to backend...")
            from perfect.api import create_client, PerfectAPIClient

            if self._mock:
                self._client = create_client(mock=True)
            else:
                self._client = PerfectAPIClient(base_url=self._backend_url)

            if self._heartbeat_enabled:
                self._start_heartbeat()
            elif not self._mock:
                print("[Perfect SDK] Heartbeat disabled: the backend will not detect if this client crashes")

            self._register_pending_flows()

    def _register_pending_flows(self):
        """Register all pending flows with backend"""
        if not self._pending_flows or not self._client:
            return

        print(f"[Perfect SDK] Registering {len(self._pending_flows)} flows...")
        for flow_def in self._pending_flows:
            self._register_flow_with_backend(flow_def)
        self._pending_flows.clear()
        print(f"[Perfect SDK] All flows registered\n")

    def _register_flow_with_backend(self, flow_def: FlowDefinition) -> Optional[str]:
        """Register a single flow with the backend and return the flow ID"""
        if not self._client:
            return None

        try:
            # Analyze flow to get task information
            analyzed_flow = self._analyze_flow(flow_def.func.__name__)

            # Convert to API format
            payload = self._flow_to_dict(analyzed_flow)

            # Register with backend (auto_trigger=False to prevent server execution requests)
            # Returns the flow object including 'id'
            flow = self._client.register_flow(
                payload,
                auto_trigger=False,
                configuration=flow_def.auto_trigger_config
            )

            if flow and 'id' in flow:
                return flow['id']
            return None
        except Exception as e:
            print(f"[Perfect SDK] Warning: Failed to register flow '{flow_def.name}': {e}")
            return None

    # ------------------------------------------------------------------------
    # Auto Listener (Background Thread)
    # ------------------------------------------------------------------------

    def _auto_start_listener(self):
        """Start background listener after first flow registration"""
        if self._listener_started or not self._client:
            return

        self._listener_started = True

        def run_listener():
            """Background listener thread"""
            from perfect.executor import create_execution_handler

            if not self._client:
                return

            print("\n" + "=" * 60)
            print("Perfect - Auto-Listening for Execution Requests")
            print("=" * 60 + "\n")

            # Track flow completion
            total_flows = len(self._flows)
            completed_count = {'value': 0}
            lock = threading.Lock()

            def on_flow_complete(flow_name: str):
                with lock:
                    completed_count['value'] += 1
                    print(f"\n[Perfect] Completed {completed_count['value']}/{total_flows} flows")

                    if completed_count['value'] >= total_flows:
                        print("[Perfect] All flows completed. Shutting down...")
                        self._client.stop_listening()

            try:
                handler = create_execution_handler(self._client, on_flow_complete)
                self._client.on_execution_request(handler)
                self._listening = True
                self._client.listen_for_executions(
                    heartbeat=self._heartbeat_enabled,
                    heartbeat_interval=self._heartbeat_interval,
                )
            except KeyboardInterrupt:
                print("\n[Perfect] Shutting down...")
            finally:
                if self._client:
                    self._client.close()

        # Cleanup on exit
        def cleanup():
            if self._client and self._listening:
                self._client.close()

        atexit.register(cleanup)

        # Start listener thread
        listener_thread = threading.Thread(target=run_listener, daemon=False)
        listener_thread.start()

    # ------------------------------------------------------------------------
    # Decorators
    # ------------------------------------------------------------------------

    def task(
        self,
        name: Optional[str] = None,
        estimated_time: int = 1000,
        crucial_pass: bool = True
    ) -> Callable:
        """
        Decorator to register a function as a task.

        Args:
            name: Human-readable task name (optional, defaults to function name)
            estimated_time: Expected duration in milliseconds (default: 1000)
            crucial_pass: If True, task failure fails the flow (default: True)

        Example:
            @task(name="Extract Data", estimated_time=3000)
            def my_task():
                return "result"
        """
        def decorator(func: Callable) -> Callable:
            # Extract description from docstring
            description = (func.__doc__ or "").strip().split('\n')[0]

            # Use provided name or fall back to function name
            task_name = name or func.__name__

            # Create task definition
            task_def = TaskDefinition(
                name=task_name,
                func=func,
                description=description,
                estimated_time=estimated_time,
                crucial_pass=crucial_pass
            )

            self._tasks[func.__name__] = task_def

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # Check if we're in a tracked flow execution
                if self._current_run_id and self._client:
                    return self._execute_tracked_task(task_def, func, args, kwargs)
                else:
                    # Direct execution without tracking
                    print(f"[Task] Executing {task_name}...")
                    return func(*args, **kwargs)

            return wrapper
        return decorator

    def _execute_tracked_task(self, task_def: TaskDefinition, func: Callable, args: tuple, kwargs: dict) -> Any:
        """Execute a task with server tracking"""
        import time as time_module
        import threading

        run_id = self._current_run_id
        task_index = self._current_task_index
        self._current_task_index += 1

        print(f"[Task] Executing {task_def.name} (task {task_index})...")

        # Mark task as running (include task name, estimated time, and crucial_pass for dynamic task creation)
        self._client.update_task_state(run_id, task_index, 'RUNNING', 0, task_name=task_def.name, estimated_time=task_def.estimated_time, crucial_pass=task_def.crucial_pass)

        task_start = time_module.time()
        estimated_ms = task_def.estimated_time
        task_result = None
        task_error = None

        # Get the current log capture from the flow thread (if any)
        parent_log_capture = getattr(_thread_local, 'log_capture', None)

        # Execute task in background thread for progress updates
        def execute_task():
            nonlocal task_result, task_error
            # Inherit the log capture from the parent flow thread
            if parent_log_capture is not None:
                _thread_local.log_capture = parent_log_capture
            try:
                task_result = func(*args, **kwargs)
            except Exception as e:
                task_error = e
            finally:
                # Clear the log capture for this thread
                _thread_local.log_capture = None

        task_thread = threading.Thread(target=execute_task, daemon=True)
        task_thread.start()

        # Update progress while task is running
        # Send updates every 100ms to let the server calculate progress using its statistics
        last_update_time = time_module.time()
        while task_thread.is_alive():
            time_module.sleep(0.01)  # 10ms sleep interval
            now = time_module.time()
            # Send update every 100ms (server calculates actual progress from its estimatedTime)
            if now - last_update_time >= 0.1:
                self._client.update_task_state(run_id, task_index, 'RUNNING')
                last_update_time = now

        task_thread.join()

        # Calculate actual duration
        actual_duration = int((time_module.time() - task_start) * 1000)

        if task_error:
            # Task failed
            error_result = {
                'passed': False,
                'note': str(task_error),
                'table': []
            }
            self._client.update_task_state(
                run_id, task_index, 'FAILED', 0,
                duration_ms=actual_duration,
                result=error_result
            )
            print(f"[Task] {task_def.name} failed: {task_error}")

            if task_def.crucial_pass:
                raise task_error
            return None

        # Check if task returned a result with passed=False
        result_dict = None
        if task_result and hasattr(task_result, 'to_dict'):
            result_dict = task_result.to_dict()

        # Check if task explicitly failed via passed=False
        task_passed = True
        if task_result and hasattr(task_result, 'passed'):
            task_passed = task_result.passed

        if not task_passed:
            # Task returned passed=False - treat as failure
            self._client.update_task_state(
                run_id, task_index, 'FAILED', 0,
                duration_ms=actual_duration,
                result=result_dict
            )
            print(f"[Task] {task_def.name} failed: {result_dict.get('note', 'Task returned passed=False') if result_dict else 'Task returned passed=False'}")

            if task_def.crucial_pass:
                raise Exception(f"Task '{task_def.name}' failed: {result_dict.get('note', 'passed=False') if result_dict else 'passed=False'}")
            return task_result

        # Task completed successfully
        self._client.update_task_state(
            run_id, task_index, 'COMPLETED', 100,
            duration_ms=actual_duration,
            result=result_dict
        )
        print(f"[Task] {task_def.name} completed in {actual_duration}ms")

        return task_result

    def flow(
        self,
        name: str,
        description: str = "",
        auto_trigger: bool = False,
        auto_trigger_config: str = "development",
        tags: Optional[Dict[str, str]] = None
    ) -> Callable:
        """
        Decorator to register a function as a flow.

        Args:
            name: Human-readable flow name
            description: What the flow does
            auto_trigger: Auto-trigger after registration
            auto_trigger_config: Configuration for auto-trigger
            tags: Metadata tags (e.g., {"version": "v1.0"})

        Example:
            @flow(name="Daily ETL", tags={"version": "v1.0"})
            def daily_etl():
                my_task()
        """
        def decorator(func: Callable) -> Callable:
            # Create flow definition
            flow_def = FlowDefinition(
                name=name,
                func=func,
                description=description,
                auto_trigger=auto_trigger,
                auto_trigger_config=auto_trigger_config,
                tags=tags or {}
            )

            self._flows[func.__name__] = flow_def

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # Auto-connect to backend
                self._ensure_client()

                # Register flow for THIS execution and get the flow ID directly
                # This avoids race conditions when multiple threads run the same flow
                flow_id = None
                if self._client:
                    flow_id = self._register_flow_with_backend(flow_def)
                else:
                    self._pending_flows.append(flow_def)

                # Execute flow with backend tracking for UI visibility
                print(f"[Flow] Starting {name}...")

                if self._client and flow_id:
                    # Create a run on the server for UI tracking. All server
                    # traffic goes through the client, which serializes it.
                    run_id = self._client.create_run(flow_id, "development")
                    if run_id:
                        print(f"[Flow] Created run: {run_id}")

                        # Set execution context for task tracking
                        self._current_run_id = run_id
                        self._current_task_index = 0

                        # Install thread-aware stdout if not already done
                        _ensure_thread_aware_stdout()

                        # Create log capture for this flow and start capturing for this thread
                        log_capture = LogCapture(self._client, run_id)
                        log_capture.start_capture()

                        try:
                            # Execute the actual flow function
                            result = func(*args, **kwargs)

                            # Signal flow completion with actual task count
                            actual_task_count = self._current_task_index
                            self._client.complete_flow(run_id, actual_task_count)
                            print(f"[Flow] Completed {name} with {actual_task_count} tasks")
                            # Return both the flow result and run_id as a tuple
                            return (result, run_id)
                        except Exception as e:
                            print(f"[Flow] Flow {name} failed: {e}")
                            raise
                        finally:
                            # Stop capturing logs for this thread
                            log_capture.stop_capture()
                            # Clear execution context
                            self._current_run_id = None
                            self._current_task_index = 0
                    else:
                        # Server refused or unreachable: run without tracking
                        print(f"[Flow] Warning: Create run failed, executing without tracking")
                        self._current_run_id = None
                        self._current_task_index = 0
                        result = func(*args, **kwargs)
                else:
                    # No client or flow registration failed, execute directly
                    if self._client and not flow_id:
                        print(f"[Flow] Warning: Flow registration failed, executing without tracking")
                    result = func(*args, **kwargs)

                print(f"[Flow] Completed {name}")
                return result

            return wrapper
        return decorator

    # ------------------------------------------------------------------------
    # Flow Analysis
    # ------------------------------------------------------------------------

    def _analyze_flow(self, flow_name: str) -> FlowDefinition:
        """Analyze flow to determine which tasks it uses (internal)"""
        if flow_name not in self._flows:
            raise ValueError(f"Flow {flow_name} not found")

        flow_def = self._flows[flow_name]

        # Static analysis: find task calls in source code
        import inspect
        source = inspect.getsource(flow_def.func)

        tasks_in_flow = []
        for task_name, task_def in self._tasks.items():
            if f"{task_name}(" in source:
                tasks_in_flow.append(task_def)

        flow_def.tasks = tasks_in_flow
        return flow_def

    def analyze_flow(self, flow_name: str) -> FlowDefinition:
        """Analyze flow to determine which tasks it uses (public API)"""
        return self._analyze_flow(flow_name)

    def _flow_to_dict(self, flow_def: FlowDefinition) -> Dict[str, Any]:
        """Convert flow definition to API format"""
        return {
            "name": flow_def.name,
            "description": flow_def.description,
            "tags": flow_def.tags,
            "tasks": [
                {
                    "name": task.name,
                    "description": task.description,
                    "estimatedTime": task.estimated_time,
                    "crucialPass": task.crucial_pass
                }
                for task in flow_def.tasks
            ]
        }

    # ------------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------------

    def get_flows(self) -> List[FlowDefinition]:
        """Get all registered flows"""
        return list(self._flows.values())

    def get_tasks(self) -> List[TaskDefinition]:
        """Get all registered tasks"""
        return list(self._tasks.values())

    def get_report(self, run_id: str) -> Optional[Dict[str, Any]]:
        """
        Get report for a specific run ID.

        Args:
            run_id: The run ID to get the report for

        Returns:
            Report dictionary with metadata, or None if not found
        """
        self._ensure_client()
        if not self._client:
            print("[Perfect SDK] Warning: No client connection available")
            return None

        return self._client.get_report(run_id)

    def download_report(self, run_id: str, output_dir: str = "Reports") -> Optional[str]:
        """
        Download a report and save it locally.

        Args:
            run_id: The run ID to download the report for
            output_dir: Base directory to save reports (default: "Reports")

        Returns:
            Local file path if successful, None otherwise
        """
        import os

        # Get report metadata
        report = self.get_report(run_id)
        if not report:
            print(f"[Perfect SDK] No report available for run: {run_id}")
            return None

        # Download the report HTML through the client (serialized with all
        # other server traffic)
        html = self._client.fetch_text(report['url'], timeout=10)
        if html is None:
            print(f"[Perfect SDK] Failed to download report for run: {run_id}")
            return None

        # Create local directory structure matching server (Reports/FlowName/)
        local_dir = os.path.join(output_dir, report['path'].split('/')[1])
        os.makedirs(local_dir, exist_ok=True)

        # Save the report locally
        local_path = os.path.join(output_dir, *report['path'].split('/')[1:])
        try:
            with open(local_path, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"[Perfect SDK] Report saved: {local_path} ({report['size'] / 1024:.2f} KB)")
            return local_path
        except IOError as e:
            print(f"[Perfect SDK] Failed to save report: {e}")
            return None


# ============================================================================
# Global Registry and Exports
# ============================================================================

# Create default global instance
_default_registry = WorkflowRegistry()

# Export decorators from default instance
task = _default_registry.task
flow = _default_registry.flow


def get_registry() -> WorkflowRegistry:
    """Get the default Perfect registry instance"""
    return _default_registry


# ============================================================================
# Public API Functions
# ============================================================================

def configure(
    backend_url: Optional[str] = None,
    client_id: Optional[str] = None,
    mock: Optional[bool] = None,
    heartbeat: Optional[bool] = None,
    heartbeat_interval: Optional[float] = None,
):
    """
    Configure Perfect client settings (optional).

    Call before calling any flows if you need custom settings. Any argument
    left as None keeps its current value.
    Defaults: backend_url="http://localhost:3000", client_id="perfect_example",
    heartbeat on every 3 seconds.

    Args:
        backend_url: URL of the Perfect backend server
        client_id: Unique identifier for this client
        mock: If True, run in mock mode without backend
        heartbeat: If False, send no heartbeats. The backend then cannot detect
            a crashed client, and its running flows stay RUNNING until stopped
            from the UI. Also settable with the PERFECT_HEARTBEAT env var.
        heartbeat_interval: Seconds between heartbeats. Must stay below the
            backend's 10 second timeout. Also settable with PERFECT_HEARTBEAT_INTERVAL.

    Example:
        configure(heartbeat=False)
        configure(backend_url="http://localhost:3000", client_id="my_app")
    """
    _default_registry.configure(
        backend_url=backend_url,
        client_id=client_id,
        mock=mock,
        heartbeat=heartbeat,
        heartbeat_interval=heartbeat_interval,
    )


def get_report(run_id: str) -> Optional[Dict[str, Any]]:
    """
    Get report metadata for a specific run ID.

    Args:
        run_id: The run ID to get the report for (returned from flow execution)

    Returns:
        Report dictionary with metadata, or None if not found

    Example:
        result, run_id = my_flow()
        time.sleep(2)  # Wait for report generation
        report = get_report(run_id)
        if report:
            print(f"Report URL: {report['url']}")
    """
    return _default_registry.get_report(run_id)


def download_report(run_id: str, output_dir: str = "Reports") -> Optional[str]:
    """
    Download a report and save it locally.

    Args:
        run_id: The run ID to download the report for
        output_dir: Base directory to save reports (default: "Reports")

    Returns:
        Local file path if successful, None otherwise

    Example:
        result, run_id = my_flow()
        time.sleep(2)  # Wait for report generation
        local_path = download_report(run_id)
        if local_path:
            print(f"Report saved to: {local_path}")
    """
    return _default_registry.download_report(run_id, output_dir)


def listen():
    """
    Manually start listening for execution requests (optional).

    This is automatically called when you call a flow, so you typically
    don't need to call this unless you want explicit control.

    Example:
        my_flow()  # Registers and auto-starts listener
        listen()   # Optional: blocks until interrupted
    """
    from perfect.executor import create_execution_handler

    # Ensure client is initialized
    _default_registry._ensure_client()

    if not _default_registry._client:
        print("[Perfect SDK] Error: Could not connect to backend")
        return

    client = _default_registry._client

    print("\n" + "=" * 60)
    print("Perfect Python Client - Listening for Execution Requests")
    print("=" * 60)

    # Track completion
    total_flows = len(_default_registry.get_flows())
    completed_count = {'value': 0}
    lock = threading.Lock()

    def on_flow_complete(flow_name: str):
        with lock:
            completed_count['value'] += 1
            print(f"\n[Perfect Client] Completed {completed_count['value']}/{total_flows} flows")

            if completed_count['value'] >= total_flows:
                print("[Perfect Client] All flows completed. Shutting down...")
                client.stop_listening()

    try:
        handler = create_execution_handler(client, on_flow_complete)
        client.on_execution_request(handler)
        client.listen_for_executions(
            heartbeat=_default_registry.heartbeat_enabled,
            heartbeat_interval=_default_registry._heartbeat_interval,
        )
    except KeyboardInterrupt:
        print("\n\n[Perfect Client] Shutting down...")
    finally:
        client.close()


def connect(
    backend_url: Optional[str] = None,
    client_id: Optional[str] = None,
    mock: Optional[bool] = None
):
    """
    Configure and start listening (convenience function).

    Equivalent to: configure() + listen(). Arguments left as None keep the
    current settings (backend http://localhost:3000 by default).

    Args:
        backend_url: URL of the Perfect backend server
        client_id: Unique identifier for this client
        mock: If True, run in mock mode without backend

    Example:
        my_flow()
        connect()  # Configure and listen
    """
    configure(backend_url=backend_url, client_id=client_id, mock=mock)
    listen()


def run(
    backend_url: Optional[str] = None,
    client_id: Optional[str] = None,
    mock: Optional[bool] = None
):
    """
    Alias for connect() (kept for backward compatibility).

    Note: Prefer using automatic connection by just calling flows,
    or use listen() for explicit control.
    """
    connect(backend_url=backend_url, client_id=client_id, mock=mock)
