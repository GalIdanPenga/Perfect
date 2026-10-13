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
import os
import time
import threading
import weakref
from typing import Dict, List, Callable, Optional
from dataclasses import dataclass


@dataclass
class ExecutionRequest:
    """Represents an execution request from Perfect"""
    run_id: str
    flow_name: str
    configuration: str


class _FairRLock:
    """
    Re-entrant lock that hands off to waiters in arrival order.

    threading.RLock makes no fairness promise: a thread that releases and
    immediately re-acquires in a tight loop (the execution poll, or any caller
    doing the same) can keep winning and starve every other thread, including
    the heartbeat. Here each waiter takes a ticket and is served in order, so
    the longest wait for the lock is one request by each thread ahead of it.

    Supports the subset of the Lock API this client uses: `with`, acquire
    (blocking or not; no timeout), release, and _is_owned().
    """

    def __init__(self):
        self._cond = threading.Condition(threading.Lock())
        self._owner: Optional[int] = None
        self._count = 0
        self._next_ticket = 0
        self._serving = 0

    def acquire(self, blocking: bool = True) -> bool:
        me = threading.get_ident()
        with self._cond:
            if self._owner == me:
                self._count += 1
                return True
            if not blocking:
                if self._owner is None and self._next_ticket == self._serving:
                    self._owner, self._count = me, 1
                    return True
                return False
            ticket = self._next_ticket
            self._next_ticket += 1
            while not (self._owner is None and self._serving == ticket):
                self._cond.wait()
            self._owner, self._count = me, 1
            self._serving += 1
            return True

    def release(self) -> None:
        with self._cond:
            if self._owner != threading.get_ident():
                raise RuntimeError("cannot release un-acquired lock")
            self._count -= 1
            if self._count == 0:
                self._owner = None
                self._cond.notify_all()

    def _is_owned(self) -> bool:
        return self._owner == threading.get_ident()

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, *exc):
        self.release()


class PerfectAPIClient:
    """
    Client for communicating with Perfect's backend API.

    In production, Perfect would have a backend server (Node.js/FastAPI/etc)
    that exposes these endpoints:

    - POST /api/flows - Register a flow
    - GET /api/execution-requests - Long-poll for execution requests
    - POST /api/flows/{run_id}/logs - Send logs for a running flow
    - WebSocket /ws - Real-time bidirectional communication

    Thread safety: one client may be used from any number of threads. Every
    exchange with the server is serialized behind a private re-entrant lock,
    which is held only for the duration of a single HTTP call (each of which
    has a bounded timeout) or the Session swap in stop_listening(). It is never
    held while running user code (execution callbacks), parsing responses or
    printing, so client methods may be called from callbacks, from parallel
    flows, or from the heartbeat thread without deadlock. The lock is fair
    (first come, first served), so a thread calling in a tight loop cannot
    starve the others. The client survives pickling and os.fork(): both get a
    fresh lock and Session in the copy.
    """

    DEFAULT_FETCH_TIMEOUT_S = 10.0

    def __init__(self, base_url: str = "http://localhost:3000"):
        """
        Initialize the Perfect API client.

        Args:
            base_url: The URL of the Perfect backend server
        """
        self.base_url = base_url
        self.session = requests.Session()
        # Serializes every exchange with the server. Flow threads, the heartbeat
        # thread and the poll loop all share one Session, which requests does
        # not guarantee to be thread-safe, and stop_listening() swaps the
        # Session out from under them. Re-entrant so a locked method may call
        # another locked method; fair so no caller can starve the heartbeat.
        self._lock = _FairRLock()
        self._register_fork_handler()
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

            with self._lock:
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

    # ------------------------------------------------------------------------
    # Lock lifecycle: pickling and forking
    # ------------------------------------------------------------------------

    def _register_fork_handler(self):
        """After a fork, the child must not inherit a lock another thread held."""
        if not hasattr(os, "register_at_fork"):
            return  # no fork on this platform
        ref = weakref.ref(self)

        def after_in_child():
            client = ref()
            if client is not None:
                client._reset_runtime_state()

        os.register_at_fork(after_in_child=after_in_child)

    def _reset_runtime_state(self):
        """Fresh lock, fresh Session, no threads: for a pickled copy or a forked child."""
        self._lock = _FairRLock()
        self.session = requests.Session()
        self._heartbeat_thread = None
        self._heartbeat_stop = None
        self._listening = False

    def __getstate__(self):
        state = self.__dict__.copy()
        for key in ("_lock", "session", "_heartbeat_thread", "_heartbeat_stop"):
            state.pop(key, None)
        state["_listening"] = False
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._reset_runtime_state()
        self._register_fork_handler()

    def create_run(self, flow_id: str, configuration: str = "development") -> Optional[str]:
        """
        Create a run for a client-initiated execution of a registered flow.

        Args:
            flow_id: The id returned by register_flow()
            configuration: Configuration name for the run

        Returns:
            The run id, or None if the server refused or could not be reached
        """
        try:
            with self._lock:
                response = self.session.post(
                    f"{self.base_url}/api/engine/run/{flow_id}",
                    json={"configuration": configuration},
                    timeout=2
                )
            if not response.ok:
                print(f"[ERROR] Failed to create run: {response.status_code}")
                return None
            return response.json().get('runId')
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to create run: {e}")
            return None

    def fetch_text(self, path: str, timeout: float = 10) -> Optional[str]:
        """
        GET a server path (e.g. a report under /Reports/...) and return its body.

        Args:
            path: Absolute URL, or a path relative to base_url
            timeout: Request timeout in seconds

        Returns:
            The response text, or None on any request error
        """
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        # The lock is held for the whole request, so its timeout must be bounded.
        if not (isinstance(timeout, (int, float)) and math.isfinite(timeout) and timeout > 0):
            timeout = self.DEFAULT_FETCH_TIMEOUT_S
        try:
            with self._lock:
                response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Failed to fetch {url}: {e}")
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
            with self._lock:
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

            with self._lock:
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
            with self._lock:
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
            with self._lock:
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
                    print(f"[Perfect Worker] Heartbeat error (will keep trying): {e!r}")
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

        print(f"[Perfect Worker] Listening for execution requests from {self.base_url}...")
        started_heartbeat = heartbeat and self.start_heartbeat(heartbeat_interval)
        if started_heartbeat:
            print(f"[Perfect Worker] Sending heartbeats every {heartbeat_interval:g} seconds...")
        print("[Perfect Worker] Press Ctrl+C to stop")

        self._listening = True

        try:
            while self._listening:
                try:
                    # Very short timeout to allow quick shutdown
                    with self._lock:
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
                        print(f"[Perfect Worker] Connection error: {e}")
                        print(f"[Perfect Worker] Retrying in {poll_interval}s...")
                        time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n[Perfect Worker] Shutting down...")
        finally:
            self._listening = False
            if started_heartbeat:
                self.stop_heartbeat()

    def stop_listening(self):
        """Stop listening for execution requests. Leaves any heartbeat running."""
        self._listening = False
        with self._lock:
            # Close session to abort the poll, then replace it for cleanup calls.
            # Under the lock, so no other thread sees a half-closed Session.
            self.session.close()
            self.session = requests.Session()

    def close(self):
        """Close the API client and cleanup resources"""
        self.stop_heartbeat()
        with self._lock:
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
            with self._lock:
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
            with self._lock:
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
