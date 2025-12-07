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

    def __init__(self, base_url: str = "http://localhost:3001"):
        """
        Initialize the Perfect API client.

        Args:
            base_url: The URL of the Perfect backend server
        """
        self.base_url = base_url
        self.session = requests.Session()
        self._execution_callback: Optional[Callable[[ExecutionRequest], None]] = None
        self._heartbeat_running = False
        self._heartbeat_thread = None
        self._listening = False

    def register_flow(self, flow_definition: Dict, auto_trigger: bool = False, configuration: str = "development") -> bool:
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
            True if registration successful, False otherwise
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

            trigger_msg = f" (auto-triggering with config: {configuration})" if auto_trigger else ""
            print(f"✓ Registered flow: {flow_definition['name']}{trigger_msg}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to register flow {flow_definition['name']}: {e}")
            return False

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
            print(f"✗ Failed to send log: {e}")
            return False

    def update_task_state(self, run_id: str, task_index: int, state: str, progress: int = None, duration_ms: int = None, result: Dict = None) -> bool:
        """
        Update the state of a task in a flow run.

        Args:
            run_id: The ID of the flow run
            task_index: The index of the task (0-based)
            state: The new state ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
            progress: Optional progress percentage (0-100)
            duration_ms: Optional actual duration in milliseconds
            result: Optional task result (TaskResult.to_dict())

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

            response = self.session.post(
                f"{self.base_url}/api/runs/{run_id}/tasks/{task_index}/state",
                json=payload,
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to update task state: {e}")
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

    def _heartbeat_loop(self, interval: float = 3.0):
        """
        Background thread that sends heartbeats periodically.

        Args:
            interval: How often to send heartbeats (seconds)
        """
        while self._heartbeat_running:
            self.send_heartbeat()
            time.sleep(interval)

    def on_execution_request(self, callback: Callable[[ExecutionRequest], None]):
        """
        Register a callback to be called when Perfect requests flow execution.

        Args:
            callback: Function to call with ExecutionRequest when flow should execute
        """
        self._execution_callback = callback

    def listen_for_executions(self, poll_interval: float = 1.0):
        """
        Start listening for execution requests from Perfect.
        This runs in a loop and calls the registered callback when execution is requested.

        Args:
            poll_interval: How often to poll for new requests (seconds)

        Note:
            In production, this would use WebSockets for real-time communication
            instead of polling. This is a simplified implementation.
        """
        if not self._execution_callback:
            raise ValueError("No execution callback registered. Call on_execution_request() first.")

        print(f"[Perfect Client] Listening for execution requests from {self.base_url}...")
        print("[Perfect Client] Sending heartbeats every 3 seconds...")
        print("[Perfect Client] Press Ctrl+C to stop")

        # Start heartbeat thread
        self._listening = True
        self._heartbeat_running = True
        self._heartbeat_thread = threading.Thread(
            target=self._heartbeat_loop,
            args=(3.0,),  # Send heartbeat every 3 seconds
            daemon=True
        )
        self._heartbeat_thread.start()

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
            self._heartbeat_running = False

    def stop_listening(self):
        """Stop listening for execution requests"""
        self._listening = False
        self._heartbeat_running = False
        # Close session to immediately abort any ongoing requests
        self.session.close()
        # Create a new session for cleanup operations
        self.session = requests.Session()

    def close(self):
        """Close the API client and cleanup resources"""
        self._heartbeat_running = False
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=1.0)
        self.session.close()


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
        print(f"[Mock] ✓ Registered flow: {flow_definition['name']}{trigger_msg}")
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
