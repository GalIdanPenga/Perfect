"""
Perfect Flow Executor

Handles execution of flows when requested by the Perfect backend via execution requests.
The actual task tracking is handled by the SDK's @task decorator.
"""

import threading
from typing import Callable

from .api import PerfectAPIClient, ExecutionRequest
from .sdk import get_registry


def create_execution_handler(client: PerfectAPIClient, on_flow_complete: Callable[[str], None] = None):
    """
    Create a threaded execution handler for concurrent flow execution.

    This function creates a handler that:
    - Receives execution requests from the Perfect backend
    - Looks up the flow function and executes it
    - The SDK's @task and @flow decorators handle all task tracking
    - Optionally calls a callback when flows complete

    Args:
        client: PerfectAPIClient instance
        on_flow_complete: Optional callback to invoke when a flow completes (receives flow_name)

    Returns:
        A function that can be passed to client.on_execution_request()
    """
    registry = get_registry()

    def threaded_handler(request: ExecutionRequest):
        """Handler that executes flows in background threads"""
        def wrapped_execution():
            # Find the flow
            flow_def = None
            for f in registry.get_flows():
                if f.name == request.flow_name:
                    flow_def = f
                    break

            if not flow_def:
                client.send_log(request.run_id, f"[Python Client] ❌ Flow '{request.flow_name}' not found")
                if on_flow_complete:
                    on_flow_complete(request.flow_name)
                return

            try:
                # Simply call the flow function
                # The SDK's @flow and @task decorators handle all tracking
                client.send_log(request.run_id, f"[Python Client] Starting flow: {request.flow_name}")
                flow_def.func()
                client.send_log(request.run_id, f"[Python Client] ✓ Flow completed: {request.flow_name}")
            except Exception as e:
                client.send_log(request.run_id, f"[Python Client] ❌ Flow failed: {str(e)}")

            # Call completion callback if provided
            if on_flow_complete:
                on_flow_complete(request.flow_name)

        # Start execution in a separate thread
        thread = threading.Thread(target=wrapped_execution, daemon=True)
        thread.start()

    return threaded_handler
