"""Redis caching service for TakumiRoute."""
from __future__ import annotations

import hashlib
import json
from typing import Any

import redis.asyncio as redis

from app.config import settings

_pool: redis.ConnectionPool | None = None


async def get_redis() -> redis.Redis:
    """Get an async Redis client from the shared connection pool."""
    global _pool  # noqa: PLW0603
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL, decode_responses=True
        )
    return redis.Redis(connection_pool=_pool)


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _pool  # noqa: PLW0603
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def _cache_key(prefix: str, data: Any) -> str:
    """Generate a deterministic cache key from a prefix and data."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    digest = hashlib.sha256(serialized.encode()).hexdigest()[:16]
    return f"takumi:{prefix}:{digest}"


async def cache_get(prefix: str, data: Any) -> Any | None:
    """Retrieve a cached value, or None if not found."""
    client = await get_redis()
    key = _cache_key(prefix, data)
    raw = await client.get(key)
    if raw is not None:
        return json.loads(raw)
    return None


async def cache_set(
    prefix: str, data: Any, value: Any, ttl_seconds: int = 3600
) -> None:
    """Store a value in cache with TTL."""
    client = await get_redis()
    key = _cache_key(prefix, data)
    await client.set(key, json.dumps(value, default=str), ex=ttl_seconds)
