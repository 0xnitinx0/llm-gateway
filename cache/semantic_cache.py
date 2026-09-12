"""Compatibility import for the persistent semantic-cache implementation."""

from services.semantic_cache import CacheLookup, PgVectorSemanticCache

__all__ = ["CacheLookup", "PgVectorSemanticCache"]
