"""Request persistence moved to services.request_logging."""

from services.request_logging import emit_request_log, persist_request_log

__all__ = ["emit_request_log", "persist_request_log"]
