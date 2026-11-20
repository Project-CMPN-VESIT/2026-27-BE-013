"""
ai_cache.py -- NarrativeShift Phase 4
In-process async-safe LRU cache for AI responses.
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from collections import OrderedDict
from typing import Any, Optional

logger = logging.getLogger(__name__)

CACHE_MAX_ENTRIES: int = int(os.environ.get("AI_CACHE_MAX_ENTRIES", "200"))
CACHE_TTL_SECONDS: int = int(os.environ.get("AI_CACHE_TTL", "3600"))

_PERSIST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "ai_cache.json"
)


class CacheEntry:
    __slots__ = ("response", "created_at", "expires_at", "task_type")

    def __init__(self, response: Any, task_type: str, ttl: int = CACHE_TTL_SECONDS):
        self.response   = response
        self.task_type  = task_type
        self.created_at = time.monotonic()
        self.expires_at = time.monotonic() + ttl

    @property
    def is_expired(self) -> bool:
        return time.monotonic() >= self.expires_at

    def to_dict(self) -> dict:
        return {
            "response": self.response,
            "task_type": self.task_type,
            "expires_in_sec": max(0.0, round(self.expires_at - time.monotonic(), 1)),
        }


class AICache:
    """
    Async-safe LRU cache for NarrativeShift AI responses.
    Key: sha256(investigation_id|pipeline_version|task_type|model_id|prompt_version|context_version|context_hash)
    """

    def __init__(self, max_entries: int = CACHE_MAX_ENTRIES, ttl: int = CACHE_TTL_SECONDS):
        self._max_entries = max_entries
        self._ttl = ttl
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        self._hits   = 0
        self._misses = 0

    def make_key(
        self,
        investigation_id: str,
        pipeline_version: str,
        task_type: str,
        model_id: str,
        prompt_version: str,
        context_version: str,
        context_hash: str,
    ) -> str:
        raw = "|".join([
            investigation_id, pipeline_version, task_type,
            model_id, prompt_version, context_version, context_hash
        ])
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            if entry.is_expired:
                del self._store[key]
                self._misses += 1
                return None
            self._store.move_to_end(key)
            self._hits += 1
            return entry.response

    async def set(self, key: str, response: Any, task_type: str) -> None:
        async with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            else:
                if len(self._store) >= self._max_entries:
                    self._evict_lru_or_expired()
            self._store[key] = CacheEntry(response, task_type, self._ttl)

    async def invalidate(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def stats(self) -> dict:
        async with self._lock:
            total = self._hits + self._misses
            return {
                "entries": len(self._store),
                "max_entries": self._max_entries,
                "ttl_seconds": self._ttl,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": round(100 * self._hits / total, 1) if total else 0.0,
            }

    async def load_from_disk(self) -> None:
        """Best-effort restore from disk on startup. Skips expired/sensitive entries."""
        try:
            if not os.path.exists(_PERSIST_PATH):
                return
            with open(_PERSIST_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            loaded = 0
            now_m = time.monotonic()
            async with self._lock:
                for k, v in data.items():
                    remaining = float(v.get("expires_in_sec", 0))
                    if remaining <= 0:
                        continue
                    entry = CacheEntry.__new__(CacheEntry)
                    entry.response   = v["response"]
                    entry.task_type  = v.get("task_type", "unknown")
                    entry.created_at = now_m
                    entry.expires_at = now_m + remaining
                    self._store[k] = entry
                    loaded += 1
                    if loaded >= self._max_entries:
                        break
            logger.info("[AICache] Loaded %d entries from disk", loaded)
        except Exception as exc:
            logger.warning("[AICache] Could not load cache from disk: %s", exc)

    async def save_to_disk(self) -> None:
        """Best-effort persist. Only saves non-conversation task types. Never saves API keys."""
        SAFE_TYPES = {"summary", "why_shift", "narrative_evolution"}
        try:
            os.makedirs(os.path.dirname(_PERSIST_PATH), exist_ok=True)
            async with self._lock:
                safe = {
                    k: e.to_dict()
                    for k, e in self._store.items()
                    if not e.is_expired and e.task_type in SAFE_TYPES
                }
            with open(_PERSIST_PATH, "w", encoding="utf-8") as f:
                json.dump(safe, f, indent=2)
            logger.info("[AICache] Saved %d entries to disk", len(safe))
        except Exception as exc:
            logger.warning("[AICache] Could not save cache to disk: %s", exc)

    def _evict_lru_or_expired(self) -> None:
        expired_keys = [k for k, e in self._store.items() if e.is_expired]
        if expired_keys:
            for k in expired_keys:
                del self._store[k]
        else:
            self._store.popitem(last=False)


_cache_instance: Optional[AICache] = None


def get_cache() -> AICache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = AICache()
    return _cache_instance
