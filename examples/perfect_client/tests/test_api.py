"""
Tests for PerfectAPIClient (perfect.api).

All HTTP calls are mocked — no real server required.
"""

import os
import threading
import time
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


# ---------------------------------------------------------------------------
# start_heartbeat / stop_heartbeat
# ---------------------------------------------------------------------------

class TestHeartbeatThread:
    def test_start_sends_heartbeats_until_stopped(self):
        client = _make_client()
        sent = threading.Event()

        def fake_send():
            sent.set()
            return True

        with patch.object(client, "send_heartbeat", side_effect=fake_send):
            assert client.start_heartbeat(0.01) is True
            assert sent.wait(1.0), "no heartbeat was sent"
            assert client.heartbeat_active is True
            client.stop_heartbeat()

        assert client.heartbeat_active is False

    def test_start_is_idempotent(self):
        client = _make_client()
        with patch.object(client, "send_heartbeat", return_value=True):
            assert client.start_heartbeat(0.05) is True
            first = client._heartbeat_thread
            assert client.start_heartbeat(0.05) is False
            assert client._heartbeat_thread is first
            client.stop_heartbeat()

    def test_stop_returns_promptly_with_long_interval(self):
        client = _make_client()
        with patch.object(client, "send_heartbeat", return_value=True):
            client.start_heartbeat(60.0)
            started = time.monotonic()
            client.stop_heartbeat()
            assert time.monotonic() - started < 1.0

    def test_can_restart_after_stop(self):
        client = _make_client()
        with patch.object(client, "send_heartbeat", return_value=True):
            client.start_heartbeat(0.05)
            client.stop_heartbeat()
            assert client.start_heartbeat(0.05) is True
            assert client.heartbeat_active is True
            client.stop_heartbeat()

    def test_rejects_non_positive_interval(self):
        client = _make_client()
        with pytest.raises(ValueError):
            client.start_heartbeat(0)

    def test_close_stops_heartbeat(self):
        client = _make_client()
        with patch.object(client, "send_heartbeat", return_value=True):
            client.start_heartbeat(0.05)
            client.close()
        assert client.heartbeat_active is False

    def test_listen_without_heartbeat_starts_no_thread(self):
        client = _make_client()
        client.on_execution_request(lambda req: None)

        def get_side_effect(url, **kwargs):
            client._listening = False
            raise requests.exceptions.Timeout()

        with patch.object(client.session, "get", side_effect=get_side_effect), \
             patch.object(client, "start_heartbeat") as start:
            client.listen_for_executions(heartbeat=False)

        start.assert_not_called()


class TestHeartbeatThreadOwnership:
    def test_stale_thread_is_never_revived_by_a_later_start(self):
        """A thread that outlives stop_heartbeat()'s join must exit on its own."""
        client = _make_client()
        release = threading.Event()
        senders: list = []

        def slow_send():
            senders.append(threading.current_thread())
            release.wait(5.0)  # first beat blocks, like a slow backend
            return True

        with patch.object(client, "send_heartbeat", side_effect=slow_send):
            client.start_heartbeat(0.01)
            old = client._heartbeat_thread
            client.stop_heartbeat()              # join times out, old thread still inside send
            assert old.is_alive()
            assert client.start_heartbeat(0.01) is True
            new = client._heartbeat_thread
            assert new is not old
            release.set()                        # old thread finishes its request
            old.join(2.0)
            assert not old.is_alive()            # ... and exits, because its own stop was set
            client.stop_heartbeat()

    def test_listen_leaves_an_existing_heartbeat_running(self):
        client = _make_client()
        client.on_execution_request(lambda req: None)

        def get_side_effect(url, **kwargs):
            client._listening = False
            raise requests.exceptions.Timeout()

        with patch.object(client, "send_heartbeat", return_value=True), \
             patch.object(client.session, "get", side_effect=get_side_effect):
            client.start_heartbeat(0.05)         # the SDK started this one
            client.listen_for_executions()
            assert client.heartbeat_active is True
            client.stop_heartbeat()

    def test_listen_stops_only_the_heartbeat_it_started(self):
        client = _make_client()
        client.on_execution_request(lambda req: None)

        def get_side_effect(url, **kwargs):
            assert client.heartbeat_active is True
            client._listening = False
            raise requests.exceptions.Timeout()

        with patch.object(client, "send_heartbeat", return_value=True), \
             patch.object(client.session, "get", side_effect=get_side_effect):
            client.listen_for_executions(heartbeat_interval=0.05)
        assert client.heartbeat_active is False

    def test_listen_passes_the_interval_through(self):
        client = _make_client()
        client.on_execution_request(lambda req: None)

        def get_side_effect(url, **kwargs):
            client._listening = False
            raise requests.exceptions.Timeout()

        with patch.object(client.session, "get", side_effect=get_side_effect), \
             patch.object(client, "start_heartbeat", return_value=True) as start:
            client.listen_for_executions(heartbeat=True, heartbeat_interval=2.0)
        start.assert_called_once_with(2.0)

    def test_stop_listening_does_not_touch_the_heartbeat(self):
        client = _make_client()
        with patch.object(client, "send_heartbeat", return_value=True):
            client.start_heartbeat(0.05)
            client.stop_listening()
            assert client.heartbeat_active is True
            client.stop_heartbeat()

    @pytest.mark.parametrize("bad", [float("inf"), float("nan"), 0, -1])
    def test_rejects_non_finite_or_non_positive_interval(self, bad):
        with pytest.raises(ValueError):
            _make_client().start_heartbeat(bad)


class TestHeartbeatThreadResilience:
    def test_loop_survives_an_unexpected_exception(self, capsys):
        client = _make_client()
        calls = {"n": 0}
        second = threading.Event()

        def flaky_send():
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("adapter torn down")
            second.set()
            return True

        with patch.object(client, "send_heartbeat", side_effect=flaky_send):
            client.start_heartbeat(0.01)
            assert second.wait(2.0), "thread died after the first error"
            assert client.heartbeat_active is True
            client.stop_heartbeat()
        assert "Heartbeat error" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# Server lock: every exchange with the server is serialized
# ---------------------------------------------------------------------------

class TestServerLock:
    def test_every_server_call_holds_the_lock(self):
        client = _make_client()
        held: list = []

        def post(url, **kwargs):
            held.append(client._lock._is_owned())
            return _ok_response({"flow": {}, "runId": "r1", "success": True})

        def get(url, **kwargs):
            held.append(client._lock._is_owned())
            resp = _ok_response({"success": True, "report": {"runId": "r1"}, "reports": []})
            resp.text = "<html></html>"
            return resp

        with patch.object(client.session, "post", side_effect=post), \
             patch.object(client.session, "get", side_effect=get):
            client.register_flow({"name": "F", "tasks": []})
            client.send_log("r1", "hi")
            client.update_task_state("r1", 0, "RUNNING")
            client.complete_flow("r1", 1)
            client.send_heartbeat()
            client.create_run("flow-1")
            client.fetch_text("/Reports/F/x.html")
            client.get_flow_reports("F")
            client.get_report("r1")

        assert len(held) == 9
        assert all(held), "a server call ran without the lock"
        assert not client._lock._is_owned(), "lock leaked after the calls"

    def test_calls_from_parallel_threads_never_overlap(self):
        client = _make_client()
        inside = {"now": 0, "max": 0}
        guard = threading.Lock()
        go = threading.Event()

        def post(url, **kwargs):
            with guard:
                inside["now"] += 1
                inside["max"] = max(inside["max"], inside["now"])
            time.sleep(0.01)
            with guard:
                inside["now"] -= 1
            return _ok_response({})

        def worker():
            go.wait()
            client.send_log("r1", "x")

        with patch.object(client.session, "post", side_effect=post):
            threads = [threading.Thread(target=worker) for _ in range(8)]
            for t in threads:
                t.start()
            go.set()
            for t in threads:
                t.join()

        assert inside["max"] == 1

    def test_lock_is_reentrant(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({})):
            with client._lock:
                assert client.send_heartbeat() is True

    def test_session_swap_in_stop_listening_waits_for_in_flight_call(self):
        client = _make_client()
        in_call = threading.Event()
        release = threading.Event()
        original = client.session

        def slow_post(url, **kwargs):
            in_call.set()
            release.wait(2.0)
            return _ok_response({})

        with patch.object(client.session, "post", side_effect=slow_post):
            t = threading.Thread(target=lambda: client.send_log("r1", "x"))
            t.start()
            assert in_call.wait(1.0)
            swapped = threading.Thread(target=client.stop_listening)
            swapped.start()
            time.sleep(0.05)
            assert client.session is original          # swap is blocked behind the call
            release.set()
            t.join(2.0)
            swapped.join(2.0)
        assert client.session is not original          # ... and happens once it returns


# ---------------------------------------------------------------------------
# create_run / fetch_text
# ---------------------------------------------------------------------------

class TestCreateRun:
    def test_returns_run_id_and_posts_configuration(self):
        client = _make_client()
        with patch.object(client.session, "post", return_value=_ok_response({"success": True, "runId": "run-9"})) as mock_post:
            assert client.create_run("flow-1", "release") == "run-9"
        assert "/api/engine/run/flow-1" in mock_post.call_args[0][0]
        assert mock_post.call_args[1]["json"] == {"configuration": "release"}

    def test_non_ok_response_returns_none(self):
        client = _make_client()
        resp = _ok_response({})
        resp.ok = False
        resp.status_code = 400
        with patch.object(client.session, "post", return_value=resp):
            assert client.create_run("flow-1") is None

    def test_request_exception_returns_none(self):
        client = _make_client()
        with patch.object(client.session, "post", side_effect=requests.exceptions.RequestException("down")):
            assert client.create_run("flow-1") is None


class TestFetchText:
    def test_relative_path_is_joined_to_base_url(self):
        client = _make_client()
        resp = _ok_response({})
        resp.text = "<html>r</html>"
        with patch.object(client.session, "get", return_value=resp) as mock_get:
            assert client.fetch_text("/Reports/F/x.html") == "<html>r</html>"
        assert mock_get.call_args[0][0] == "http://test-server:3000/Reports/F/x.html"

    def test_absolute_url_is_used_as_is(self):
        client = _make_client()
        resp = _ok_response({})
        resp.text = "x"
        with patch.object(client.session, "get", return_value=resp) as mock_get:
            client.fetch_text("http://elsewhere/x.html")
        assert mock_get.call_args[0][0] == "http://elsewhere/x.html"

    def test_request_exception_returns_none(self):
        client = _make_client()
        with patch.object(client.session, "get", side_effect=requests.exceptions.RequestException("down")):
            assert client.fetch_text("/x") is None


# ---------------------------------------------------------------------------
# Lock safety: no deadlocks, nothing else disturbed, robust to other callers
# ---------------------------------------------------------------------------

def _run_with_deadline(fn, seconds: float):
    """Run fn in a thread; fail if it hasn't returned within `seconds`."""
    done = threading.Event()
    err: list = []

    def target():
        try:
            fn()
        except BaseException as e:  # noqa: BLE001
            err.append(e)
        finally:
            done.set()

    t = threading.Thread(target=target, daemon=True)
    t.start()
    assert done.wait(seconds), f"deadlock or hang: did not finish within {seconds}s"
    if err:
        raise err[0]


class TestLockSafety:
    def test_source_every_server_call_is_locked_and_bounded(self):
        """Guards future edits: each session.get/post in api.py sits under the lock
        and carries a timeout, so the lock can never be held indefinitely."""
        import inspect, re
        import perfect.api as api
        src = inspect.getsource(api.PerfectAPIClient)
        calls = list(re.finditer(r"self\.session\.(get|post)\(", src))
        assert calls, "no server calls found"
        for m in calls:
            before = src[max(0, m.start() - 200):m.start()]
            assert "with self._lock:" in before, f"unlocked server call near: {src[m.start():m.start()+60]!r}"
            call_text = src[m.start():src.index(")", m.start() + 1) + 1]
            # allow the timeout to come via a variable only in fetch_text, which clamps it
            assert "timeout=" in call_text, f"server call without timeout: {call_text!r}"

    def test_callback_may_call_the_client_without_deadlock(self):
        client = _make_client()
        seen: list = []
        polls = {"n": 0}

        def get(url, **kwargs):
            polls["n"] += 1
            if polls["n"] == 1:
                return _ok_response({"run_id": "r1", "flow_name": "F", "configuration": "dev"})
            client._listening = False
            raise requests.exceptions.Timeout()

        def callback(req):
            # user code runs outside the lock, so it can talk to the server freely
            seen.append(client.send_log(req.run_id, "from callback"))
            seen.append(client.update_task_state(req.run_id, 0, "RUNNING"))

        client.on_execution_request(callback)
        with patch.object(client.session, "get", side_effect=get), \
             patch.object(client.session, "post", return_value=_ok_response({})):
            _run_with_deadline(lambda: client.listen_for_executions(heartbeat=False), 5.0)
        assert seen == [True, True]

    def test_heartbeats_keep_flowing_while_polling_continuously(self):
        client = _make_client()
        beats = {"n": 0}
        stop_at = time.monotonic() + 0.6

        def get(url, **kwargs):
            time.sleep(0.02)                     # each poll holds the lock briefly
            if time.monotonic() > stop_at:
                client._listening = False
            raise requests.exceptions.Timeout()

        def post(url, **kwargs):
            beats["n"] += 1
            return _ok_response({})

        client.on_execution_request(lambda req: None)
        with patch.object(client.session, "get", side_effect=get), \
             patch.object(client.session, "post", side_effect=post):
            _run_with_deadline(lambda: client.listen_for_executions(heartbeat=True, heartbeat_interval=0.02), 5.0)
        assert beats["n"] >= 5, f"heartbeats starved by the poll loop: {beats['n']}"

    def test_close_while_heartbeat_is_mid_request_returns_promptly(self):
        client = _make_client()
        in_call = threading.Event()

        def slow_post(url, **kwargs):
            in_call.set()
            time.sleep(0.3)
            return _ok_response({})

        with patch.object(client.session, "post", side_effect=slow_post):
            client.start_heartbeat(60.0)
            assert in_call.wait(1.0)
            started = time.monotonic()
            _run_with_deadline(client.close, 5.0)
            assert time.monotonic() - started < 2.0
        assert client.heartbeat_active is False

    def test_many_threads_mixed_calls_finish_and_leave_the_lock_free(self):
        client = _make_client()
        errors: list = []

        def ok(url, **kwargs):
            time.sleep(0.001)
            r = _ok_response({"flow": {}, "runId": "r", "success": True, "report": {}, "reports": []})
            r.text = ""
            return r

        def worker(i):
            try:
                for _ in range(10):
                    client.send_log("r", "x")
                    client.update_task_state("r", 0, "RUNNING", progress=i)
                    client.send_heartbeat()
                    client.get_report("r")
                    client.fetch_text("/x")
            except Exception as e:  # noqa: BLE001
                errors.append(e)

        with patch.object(client.session, "post", side_effect=ok), \
             patch.object(client.session, "get", side_effect=ok):
            threads = [threading.Thread(target=worker, args=(i,)) for i in range(12)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(10.0)
                assert not t.is_alive(), "worker hung"
        assert errors == []
        assert client._lock.acquire(blocking=False)
        client._lock.release()

    @pytest.mark.parametrize("bad", [None, 0, -1, float("inf"), float("nan"), "10"])
    def test_fetch_text_never_holds_the_lock_without_a_bounded_timeout(self, bad):
        client = _make_client()
        resp = _ok_response({})
        resp.text = "x"
        with patch.object(client.session, "get", return_value=resp) as mock_get:
            client.fetch_text("/x", timeout=bad)
        assert mock_get.call_args[1]["timeout"] == client.DEFAULT_FETCH_TIMEOUT_S

    def test_pickled_copy_gets_a_fresh_lock_and_works(self):
        import pickle
        client = _make_client()
        # patch the Session (dropped from the pickled state), not the client itself
        with patch.object(client.session, "post", return_value=_ok_response({})):
            client.start_heartbeat(0.05)
            copy = pickle.loads(pickle.dumps(client))   # pickled while a thread is running
            client.stop_heartbeat()
        assert copy.base_url == client.base_url
        assert copy._lock is not client._lock
        assert copy.heartbeat_active is False
        with patch.object(copy.session, "post", return_value=_ok_response({})):
            assert copy.send_heartbeat() is True

    @pytest.mark.skipif(not hasattr(os, "fork"), reason="no fork on this platform")
    def test_forked_child_is_not_stuck_on_a_lock_the_parent_holds(self):
        client = _make_client()
        with client._lock:                       # parent holds the lock across the fork
            pid = os.fork()
        if pid == 0:                             # child
            try:
                got = client._lock.acquire(blocking=False)
                os._exit(0 if got else 3)
            except BaseException:  # noqa: BLE001
                os._exit(4)
        _, status = os.waitpid(pid, 0)
        assert os.WEXITSTATUS(status) == 0, "child inherited a held lock"


class TestFairLock:
    def test_hands_off_in_arrival_order(self):
        from perfect.api import _FairRLock
        lock = _FairRLock()
        order: list = []
        gates = [threading.Event() for _ in range(3)]

        def waiter(i):
            gates[i].wait()
            with lock:
                order.append(i)

        with lock:
            threads = [threading.Thread(target=waiter, args=(i,)) for i in range(3)]
            for t in threads:
                t.start()
            for i in range(3):           # line them up in a known order
                gates[i].set()
                time.sleep(0.03)
        for t in threads:
            t.join(2.0)
        assert order == [0, 1, 2]

    def test_reentrant_and_non_blocking_semantics(self):
        from perfect.api import _FairRLock
        lock = _FairRLock()
        assert lock.acquire(blocking=False)
        assert lock.acquire(blocking=False)      # re-entrant on the same thread
        assert lock._is_owned()
        other: list = []
        t = threading.Thread(target=lambda: other.append(lock.acquire(blocking=False)))
        t.start(); t.join()
        assert other == [False]                  # another thread can't take it
        lock.release()
        assert lock._is_owned()                  # still held once
        lock.release()
        assert not lock._is_owned()
        with pytest.raises(RuntimeError):
            lock.release()

    def test_a_tight_loop_cannot_starve_a_waiter(self):
        from perfect.api import _FairRLock
        lock = _FairRLock()
        stop = threading.Event()
        got = threading.Event()

        def hog():
            while not stop.is_set():
                with lock:
                    time.sleep(0.005)

        def waiter():
            with lock:
                got.set()

        h = threading.Thread(target=hog, daemon=True); h.start()
        time.sleep(0.02)
        w = threading.Thread(target=waiter); w.start()
        assert got.wait(1.0), "waiter starved by the hogging thread"
        stop.set(); h.join(1.0); w.join(1.0)
