"""
Tests for the Perfect Python SDK (perfect.sdk).

Covers pure data classes (TaskResult, TaskDefinition), LogCapture, and the
WorkflowRegistry. Tests run without a real backend server.
"""

import pytest
from unittest.mock import Mock, patch

from perfect.sdk import (
    TaskResult,
    TaskDefinition,
    LogCapture,
    WorkflowRegistry,
    FlowDefinition,
)


# ---------------------------------------------------------------------------
# TaskResult
# ---------------------------------------------------------------------------

class TestTaskResult:
    def test_to_dict_passed_true_with_note_and_table(self):
        result = TaskResult(passed=True, note="ok", table=[{"a": 1}])
        d = result.to_dict()
        assert d == {"passed": True, "note": "ok", "table": [{"a": 1}]}

    def test_to_dict_default_note_and_table(self):
        result = TaskResult(passed=True)
        d = result.to_dict()
        assert d["note"] == ""
        assert d["table"] == []

    def test_to_dict_passed_false(self):
        result = TaskResult(passed=False, note="assertion error")
        d = result.to_dict()
        assert d["passed"] is False
        assert d["note"] == "assertion error"

    def test_to_dict_returns_new_dict_each_call(self):
        result = TaskResult(passed=True, note="x")
        d1 = result.to_dict()
        d2 = result.to_dict()
        assert d1 == d2
        assert d1 is not d2  # separate objects


# ---------------------------------------------------------------------------
# TaskDefinition
# ---------------------------------------------------------------------------

class TestTaskDefinition:
    def test_defaults(self):
        def dummy():
            pass

        td = TaskDefinition(name="My Task", func=dummy)
        assert td.estimated_time == 1000
        assert td.crucial_pass is True
        assert td.description == ""

    def test_custom_values(self):
        def dummy():
            pass

        td = TaskDefinition(
            name="Slow Task",
            func=dummy,
            description="Takes a while",
            estimated_time=5000,
            crucial_pass=False,
        )
        assert td.estimated_time == 5000
        assert td.crucial_pass is False
        assert td.description == "Takes a while"


# ---------------------------------------------------------------------------
# LogCapture
# ---------------------------------------------------------------------------

class TestLogCapture:
    def _make_capture(self):
        client = Mock()
        lc = LogCapture(client, "run-test")
        return lc, client

    def test_write_single_line_sends_log(self):
        lc, client = self._make_capture()
        lc.write("hello\n")
        client.send_log.assert_called_once_with("run-test", "hello")

    def test_write_no_newline_then_flush_sends_log(self):
        lc, client = self._make_capture()
        lc.write("no newline")
        client.send_log.assert_not_called()
        lc.flush()
        client.send_log.assert_called_once_with("run-test", "no newline")

    def test_write_multiple_lines_sends_each(self):
        lc, client = self._make_capture()
        lc.write("line1\nline2\n")
        assert client.send_log.call_count == 2
        calls = [c[0] for c in client.send_log.call_args_list]
        assert ("run-test", "line1") in calls
        assert ("run-test", "line2") in calls

    def test_write_blank_line_not_sent(self):
        """Empty / whitespace-only lines are skipped (stripped before send)."""
        lc, client = self._make_capture()
        lc.write("\n")
        client.send_log.assert_not_called()

    def test_flush_empty_buffer_does_not_send(self):
        lc, client = self._make_capture()
        lc.flush()
        client.send_log.assert_not_called()

    def test_flush_whitespace_only_buffer_does_not_send(self):
        lc, client = self._make_capture()
        lc.write("   ")
        lc.flush()
        client.send_log.assert_not_called()


# ---------------------------------------------------------------------------
# WorkflowRegistry
# ---------------------------------------------------------------------------

class TestWorkflowRegistry:
    def test_tasks_and_flows_start_empty(self):
        registry = WorkflowRegistry()
        assert registry._tasks == {}
        assert registry._flows == {}

    def test_task_decorator_registers_task(self):
        registry = WorkflowRegistry()

        @registry.task(estimated_time=2000)
        def my_task():
            """Extract data"""
            return "ok"

        assert "my_task" in registry._tasks
        task_def = registry._tasks["my_task"]
        assert task_def.estimated_time == 2000
        assert task_def.crucial_pass is True

    def test_task_decorator_name_override(self):
        registry = WorkflowRegistry()

        @registry.task(name="Custom Name")
        def another_task():
            pass

        task_def = registry._tasks["another_task"]
        assert task_def.name == "Custom Name"

    def test_flow_decorator_registers_flow(self):
        registry = WorkflowRegistry()

        # Disable auto-connect so the decorator does not try to reach a server
        registry._auto_connect_enabled = False

        @registry.flow(name="Test Flow")
        def my_flow():
            pass

        assert "my_flow" in registry._flows
        flow_def = registry._flows["my_flow"]
        assert flow_def.name == "Test Flow"

    def test_analyze_flow_raises_for_unknown_flow(self):
        registry = WorkflowRegistry()
        with pytest.raises(ValueError, match="not found"):
            registry._analyze_flow("nonexistent_flow")

    def test_analyze_flow_detects_task_calls(self):
        """_analyze_flow inspects source code to find which tasks a flow calls."""
        registry = WorkflowRegistry()
        registry._auto_connect_enabled = False

        @registry.task(estimated_time=500)
        def step_one():
            pass

        @registry.task(estimated_time=800)
        def step_two():
            pass

        @registry.flow(name="Pipeline")
        def my_pipeline():
            step_one()
            step_two()

        analyzed = registry._analyze_flow("my_pipeline")
        task_names = [t.name for t in analyzed.tasks]
        assert "step_one" in task_names
        assert "step_two" in task_names

    def test_flow_to_dict_shape(self):
        registry = WorkflowRegistry()
        registry._auto_connect_enabled = False

        @registry.task(estimated_time=1500, crucial_pass=False)
        def a_task():
            """Does something"""
            pass

        @registry.flow(name="Serialise Me")
        def a_flow():
            a_task()

        analyzed = registry._analyze_flow("a_flow")
        d = registry._flow_to_dict(analyzed)

        assert d["name"] == "Serialise Me"
        assert isinstance(d["tasks"], list)
        assert len(d["tasks"]) == 1
        task_entry = d["tasks"][0]
        assert task_entry["estimatedTime"] == 1500
        assert task_entry["crucialPass"] is False


# ---------------------------------------------------------------------------
# Heartbeat configuration
# ---------------------------------------------------------------------------

class TestHeartbeatConfig:
    @pytest.fixture(autouse=True)
    def _clean_env(self, monkeypatch):
        monkeypatch.delenv("PERFECT_HEARTBEAT", raising=False)
        monkeypatch.delenv("PERFECT_HEARTBEAT_INTERVAL", raising=False)

    def test_enabled_by_default(self):
        registry = WorkflowRegistry()
        assert registry.heartbeat_enabled is True
        assert registry._heartbeat_interval == 3.0

    @pytest.mark.parametrize("value", ["0", "false", "OFF", "no"])
    def test_env_var_disables(self, monkeypatch, value):
        monkeypatch.setenv("PERFECT_HEARTBEAT", value)
        assert WorkflowRegistry().heartbeat_enabled is False

    @pytest.mark.parametrize("value", ["1", "true", "On", "yes"])
    def test_env_var_enables(self, monkeypatch, value):
        monkeypatch.setenv("PERFECT_HEARTBEAT", value)
        assert WorkflowRegistry().heartbeat_enabled is True

    def test_unknown_env_value_keeps_default(self, monkeypatch):
        monkeypatch.setenv("PERFECT_HEARTBEAT", "maybe")
        assert WorkflowRegistry().heartbeat_enabled is True

    def test_env_interval(self, monkeypatch):
        monkeypatch.setenv("PERFECT_HEARTBEAT_INTERVAL", "1.5")
        assert WorkflowRegistry()._heartbeat_interval == 1.5

    @pytest.mark.parametrize("value", ["abc", "0", "-2", "inf", "nan", "-inf"])
    def test_bad_env_interval_keeps_default(self, monkeypatch, value):
        monkeypatch.setenv("PERFECT_HEARTBEAT_INTERVAL", value)
        assert WorkflowRegistry()._heartbeat_interval == 3.0

    def test_configure_overrides_env(self, monkeypatch):
        monkeypatch.setenv("PERFECT_HEARTBEAT", "0")
        registry = WorkflowRegistry()
        registry.configure(heartbeat=True)
        assert registry.heartbeat_enabled is True

    def test_configure_only_changes_given_settings(self):
        registry = WorkflowRegistry()
        registry.configure(heartbeat=False)
        assert registry._backend_url == "http://localhost:3000"
        assert registry._client_id == "perfect_example"
        assert registry._mock is False

    @pytest.mark.parametrize("bad", [0, -1, float("inf"), float("nan")])
    def test_configure_rejects_non_positive_or_non_finite_interval(self, bad):
        with pytest.raises(ValueError):
            WorkflowRegistry().configure(heartbeat_interval=bad)

    def test_connect_starts_heartbeat_when_enabled(self):
        registry = WorkflowRegistry()
        registry.configure(heartbeat_interval=2.0)
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
        client_cls.return_value.start_heartbeat.assert_called_once_with(2.0)

    def test_connect_skips_heartbeat_when_disabled(self):
        registry = WorkflowRegistry()
        registry.configure(heartbeat=False)
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
        client_cls.return_value.start_heartbeat.assert_not_called()

    def test_connect_skips_heartbeat_in_mock_mode(self):
        registry = WorkflowRegistry()
        registry.configure(mock=True)
        registry._ensure_client()
        assert registry._client is not None
        assert registry._client.heartbeat_active is False

    def test_parallel_flows_create_one_client(self):
        import threading
        registry = WorkflowRegistry()
        barrier = threading.Barrier(8)

        def connect():
            barrier.wait()
            registry._ensure_client()

        with patch("perfect.api.PerfectAPIClient") as client_cls:
            threads = [threading.Thread(target=connect) for _ in range(8)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
        assert client_cls.call_count == 1
        client_cls.return_value.start_heartbeat.assert_called_once()

    def test_disabling_after_connect_stops_heartbeat(self):
        registry = WorkflowRegistry()
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
            registry.configure(heartbeat=False)
        client_cls.return_value.stop_heartbeat.assert_called_once()

    def test_changing_interval_after_connect_restarts_heartbeat(self):
        registry = WorkflowRegistry()
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
            registry.configure(heartbeat_interval=1.0)
        client = client_cls.return_value
        client.stop_heartbeat.assert_called_once()
        assert client.start_heartbeat.call_args_list[-1].args == (1.0,)


class TestHeartbeatSettingsReachTheListener:
    @pytest.fixture(autouse=True)
    def _clean_env(self, monkeypatch):
        monkeypatch.delenv("PERFECT_HEARTBEAT", raising=False)
        monkeypatch.delenv("PERFECT_HEARTBEAT_INTERVAL", raising=False)

    def test_switching_to_mock_after_connect_stops_the_real_heartbeat(self):
        registry = WorkflowRegistry()
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
            registry.configure(mock=True)
        client_cls.return_value.stop_heartbeat.assert_called_once()

    def test_auto_listener_uses_the_registry_settings(self):
        registry = WorkflowRegistry()
        registry.configure(heartbeat=False, heartbeat_interval=1.5)
        with patch("perfect.api.PerfectAPIClient") as client_cls:
            registry._ensure_client()
            registry._auto_start_listener()
            # the listener runs in a non-daemon thread; wait for it to call through
            for _ in range(50):
                if client_cls.return_value.listen_for_executions.called:
                    break
                import time; time.sleep(0.02)
        client_cls.return_value.listen_for_executions.assert_called_once_with(heartbeat=False, heartbeat_interval=1.5)

    def test_public_listen_uses_the_registry_settings(self):
        import perfect.sdk as sdk
        registry = WorkflowRegistry()
        registry.configure(heartbeat=False, heartbeat_interval=2.5)
        with patch("perfect.api.PerfectAPIClient") as client_cls, \
             patch.object(sdk, "_default_registry", registry):
            sdk.listen()
        client_cls.return_value.listen_for_executions.assert_called_once_with(heartbeat=False, heartbeat_interval=2.5)

    def test_connect_without_arguments_keeps_the_backend_url(self):
        import perfect.sdk as sdk
        registry = WorkflowRegistry()
        with patch.object(sdk, "_default_registry", registry), patch.object(sdk, "listen"):
            sdk.connect()
            assert registry._backend_url == "http://localhost:3000"
            sdk.run(client_id="other")
            assert registry._backend_url == "http://localhost:3000"
            assert registry._client_id == "other"
