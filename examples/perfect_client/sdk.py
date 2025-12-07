"""
Perfect Python SDK

A workflow orchestration framework for Python that enables decorative
definition of tasks and flows with weight-based progress tracking.
"""

import functools
import time
from typing import Callable, Optional, Any, List, Dict
from dataclasses import dataclass, field
from enum import Enum


class TaskState(Enum):
    """Execution states for tasks and flows"""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


@dataclass
class TaskDefinition:
    """Metadata for a task function"""
    name: str
    func: Callable
    description: str = ""
    weight: int = 1
    estimated_time: int = 1000  # milliseconds


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


class WorkflowRegistry:
    """
    Main Perfect orchestration engine.

    Manages registration of flows and tasks, and provides execution capabilities.
    """

    def __init__(self, client=None):
        self._flows: Dict[str, FlowDefinition] = {}
        self._tasks: Dict[str, TaskDefinition] = {}
        self._client = client
        self._pending_flows: List[FlowDefinition] = []  # Flows waiting for client to be set

    def set_client(self, client):
        """
        Set the API client and register all pending flows.

        Args:
            client: PerfectAPIClient instance for registering flows with backend
        """
        self._client = client

        # Register all pending flows
        if self._pending_flows:
            print(f"\n[WorkflowRegistry] Registering {len(self._pending_flows)} pending flows...")
            for flow_def in self._pending_flows:
                self._register_flow_with_backend(flow_def)
            self._pending_flows.clear()
            print(f"[WorkflowRegistry] All flows registered with backend\n")

    def _register_flow_with_backend(self, flow_def: FlowDefinition):
        """
        Internal method to register a flow with the Perfect backend.

        Args:
            flow_def: FlowDefinition to register
        """
        if not self._client:
            return

        try:
            # Analyze flow to get task information
            analyzed_flow = self.analyze_flow(flow_def.func.__name__)

            # Convert to API format
            payload = self.to_dict(analyzed_flow)

            # Register with Perfect backend, passing auto_trigger settings
            self._client.register_flow(
                payload,
                auto_trigger=flow_def.auto_trigger,
                configuration=flow_def.auto_trigger_config
            )
        except Exception as e:
            print(f"[WorkflowRegistry] Warning: Failed to auto-register flow '{flow_def.name}': {e}")

    def task(self, estimated_time: int = 1000) -> Callable:
        """
        Decorator to register a function as a task.

        Args:
            estimated_time: Expected duration in milliseconds (default: 1000)
                           Weight will be calculated automatically based on time estimation

        Example:
            @task(estimated_time=3000)
            def extract_data():
                # Task implementation
                pass
        """
        def decorator(func: Callable) -> Callable:
            # Extract docstring as description
            description = (func.__doc__ or "").strip().split('\n')[0]

            task_def = TaskDefinition(
                name=func.__name__,
                func=func,
                description=description,
                weight=estimated_time,  # Use estimated_time as weight initially
                estimated_time=estimated_time
            )

            self._tasks[func.__name__] = task_def

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                print(f"[Task] Executing {func.__name__}...")
                result = func(*args, **kwargs)
                return result

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
            name: Human-readable name for the flow
            description: Description of what the flow does
            auto_trigger: If True, automatically trigger the flow after registration
            auto_trigger_config: Configuration to use when auto-triggering (default: "development")
            tags: Optional dictionary of metadata tags (e.g., {"version": "v0.1", "id": "452"})

        Example:
            @flow(
                name="Daily ETL",
                description="Extract, transform, and load daily data",
                auto_trigger=True,
                tags={"version": "v0.1", "id": "452"}
            )
            def daily_etl():
                # Flow implementation
                pass
        """
        def decorator(func: Callable) -> Callable:
            flow_def = FlowDefinition(
                name=name,
                func=func,
                description=description,
                auto_trigger=auto_trigger,
                auto_trigger_config=auto_trigger_config,
                tags=tags or {}
            )

            self._flows[func.__name__] = flow_def

            # Auto-register with backend if client is available
            if self._client:
                self._register_flow_with_backend(flow_def)
            else:
                # Queue for registration when client is set
                self._pending_flows.append(flow_def)

            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                print(f"[Flow] Starting {name}...")
                result = func(*args, **kwargs)
                print(f"[Flow] Completed {name}")
                return result

            return wrapper
        return decorator

    def get_flows(self) -> List[FlowDefinition]:
        """Get all registered flows"""
        return list(self._flows.values())

    def get_tasks(self) -> List[TaskDefinition]:
        """Get all registered tasks"""
        return list(self._tasks.values())

    def analyze_flow(self, flow_name: str) -> FlowDefinition:
        """
        Analyze a flow to determine which tasks it uses.

        This performs static analysis of the flow's source code to identify
        task calls and build the complete flow definition.
        """
        if flow_name not in self._flows:
            raise ValueError(f"Flow {flow_name} not found")

        flow_def = self._flows[flow_name]

        # Get the flow function's source code
        import inspect
        source = inspect.getsource(flow_def.func)

        # Find all task calls in the source
        tasks_in_flow = []
        for task_name, task_def in self._tasks.items():
            if f"{task_name}(" in source:
                tasks_in_flow.append(task_def)

        flow_def.tasks = tasks_in_flow
        return flow_def

    def to_dict(self, flow_def: FlowDefinition) -> Dict[str, Any]:
        """Convert a flow definition to a dictionary for API transmission"""
        return {
            "name": flow_def.name,
            "description": flow_def.description,
            "tags": flow_def.tags,
            "tasks": [
                {
                    "name": task.name,
                    "description": task.description,
                    "weight": task.weight,
                    "estimatedTime": task.estimated_time
                }
                for task in flow_def.tasks
            ]
        }


# Create a default global instance for convenience
_default_registry = WorkflowRegistry()

# Export decorators from the default instance
task = _default_registry.task
flow = _default_registry.flow


def get_registry() -> WorkflowRegistry:
    """Get the default Perfect instance"""
    return _default_registry
