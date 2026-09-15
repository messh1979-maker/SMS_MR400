"""
Thread-safe JSON cache with Atomic Write + monotonic version + TTL + single-flight.

- Atomic Write: tempfile.mkstemp + os.replace (same pattern as sent_log.json)
- Monotonic version: every put() stamps a strictly-increasing version so an
  older payload can never overwrite a newer one (Stale-While-Revalidate safety)
- SingleFlight: at most one background refresh per cache name
"""
import json
import os
import tempfile
import time
from itertools import count
from pathlib import Path
from threading import Lock

CACHE_DIR = Path(__file__).resolve().parent
_VERSIONS = count(1)  # نسخهٔ مانوتونیک سراسری (هرگز به عقب برنمی‌گردد)


class CacheStore:
    """فایل JSON کش با قفل اختصاصی، TTL و نسخهٔ نظیربه‌نظیر."""

    def __init__(self, name: str, ttl_seconds: int = 15):
        self.path = CACHE_DIR / ("cache_%s.json" % name)
        self.ttl = ttl_seconds
        self._lock = Lock()

    def get(self):
        """برگشت سندِ کش (صرف‌نظر از کهنگی) یا None."""
        with self._lock:
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return None

    def fresh(self, doc) -> bool:
        return bool(doc) and (time.time() - doc.get("cached_at", 0)) <= self.ttl

    def put(self, payload: dict) -> dict:
        """نوشتن اتمی کش با نسخهٔ مانوتونیک جدید."""
        doc = {"cached_at": time.time(), "version": next(_VERSIONS), **payload}
        with self._lock:
            fd, tmp = tempfile.mkstemp(dir=str(CACHE_DIR), suffix=".json")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(doc, f, ensure_ascii=False, indent=2)
            except BaseException:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
            try:
                os.replace(tmp, self.path)
            except OSError:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
                raise
        return doc

    def invalidate(self) -> None:
        """فراخوانی در عملیات‌های جهش (send/delete) → فراخوانی بعدی حتماً refresh می‌کند."""
        with self._lock:
            try:
                self.path.unlink()
            except OSError:
                pass


class SingleFlight:
    """اجازهٔ فقط یک refresh همزمان برای هر کلید (نام کش)."""

    def __init__(self):
        self._guard = Lock()
        self._locks: dict[str, Lock] = {}

    def try_acquire(self, key: str) -> bool:
        with self._guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = Lock()
                self._locks[key] = lock
        return lock.acquire(blocking=False)

    def release(self, key: str) -> None:
        with self._guard:
            lock = self._locks.get(key)
        if lock is not None:
            lock.release()


def purge_old_caches(max_age_seconds: int = 3600) -> None:
    """پاک‌سازی کش‌های کهنه در هنگام استارت اپ (کاهش ریسک نشت PII)."""
    for p in CACHE_DIR.glob("cache_*.json"):
        try:
            if time.time() - p.stat().st_mtime > max_age_seconds:
                p.unlink()
        except OSError:
            pass