"""
Perfect Python Client SDK

This package provides the Python SDK for building workflows with Perfect.

Package Structure:
- api: Low-level HTTP communication with Perfect backend
- sdk: Decorators, data structures, and workflow registry
- executor: Handles execution requests from the backend
"""

from .sdk import task, flow, get_registry, TaskResult, TaskState, LogCapture
from .api import create_client, ExecutionRequest, PerfectAPIClient
from .executor import create_execution_handler

__all__ = [
    # SDK - User-facing decorators and data structures
    'task',
    'flow',
    'get_registry',
    'TaskResult',
    'TaskState',
    'LogCapture',

    # API - Backend communication
    'create_client',
    'ExecutionRequest',
    'PerfectAPIClient',

    # Executor - Execution request handling
    'create_execution_handler',
]
