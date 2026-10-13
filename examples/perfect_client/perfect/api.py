"""
Perfect API Client

This module provides the Python client for communicating with Perfect's backend API.
It handles:
- Registering flows with Perfect
- Receiving execution requests from Perfect
- Sending logs back to Perfect during flow execution
"""

import requests
import json
import math
import time
import threading
from typing import Dict, List, Callable, Optional
from dataclasses import dataclass


@dataclass
class ExecutionRequest:
    """Represents an execution request from Perfect"""
    run_id: str
    flow_name: str
    configuration: str


class PerfectAPIClient:
    """
    Client for communicating with Perfect's backend API.

    In production, Perfect would have a backend server (Node.js/FastAPI/etc)
    that exposes these endpoints:

    - POST /api/flows - Register a flow
    - GET /api/execution-requests - Long-poll for execution requests
    - POST /api/flows/{run_id}/logs - Send logs for a running flow
    - WebSocket /ws - Real-time bidirectional communication
    """

    def __init__(self, base_url: str = "http://localhost:3000"):
        """
        Initialize the Perfect API client.

        Args:
            base_url: The URL of the Perfect backend server
        """
        self.base_url = base_url
        self.session = requests.Session()
        self._execution_callback: Optional[Callable[[ExecutionRequest], None]] = None
        # The heartbeat thread and the stop Event it owns. Each thread gets its
        # own Event so a thread that outlives stop_heartbeat()'s join can never
        # be revived by a later start_heartbeat().
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._heartbeat_stop: Optional[threading.Event] = None
        self._listening = False

    def register_flow(self, flow_definition: Dict, auto_trigger: bool = False, configuration: str = "development") -> Optional[Dict]:
        """
        Register a flow with Perfect.

        Args:
            flow_definition: Dict containing:
                - name: Flow name
                - description: Flow description
                - schedule: Optional cron schedule
                - tasks: List of task definitions
            auto_trigger: If True, automatically trigger the flow after registration
            configuration: Configuration to use when auto-triggering (default: "development")

        Returns:
            The registered flow object (including 'id') if successful, None otherwise
        """
        try:
            # Add auto_trigger flag to the payload
            payload = {
                **flow_definition,
                "autoTrigger": auto_trigger,
                "autoTriggerConfig": configuration
            }

            response = self.session.post(
                f"{self.base_url}/api/flows",
                json=payload,
                timeout=5
            )
            response.raise_for_status()

            result = response.json()
            flow = result.get('flow')

            trigger_msg = f" (auto-triggering with config: {configuration})" if auto_trigger else ""
            print(f"[OK] Registered flow: {flow_definition['name']}{trigger_msg}")
            return flow
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to register flow {flow_definition['name']}: {e}")
            return None

    def send_log(self, run_id: str, log_message: str) -> bool:
        """
        Send a log message to Perfect for a specific flow run.

        Args:
            run_id: The ID of the flow run
            log_message: The log message to send

        Returns:
            True if log sent successfully, False otherwise
        """
        try:
            response = self.session.post(
                f"{self.base_url}/api/flows/{run_id}/logs",
                json={"log": log_message},
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to send log: {e}")
            return False

    def update_task_state(self, run_id: str, task_index: int, state: str, progress: int = None, duration_ms: int = None, result: Dict = None, task_name: str = None, estimated_time: int = None, crucial_pass: bool = None) -> bool:
        """
        Update the state of a task in a flow run.

        Args:
            run_id: The ID of the flow run
            task_index: The index of the task (0-based)
            state: The new state ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
            progress: Optional progress percentage (0-100)
            duration_ms: Optional actual duration in milliseconds
            result: Optional task result (TaskResult.to_dict())
            task_name: Optional task name (for dynamic task creation)
            estimated_time: Optional estimated time in ms (for dynamic task creation)
            crucial_pass: If True, task failure fails the flow (default: True)

        Returns:
            True if update successful, False otherwise
        """
        try:
            payload = {"state": state}
            if progress is not None:
                payload["progress"] = progress
            if duration_ms is not None:
                payload["durationMs"] = duration_ms
            if result is not None:
                payload["result"] = result
            if task_name is not None:
                payload["taskName"] = task_name
            if estimated_time is not None:
                payload["estimatedTime"] = estimated_time
            if crucial_pass is not None:
                payload["crucialPass"] = crucial_pass

            response = self.session.post(
                f"{self.base_url}/api/runs/{run_id}/tasks/{task_index}/state",
                json=payload,
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to update task state: {e}")
            return False

    def complete_flow(self, run_id: str, task_count: int) -> bool:
        """
        Signal that the flow has completed execution from the client side.
        This allows the server to remove any predefined tasks that weren't executed.

        Args:
            run_id: The ID of the flow run
            task_count: The actual number of tasks that were executed

        Returns:
            True if successful, False otherwise
        """
        try:
            response = self.session.post(
                f"{self.base_url}/api/runs/{run_id}/complete",
                json={"taskCount": task_count},
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to signal flow completion: {e}")
            return False

    def send_heartbeat(self) -> bool:
        """
        Send a heartbeat to Perfect to signal the client is alive.

        Returns:
            True if heartbeat sent successfully, False otherwise
        """
        try:
            response = self.session.post(
                f"{self.base_url}/api/heartbeat",
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException:
            # Silently fail - heartbeat is just a keepalive
            return False

    def start_heartbeat(self, interval: float = 3.0) -> bool:
        """
        Start sending heartbeats in a background daemon thread.

        The backend fails this client's running flows when heartbeats stop
        arriving, so this is what lets it detect a crashed or killed client.
        Calling it while a heartbeat is already running does nothing.

        Args:
            interval: Seconds between heartbeats. Keep this well under the
                backend's 10 second timeout.

        Returns:
            True if a new heartbeat thread was started, False if one was already running
        """
        if not (math.isfinite(interval) and interval > 0):
            raise ValueError("Heartbeat interval must be a finite number greater than 0")
        if self.heartbeat_active:
            return False

        stop = threading.Event()
        thread = threading.Thread(
            target=self._heartbeat_loop,
            args=(interval, stop),
            daemon=True,
            name="perfect-heartbeat",
        )
        self._heartbeat_stop = stop
        self._heartbeat_thread = thread
        thread.start()
        return True

    def stop_heartbeat(self):
        """Stop the heartbeat thread, if one is running. Returns promptly."""
        thread, stop = self._heartbeat_thread, self._heartbeat_stop
        self._heartbeat_thread = None
        self._heartbeat_stop = None
        if stop:
            stop.set()
        if thread and thread is not threading.current_thread():
            thread.join(timeout=1.0)

    @property
    def heartbeat_active(self) -> bool:
        """True while the heartbeat thread is running."""
        return bool(self._heartbeat_thread and self._heartbeat_thread.is_alive())

    def _heartbeat_loop(self, interval: float, stop: threading.Event):
        """
        Background thread that sends heartbeats periodically.

        Sends one heartbeat immediately, then one every `interval` seconds.
        Waits on the thread's own stop Event rather than sleeping, so
        stop_heartbeat() returns at once and only ever stops this thread.

        Args:
            interval: How often to send heartbeats (seconds)
            stop: Event set by stop_heartbeat() to end this thread
        """
        warned = False
        while not stop.is_set():
            try:
                self.send_heartbeat()
            except Exception as e:  # noqa: BLE001 - the thread must survive anything
                # send_heartbeat() handles request errors itself; anything else
                # (e.g. the session being swapped by stop_listening() mid-call)
                # must not kill the thread, or the backend would fail every run.
                if not warned:
                    print(f"[Perfect Client] Heartbeat error (will keep trying): {e!r}")
                    warned = True
            if stop.wait(interval):
                return

    def on_execution_request(self, callback: Callable[[ExecutionRequest], None]):
        """
        Register a callback to be called when Perfect requests flow execution.

        Args:
            callback: Function to call with ExecutionRequest when flow should execute
        """
        self._execution_callback = callback

    def listen_for_executions(self, poll_interval: float = 1.0, heartbeat: bool = True,
                              heartbeat_interval: float = 3.0):
        """
        Start listening for execution requests from Perfect.
        This runs in a loop and calls the registered callback when execution is requested.

        If a heartbeat thread is already running (the SDK starts one on
        connect), it is left alone. Only a heartbeat started here is stopped
        when listening ends.

        Args:
            poll_interval: How often to poll for new requests (seconds)
            heartbeat: If True, send heartbeats while listening
            heartbeat_interval: Seconds between heartbeats started here

        Note:
            In production, this would use WebSockets for real-time communication
            instead of polling. This is a simplified implementation.
        """
        if not self._execution_callback:
            raise ValueError("No execution callback registered. Call on_execution_request() first.")

        print(f"[Perfect Client] Listening for execution requests from {self.base_url}...")
        started_heartbeat = heartbeat and self.start_heartbeat(heartbeat_interval)
        if started_heartbeat:
            print(f"[Perfect Client] Sending heartbeats every {heartbeat_interval:g} seconds...")
        print("[Perfect Client] Press Ctrl+C to stop")

        self._listening = True

        try:
            while self._listening:
                try:
                    # Very short timeout to allow quick shutdown
                    response = self.session.get(
                        f"{self.base_url}/api/execution-requests",
                        timeout=0.5  # 500ms timeout for near-instant shutdown
                    )

                    if response.status_code == 200:
                        data = response.json()
                        if data and 'run_id' in data:
                            request = ExecutionRequest(
                                run_id=data['run_id'],
                                flow_name=data['flow_name'],
                                configuration=data['configuration']
                            )
                            self._execution_callback(request)

                except requests.exceptions.Timeout:
                    # Expected - poll timeout, continue polling
                    pass
                except requests.exceptions.RequestException as e:
                    if self._listening:  # Only log if still listening
                        print(f"[Perfect Client] Connection error: {e}")
                        print(f"[Perfect Client] Retrying in {poll_interval}s...")
                        time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n[Perfect Client] Shutting down...")
        finally:
            self._listening = False
            if started_heartbeat:
                self.stop_heartbeat()

    def stop_listening(self):
        """Stop listening for execution requests. Leaves any heartbeat running."""
        self._listening = False
        # Close session to immediately abort any ongoing requests
        self.session.close()
        # Create a new session for cleanup operations
        self.session = requests.Session()

    def close(self):
        """Close the API client and cleanup resources"""
        self.stop_heartbeat()
        self.session.close()

    # Report Management API

    def get_flow_reports(self, flow_name: str) -> List[Dict]:
        """
        Get all reports for a specific flow.

        Args:
            flow_name: Name of the flow

        Returns:
            List of report dictionaries containing:
            - runId: The run ID
            - filename: Report filename
            - path: Relative path to report
            - url: URL to access report
            - size: File size in bytes
            - createdAt: Creation timestamp
            - modifiedAt: Modification timestamp
            - flowState: Flow execution state (COMPLETED, FAILED, etc.)
            - configuration: Configuration used for the run
            - tags: Flow tags dictionary
        """
        try:
            response = self.session.get(
                f"{self.base_url}/api/reports/flow/{flow_name}",
                timeout=5
            )
            response.raise_for_status()

            result = response.json()
            if result.get('success'):
                return result.get('reports', [])
            else:
                print(f"[ERROR] Failed to get reports: {result.get('error')}")
                return []
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to get reports for {flow_name}: {e}")
            return []

    def get_report(self, run_id: str) -> Optional[Dict]:
        """
        Get report for a specific run ID.

        Args:
            run_id: The run ID

        Returns:
            Report dictionary or None if not found
        """
        try:
            response = self.session.get(
                f"{self.base_url}/api/reports/run/{run_id}",
                timeout=5
            )
            response.raise_for_status()

            result = response.json()
            if result.get('success'):
                return result.get('report')
            else:
                print(f"[ERROR] Failed to get report: {result.get('error')}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to get report for run {run_id}: {e}")
            return None


class MockPerfectClient(PerfectAPIClient):
    """
    Mock client for development/testing without a backend server.
    Simulates API calls without making actual HTTP requests.
    """

    def __init__(self):
        super().__init__()
        self._registered_flows = []
        self._logs = {}

    def register_flow(self, flow_definition: Dict, auto_trigger: bool = False, configuration: str = "development") -> bool:
        """Mock flow registration - stores locally"""
        self._registered_flows.append(flow_definition)
        trigger_msg = f" (auto-triggering with config: {configuration})" if auto_trigger else ""
        print(f"[Mock] [OK] Registered flow: {flow_definition['name']}{trigger_msg}")
        return True

    def send_log(self, run_id: str, log_message: str) -> bool:
        """Mock log sending - stores locally"""
        if run_id not in self._logs:
            self._logs[run_id] = []
        self._logs[run_id].append(log_message)
        print(f"[Mock] Log: {log_message}")
        return True

    def update_task_state(self, run_id: str, task_index: int, state: str, progress: int = None, duration_ms: int = None, result: Dict = None) -> bool:
        """Mock task state update"""
        msg = f"[Mock] Task {task_index} state: {state}"
        if progress:
            msg += f" ({progress}%)"
        if duration_ms:
            msg += f" [took {duration_ms}ms]"
        if result:
            msg += f" [result: passed={result.get('passed')}, note={result.get('note')}]"
        print(msg)
        return True

    def get_registered_flows(self) -> List[Dict]:
        """Get all registered flows (mock only)"""
        return self._registered_flows

    def get_logs(self, run_id: str) -> List[str]:
        """Get logs for a run (mock only)"""
        return self._logs.get(run_id, [])


def create_client(mock: bool = False) -> PerfectAPIClient:
    """
    Create a Perfect API client.

    Args:
        mock: If True, creates a mock client for testing without backend

    Returns:
        PerfectAPIClient instance
    """
    if mock:
        return MockPerfectClient()
    return PerfectAPIClient()
