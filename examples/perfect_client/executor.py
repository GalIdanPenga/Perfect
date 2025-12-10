"""
Perfect Flow Executor

This module handles the execution of flows when requested by the Perfect backend.
It coordinates task execution, progress tracking, and log transmission.

For implementing a Perfect client in another language, this is the core
execution logic that needs to be ported.
"""

import sys
import time
import threading
from typing import Callable

from .api import PerfectAPIClient, ExecutionRequest
from .sdk import get_registry, LogCapture


class FlowExecutor:
    """
    Executes flows when requested by Perfect backend.

    This class is responsible for:
    - Receiving execution requests from Perfect
    - Orchestrating task execution in sequence
    - Capturing stdout/stderr from tasks
    - Sending progress updates and logs to Perfect
    - Handling task failures and flow termination
    """

    def __init__(self, client: PerfectAPIClient):
        """
        Initialize the flow executor.

        Args:
            client: PerfectAPIClient instance for communication with backend
        """
        self.client = client
        self.registry = get_registry()

    def handle_execution_request(self, request: ExecutionRequest):
        """
        Handle an execution request from Perfect.

        This is the main entry point for flow execution. It:
        1. Looks up the flow definition
        2. Executes tasks sequentially
        3. Captures stdout and sends as logs
        4. Updates task states and progress
        5. Handles errors and failures

        Args:
            request: ExecutionRequest with run_id, flow_name, and configuration
        """
        config_upper = request.configuration.upper()

        # Send initial logs
        self.client.send_log(request.run_id, f"[Python Client] Received execution request with configuration: {config_upper}")
        self.client.send_log(request.run_id, f"[Python Client] Initializing flow execution...")

        # Get the flow to execute
        flow_def = None
        for f in self.registry.get_flows():
            if f.name == request.flow_name:
                flow_def = f
                break

        if not flow_def:
            self.client.send_log(request.run_id, f"[Python Client] ❌ Flow '{request.flow_name}' not found")
            return

        # Analyze flow to get tasks
        analyzed_flow = self.registry.analyze_flow(flow_def.func.__name__)
        total_tasks = len(analyzed_flow.tasks)

        # Execute the flow
        start_time = time.time()
        current_task_index = -1
        task_results = []  # Store task results for passing between tasks

        try:
            # Execute tasks sequentially
            for i, task_def in enumerate(analyzed_flow.tasks):
                current_task_index = i
                self.client.send_log(request.run_id, f"[Python Client] Starting task {i+1}/{total_tasks}: {task_def.name}")
                self.client.update_task_state(request.run_id, i, 'RUNNING', 0)

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
                        # Capture stdout and send print() statements to Perfect
                        old_stdout = sys.stdout
                        sys.stdout = LogCapture(self.client, request.run_id)

                        try:
                            # Execute the task function (tasks are independent, no chaining)
                            task_result = task_def.func()
                        finally:
                            # Flush any remaining buffered output
                            sys.stdout.flush()
                            # Restore original stdout
                            sys.stdout = old_stdout
                    except Exception as e:
                        task_error = e

                # Start task execution in background
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
                        self.client.update_task_state(request.run_id, i, 'RUNNING', progress)
                        last_progress = progress

                # Wait for task to complete
                task_thread.join()

                # Calculate actual duration
                actual_duration = int((time.time() - task_start) * 1000)

                # Check for errors
                if task_error:
                    # Create error result with exception message as note
                    error_result = {
                        'passed': False,
                        'note': str(task_error),
                        'table': []
                    }

                    self.client.update_task_state(
                        request.run_id, i, 'FAILED', 0,
                        duration_ms=actual_duration,
                        result=error_result
                    )
                    self.client.send_log(request.run_id, f"[Python Client] ❌ Task {task_def.name} failed: {str(task_error)}")

                    # Check if this is a crucial task
                    if task_def.crucial_pass:
                        # Crucial task failed - stop the entire flow
                        raise task_error
                    else:
                        # Non-crucial task failed - log warning and continue
                        self.client.send_log(request.run_id, f"[Python Client] ⚠️ Task {task_def.name} failed but marked as non-crucial - continuing flow")
                        continue

                # Store result for next task
                task_results.append(task_result)

                # Send task result to server if it's a TaskResult object
                result_dict = None
                if task_result and hasattr(task_result, 'to_dict'):
                    result_dict = task_result.to_dict()
                    self.client.send_log(request.run_id, f"[Python Client] Task result: {task_result.note}")

                # Mark task as completed with actual duration and result
                self.client.update_task_state(
                    request.run_id, i, 'COMPLETED', 100,
                    duration_ms=actual_duration,
                    result=result_dict
                )
                self.client.send_log(request.run_id, f"[Python Client] ✓ Task {task_def.name} completed in {actual_duration}ms")

            duration = int((time.time() - start_time) * 1000)
            self.client.send_log(request.run_id, f"[Python Client] ✓ Flow execution completed successfully in {duration}ms")

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            # Mark the current task as failed if we were executing one
            if current_task_index >= 0:
                # Create error result with exception message as note
                error_result = {
                    'passed': False,
                    'note': str(e),
                    'table': []
                }
                self.client.update_task_state(
                    request.run_id, current_task_index, 'FAILED', 0,
                    result=error_result
                )
            self.client.send_log(request.run_id, f"[Python Client] ❌ Flow execution failed after {duration}ms: {str(e)}")


def create_execution_handler(client: PerfectAPIClient, on_flow_complete: Callable[[str], None] = None):
    """
    Create a threaded execution handler for concurrent flow execution.

    This function creates a handler that:
    - Executes flows in separate threads for concurrency
    - Tracks completion of flows
    - Optionally calls a callback when flows complete

    Args:
        client: PerfectAPIClient instance
        on_flow_complete: Optional callback to invoke when a flow completes (receives flow_name)

    Returns:
        A function that can be passed to client.on_execution_request()
    """
    executor = FlowExecutor(client)

    def threaded_handler(request: ExecutionRequest):
        """Handler that executes flows in background threads"""
        def wrapped_execution():
            # Execute the flow
            executor.handle_execution_request(request)

            # Call completion callback if provided
            if on_flow_complete:
                on_flow_complete(request.flow_name)

        # Start execution in a separate thread
        thread = threading.Thread(target=wrapped_execution, daemon=True)
        thread.start()

    return threaded_handler
