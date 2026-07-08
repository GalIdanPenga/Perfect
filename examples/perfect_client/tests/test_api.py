"""
Tests for PerfectAPIClient (perfect.api).

All HTTP calls are mocked — no real server required.
"""

import threading
import pytest
import requests
from unittest.mock import patch, Mock, call

from perfect.api import PerfectAPIClient, ExecutionRequest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client() -> PerfectAPIClient:
    return PerfectAPIClient(base_url="http://test-server:3000")


def _ok_response(json_body: dict) -> Mock:
    """Return a Mock that behaves like a 200 response."""
    resp = Mock()
    resp.status_code = 200
    resp.raise_for_status = Mock()
    resp.json = Mock(return_value=json_body)
    return resp


# ---------------------------------------------------------------------------
# send_log
# ---------------------------------------------------------------------------

class TestSendLog:
    def test_success_returns_true_and_posts_once(self):
        client = _make_client()
        mock_resp = _ok_response({})
        with patch.object(client.session, "post", return_value=mock_resp) as mock_post:
            result = client.send_log("run-1", "hello")
        assert result is True
        assert mock_post.call_count == 1

    def test_url_contains_run_id_and_logs(self):
        client = _make_client()
        mock_resp = _ok_response({})
        with patch.object(client.session, "post", return_value=mock_resp) as mock_post:
            client.send_log("run-abc", "msg")
        call_url = mock_post.call_args[0][0]
        assert "run-abc" in call_url
        assert "logs" in call_url

    def test_request_exception_returns_false(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException("network error")):
            result = client.send_log("run-1", "hello")
        assert result is False


# ---------------------------------------------------------------------------
# update_task_state
# ---------------------------------------------------------------------------

class TestUpdateTaskState:
    def test_success_returns_true(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})):
            result = client.update_task_state("run-1", 0, "RUNNING")
        assert result is True

    def test_state_always_present_in_payload(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "COMPLETED")
        payload = mock_post.call_args[1]["json"]
        assert payload["state"] == "COMPLETED"

    def test_progress_none_excluded_from_payload(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "RUNNING", progress=None)
        payload = mock_post.call_args[1]["json"]
        assert "progress" not in payload

    def test_progress_zero_included_in_payload(self):
        """progress=0 is falsy but must be sent (valid value)."""
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "RUNNING", progress=0)
        payload = mock_post.call_args[1]["json"]
        assert "progress" in payload
        assert payload["progress"] == 0

    def test_duration_ms_none_excluded(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "COMPLETED", duration_ms=None)
        payload = mock_post.call_args[1]["json"]
        assert "durationMs" not in payload

    def test_result_none_excluded(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "COMPLETED", result=None)
        payload = mock_post.call_args[1]["json"]
        assert "result" not in payload

    def test_crucial_pass_false_included_in_payload(self):
        """crucial_pass=False is falsy but must be sent."""
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.update_task_state("run-1", 0, "COMPLETED", crucial_pass=False)
        payload = mock_post.call_args[1]["json"]
        assert "crucialPass" in payload
        assert payload["crucialPass"] is False

    def test_request_exception_returns_false(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException("err")):
            result = client.update_task_state("run-1", 0, "RUNNING")
        assert result is False


# ---------------------------------------------------------------------------
# register_flow
# ---------------------------------------------------------------------------

class TestRegisterFlow:
    def test_success_returns_flow_dict(self):
        client = _make_client()
        flow_data = {"id": "flow-1", "name": "My Flow"}
        with patch.object(client.session, "post", return_value=_ok_response({"flow": flow_data})):
            result = client.register_flow({"name": "My Flow", "tasks": []})
        assert result == flow_data

    def test_calls_api_flows_endpoint(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({"flow": {}})) as mock_post:
            client.register_flow({"name": "F", "tasks": []})
        call_url = mock_post.call_args[0][0]
        assert "/api/flows" in call_url

    def test_request_exception_returns_none(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException("conn refused")):
            result = client.register_flow({"name": "F", "tasks": []})
        assert result is None


# ---------------------------------------------------------------------------
# complete_flow
# ---------------------------------------------------------------------------

class TestCompleteFlow:
    def test_success_returns_true(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})):
            result = client.complete_flow("run-1", 5)
        assert result is True

    def test_sends_task_count_in_body(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})) as mock_post:
            client.complete_flow("run-42", 7)
        call_url = mock_post.call_args[0][0]
        payload = mock_post.call_args[1]["json"]
        assert "run-42" in call_url
        assert payload["taskCount"] == 7

    def test_request_exception_returns_false(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException):
            result = client.complete_flow("run-1", 3)
        assert result is False


# ---------------------------------------------------------------------------
# send_heartbeat
# ---------------------------------------------------------------------------

class TestSendHeartbeat:
    def test_success_returns_true(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})):
            result = client.send_heartbeat()
        assert result is True

    def test_request_exception_returns_false_not_raises(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException):
            result = client.send_heartbeat()
        assert result is False


# ---------------------------------------------------------------------------
# get_flow_reports
# ---------------------------------------------------------------------------

class TestGetFlowReports:
    def test_success_returns_list(self):
        client = _make_client()
        reports = [{"runId": "r1"}, {"runId": "r2"}]
        resp = _ok_response({"success": True, "reports": reports})
        with patch.object(client.session, "get", return_value=resp):
            result = client.get_flow_reports("MyFlow")
        assert result == reports

    def test_request_exception_returns_empty_list(self):
        client = _make_client()
        with patch.object(client.session, "get", side_effect=requests.exceptions.RequestException):
            result = client.get_flow_reports("MyFlow")
        assert result == []


# ---------------------------------------------------------------------------
# get_report
# ---------------------------------------------------------------------------

class TestGetReport:
    def test_success_returns_report_dict(self):
        client = _make_client()
        report = {"runId": "r1", "url": "/reports/r1.html"}
        resp = _ok_response({"success": True, "report": report})
        with patch.object(client.session, "get", return_value=resp):
            result = client.get_report("r1")
        assert result == report

    def test_request_exception_returns_none(self):
        client = _make_client()
        with patch.object(client.session, "get", side_effect=requests.exceptions.RequestException):
            result = client.get_report("r1")
        assert result is None


# ---------------------------------------------------------------------------
# listen_for_executions
# ---------------------------------------------------------------------------

class TestListenForExecutions:
    def test_raises_value_error_without_callback(self):
        client = _make_client()
        with pytest.raises(ValueError, match="No execution callback"):
            client.listen_for_executions()

    def test_calls_callback_with_execution_request(self):
        client = _make_client()
        received: list = []

        def callback(req: ExecutionRequest):
            received.append(req)

        client.on_execution_request(callback)

        data = {"run_id": "r1", "flow_name": "F", "configuration": "test"}

        def get_side_effect(url, **kwargs):
            # Stop the loop after the first successful call
            client._listening = False
            resp = Mock()
            resp.status_code = 200
            resp.json = Mock(return_value=data)
            return resp

        with patch.object(client.session, "get", side_effect=get_side_effect), \
             patch.object(client.session, "post", return_value=_ok_response({})):
            client.listen_for_executions()

        assert len(received) == 1
        assert received[0].run_id == "r1"
        assert received[0].flow_name == "F"
        assert received[0].configuration == "test"

    def test_timeout_exception_continues_without_calling_callback(self):
        client = _make_client()
        received: list = []

        client.on_execution_request(lambda req: received.append(req))

        call_count = {"n": 0}

        def get_side_effect(url, **kwargs):
            call_count["n"] += 1
            if call_count["n"] >= 2:
                client._listening = False
            raise requests.exceptions.Timeout()

        with patch.object(client.session, "get", side_effect=get_side_effect), \
             patch.object(client.session, "post", return_value=_ok_response({})):
            client.listen_for_executions()

        assert received == []

    def test_stop_listening_exits_loop(self):
        client = _make_client()
        client.on_execution_request(lambda req: None)

        def get_side_effect(url, **kwargs):
            client.stop_listening()
            raise requests.exceptions.Timeout()

        # stop_listening replaces the session, so we patch post on the NEW session later
        with patch.object(client.session, "get", side_effect=get_side_effect), \
             patch.object(client.session, "post", return_value=_ok_response({})):
            client.listen_for_executions()

        assert client._listening is False
