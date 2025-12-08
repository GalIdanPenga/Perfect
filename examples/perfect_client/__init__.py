"""
Perfect Python Client SDK

This package provides the Python SDK for building workflows with Perfect.

Package Structure:
- api: Low-level HTTP communication with Perfect backend
- sdk: Decorators, data structures, and workflow registry
- executor: Flow execution orchestration and progress tracking
"""

from .sdk import task, flow, get_registry, TaskResult, TaskState, LogCapture
from .api import create_client, ExecutionRequest, PerfectAPIClient
from .executor import FlowExecutor, create_execution_handler

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

    # Executor - Flow execution logic
    'FlowExecutor',
    'create_execution_handler',
]
