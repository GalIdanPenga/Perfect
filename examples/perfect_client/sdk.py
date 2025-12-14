"""
Perfect Python SDK

A minimal workflow orchestration framework for Python with automatic
connection, registration, and execution handling.

Usage:
    from perfect_client.sdk import task, flow

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
import sys
import threading
import atexit
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
    weight: int = 1
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
# Log Capture (for task execution)
# ============================================================================

class LogCapture:
    """Captures stdout during task execution and sends to Perfect backend"""

    def __init__(self, client, run_id: str):
        self.client = client
        self.run_id = run_id
        self.buffer = ""

    def write(self, text: str):
        """Write text to stdout and buffer for transmission"""
        sys.__stdout__.write(text)
        sys.__stdout__.flush()

        self.buffer += text

        # Send complete lines as logs
        while '\n' in self.buffer:
            line, self.buffer = self.buffer.split('\n', 1)
            if line.strip():
                self.client.send_log(self.run_id, f"[Task Output] {line}")

    def flush(self):
        """Flush remaining buffered content"""
        sys.__stdout__.flush()
        if self.buffer.strip():
            self.client.send_log(self.run_id, f"[Task Output] {self.buffer}")
            self.buffer = ""


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

    # ------------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------------

    def configure(
        self,
        backend_url: str = "http://localhost:3001",
        client_id: str = "perfect_example",
        mock: bool = False
    ):
        """Configure Perfect client settings"""
        self._backend_url = backend_url
        self._client_id = client_id
        self._mock = mock

    # ------------------------------------------------------------------------
    # Client Connection (Auto)
    # ------------------------------------------------------------------------

    def _ensure_client(self):
        """Auto-connect to backend if not already connected"""
        if self._client or not self._auto_connect_enabled:
            return

        print("\n[Perfect SDK] Auto-connecting to backend...")
        from perfect_client.api import create_client, PerfectAPIClient

        if self._mock:
            self._client = create_client(mock=True)
        else:
            self._client = PerfectAPIClient(base_url=self._backend_url)

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

    def _register_flow_with_backend(self, flow_def: FlowDefinition):
        """Register a single flow with the backend"""
        if not self._client:
            return

        try:
            # Analyze flow to get task information
            analyzed_flow = self._analyze_flow(flow_def.func.__name__)

            # Convert to API format
            payload = self._flow_to_dict(analyzed_flow)

            # Register with backend
            self._client.register_flow(
                payload,
                auto_trigger=flow_def.auto_trigger,
                configuration=flow_def.auto_trigger_config
            )
        except Exception as e:
            print(f"[Perfect SDK] Warning: Failed to register flow '{flow_def.name}': {e}")

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
            from perfect_client.executor import create_execution_handler

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
                self._client.listen_for_executions()
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
        estimated_time: int = 1000,
        crucial_pass: bool = True
    ) -> Callable:
        """
        Decorator to register a function as a task.

        Args:
            estimated_time: Expected duration in milliseconds (default: 1000)
            crucial_pass: If True, task failure fails the flow (default: True)

        Example:
            @task(estimated_time=3000)
            def my_task():
                return "result"
        """
        def decorator(func: Callable) -> Callable:
            # Extract description from docstring
            description = (func.__doc__ or "").strip().split('\n')[0]

            # Create task definition
            task_def = TaskDefinition(
                name=func.__name__,
                func=func,
                description=description,
                weight=estimated_time,
                estimated_time=estimated_time,
                crucial_pass=crucial_pass
            )

            self._tasks[func.__name__] = task_def

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                print(f"[Task] Executing {func.__name__}...")
                return func(*args, **kwargs)

            return wrapper
        return decorator

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
            registered = {'value': False}

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                # Lazy registration on first call
                if not registered['value']:
                    # Auto-connect to backend
                    self._ensure_client()

                    # Register flow
                    if self._client:
                        self._register_flow_with_backend(flow_def)
                    else:
                        self._pending_flows.append(flow_def)

                    registered['value'] = True

                    # Start background listener
                    self._auto_start_listener()

                # Execute flow
                print(f"[Flow] Starting {name}...")
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
                    "weight": task.weight,
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
    backend_url: str = "http://localhost:3001",
    client_id: str = "perfect_example",
    mock: bool = False
):
    """
    Configure Perfect client settings (optional).

    Call before calling any flows if you need custom settings.
    Defaults: backend_url="http://localhost:3001", client_id="perfect_example"

    Args:
        backend_url: URL of the Perfect backend server
        client_id: Unique identifier for this client
        mock: If True, run in mock mode without backend

    Example:
        configure(backend_url="http://localhost:3001", client_id="my_app")
    """
    _default_registry.configure(
        backend_url=backend_url,
        client_id=client_id,
        mock=mock
    )


def listen():
    """
    Manually start listening for execution requests (optional).

    This is automatically called when you call a flow, so you typically
    don't need to call this unless you want explicit control.

    Example:
        my_flow()  # Registers and auto-starts listener
        listen()   # Optional: blocks until interrupted
    """
    from perfect_client.executor import create_execution_handler

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
        client.listen_for_executions()
    except KeyboardInterrupt:
        print("\n\n[Perfect Client] Shutting down...")
    finally:
        client.close()


def connect(
    backend_url: str = "http://localhost:3001",
    client_id: str = "perfect_example",
    mock: bool = False
):
    """
    Configure and start listening (convenience function).

    Equivalent to: configure() + listen()

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
    backend_url: str = "http://localhost:3001",
    client_id: str = "perfect_example",
    mock: bool = False
):
    """
    Alias for connect() (kept for backward compatibility).

    Note: Prefer using automatic connection by just calling flows,
    or use listen() for explicit control.
    """
    connect(backend_url=backend_url, client_id=client_id, mock=mock)
