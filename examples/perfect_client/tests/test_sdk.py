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
