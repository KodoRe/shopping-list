#!/usr/bin/env python3
"""Home Kitchen — local API + static server (stdlib only).

WHY THIS EXISTS
---------------
The front-end is offline-first: localStorage in the *browser* is the instant
source of truth for the device. But the user (and Neo, the agent) also need a
*server-side* source of truth so that:
  - data survives a browser cache wipe,
  - a nightly cron can render it to markdown and commit it to the repo,
  - the agent can inject a recipe (extracted from YouTube) and have it appear
    in the app.

So this process is the VM-side persistence layer. It serves the static app AND
a small JSON API backed by flat files in ./data/. The browser's Store treats
this exactly like it treated Supabase: a best-effort sync target.

DESIGN STANCE
-------------
- Source of truth on the VM = data/{items,recipes,pantry}.json (committed to git).
- Trust nothing crossing the boundary: every payload is size-capped, JSON-parsed
  defensively, and run through a per-collection sanitizer that WHITELISTS fields
  and coerces types. Unknown fields are dropped, not stored.
- Writes are idempotent UPSERTS keyed by client-generated id. The offline queue
  may replay the same op; replay must not duplicate. (The error path is the design.)
- Writes are atomic: temp file + os.replace, under a process-wide lock. A crash
  mid-write can never corrupt the canonical file.
- Zero third-party deps. Pure stdlib so it runs anywhere python3 does and never
  rots from a dependency upgrade.
"""

import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
# DATA_DIR is overridable via HK_DATA_DIR so tests and the nightly renderer can
# target an explicit location without touching the repo's canonical data/.
DATA_DIR = os.environ.get("HK_DATA_DIR") or os.path.join(ROOT, "data")
MAX_BODY = 256 * 1024  # 256 KB — generous for a recipe, hostile to abuse.

# Collections we persist. Each maps to data/<name>.json holding a JSON array.
COLLECTIONS = ("items", "recipes", "pantry")

# Known shopping categories (mirror of app.js CAT_INFO keys). Anything else → 'other'.
CATEGORIES = {
    "produce", "dairy", "meat", "bakery", "frozen", "drinks",
    "snacks", "pantry", "household", "personal", "other",
}

_LOCK = threading.Lock()  # serialize read-modify-write across worker threads


# --------------------------------------------------------------------------- #
# shelf-life estimation
# --------------------------------------------------------------------------- #
# data/shelf-life.json maps product keywords → estimated shelf life in days. We
# load it once at import; if it's missing/corrupt we degrade to a flat default so
# the pantry still works (expiry estimation is a nice-to-have, never a hard dep).
_SHELF_LIFE = {"_default": 14, "map": {}}


def _load_shelf_life():
    global _SHELF_LIFE
    try:
        with open(os.path.join(ROOT, "data", "shelf-life.json"), encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get("map"), dict):
            # Pre-sort keywords by length descending so the longest (most specific)
            # match wins — 'sour cream' before 'cream', 'canned tomato' before 'tomato'.
            data["_sorted_keys"] = sorted(data["map"].keys(), key=len, reverse=True)
            _SHELF_LIFE = data
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass  # keep the flat default


def estimate_shelf_life_days(name):
    """Return estimated shelf life in days for a product name (longest-keyword-wins)."""
    if not name:
        return _SHELF_LIFE.get("_default", 14)
    low = name.lower()
    for kw in _SHELF_LIFE.get("_sorted_keys", []):
        if kw in low:
            return int(_SHELF_LIFE["map"][kw])
    return int(_SHELF_LIFE.get("_default", 14))


_load_shelf_life()


# --------------------------------------------------------------------------- #
# storage primitives
# --------------------------------------------------------------------------- #
def _path(collection):
    return os.path.join(DATA_DIR, f"{collection}.json")


def _read(collection):
    """Return the collection as a list. Missing/corrupt file → []."""
    try:
        with open(_path(collection), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return []


def _write_atomic(collection, rows):
    """Atomically persist `rows`. temp file + os.replace under the global lock."""
    os.makedirs(DATA_DIR, exist_ok=True)
    final = _path(collection)
    tmp = f"{final}.tmp.{os.getpid()}.{threading.get_ident()}"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=2)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, final)  # atomic on POSIX


def _now():
    return datetime.now(timezone.utc).isoformat()


def _add_days(iso_or_none, days):
    """Return an ISO timestamp `days` after the given ISO time (or after now)."""
    try:
        base = datetime.fromisoformat(iso_or_none) if iso_or_none else datetime.now(timezone.utc)
    except (TypeError, ValueError):
        base = datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return (base + timedelta(days=int(days))).isoformat()


# --------------------------------------------------------------------------- #
# boundary validation — parse, don't validate. Coerce raw input into a typed,
# whitelisted record. Drop everything we don't recognize.
# --------------------------------------------------------------------------- #
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _clean_str(val, maxlen):
    if val is None:
        return ""
    s = str(val).strip()
    return s[:maxlen]


def _clean_id(val):
    """Accept a client id only if it's sane; else mint one server-side."""
    if isinstance(val, str) and _ID_RE.match(val):
        return val
    return "srv-" + os.urandom(8).hex()


def _sanitize_item(raw):
    cat = _clean_str(raw.get("category"), 32).lower()
    return {
        "id": _clean_id(raw.get("id")),
        "name": _clean_str(raw.get("name"), 200),
        "category": cat if cat in CATEGORIES else "other",
        "qty": _clean_str(raw.get("qty"), 64),
        "checked": bool(raw.get("checked", False)),
        "added_by": _clean_str(raw.get("added_by"), 32) or "app",
        "created_at": _clean_str(raw.get("created_at"), 40) or _now(),
    }


def _sanitize_pantry(raw):
    cat = _clean_str(raw.get("category"), 32).lower()
    name = _clean_str(raw.get("name"), 200)
    stocked_at = _clean_str(raw.get("stocked_at"), 40) or _clean_str(raw.get("created_at"), 40) or _now()

    # Shelf life: honor a client-supplied positive integer (lets the UI override),
    # else estimate from the product name. expires_at is derived from stocked_at.
    shelf_days = None
    rsl = raw.get("shelf_life_days")
    if isinstance(rsl, (int, float)) and rsl > 0:
        shelf_days = int(rsl)
    if shelf_days is None:
        shelf_days = estimate_shelf_life_days(name)

    # expires_at: honor a client-supplied value (idempotent re-sync), else derive.
    expires_at = _clean_str(raw.get("expires_at"), 40) or _add_days(stocked_at, shelf_days)

    return {
        "id": _clean_id(raw.get("id")),
        "name": name,
        "category": cat if cat in CATEGORIES else "other",
        "qty": _clean_str(raw.get("qty"), 64),
        "shelf_life_days": shelf_days,
        "stocked_at": stocked_at,
        "expires_at": expires_at,
        "created_at": _clean_str(raw.get("created_at"), 40) or stocked_at,
    }


def _sanitize_recipe(raw):
    ingredients = []
    for ing in (raw.get("ingredients") or [])[:100]:
        if not isinstance(ing, dict):
            continue
        name = _clean_str(ing.get("name"), 200)
        if not name:
            continue
        ingredients.append({"name": name, "qty": _clean_str(ing.get("qty"), 64)})

    steps = []
    for step in (raw.get("steps") or [])[:100]:
        s = _clean_str(step, 2000)
        if s:
            steps.append(s)

    tags = []
    for tag in (raw.get("tags") or [])[:20]:
        t = _clean_str(tag, 40)
        if t:
            tags.append(t)

    nutrition = {}
    rn = raw.get("nutrition")
    if isinstance(rn, dict):
        for k in ("cal", "protein", "carbs", "fat"):
            try:
                nutrition[k] = round(float(rn.get(k, 0)), 1)
            except (TypeError, ValueError):
                nutrition[k] = 0

    return {
        "id": _clean_id(raw.get("id")),
        "name": _clean_str(raw.get("name"), 200),
        "tags": tags,
        "servings": _clean_str(raw.get("servings"), 32) or None,
        "time": _clean_str(raw.get("time"), 32) or None,
        "cuisine": _clean_str(raw.get("cuisine"), 64) or None,
        "source": _clean_str(raw.get("source"), 500) or None,
        "source_type": _clean_str(raw.get("source_type"), 64) or None,
        "ingredients": ingredients,
        "steps": steps,
        "nutrition": nutrition,
        "added_by": _clean_str(raw.get("added_by"), 32) or "app",
        "created_at": _clean_str(raw.get("created_at"), 40) or _now(),
    }


SANITIZERS = {
    "items": _sanitize_item,
    "pantry": _sanitize_pantry,
    "recipes": _sanitize_recipe,
}


# --------------------------------------------------------------------------- #
# collection operations (idempotent upsert by id)
# --------------------------------------------------------------------------- #
def upsert(collection, raw, prepend=False):
    record = SANITIZERS[collection](raw)
    if not record["name"]:
        raise ValueError("name is required")
    with _LOCK:
        rows = _read(collection)
        idx = next((i for i, r in enumerate(rows) if r.get("id") == record["id"]), None)
        if idx is not None:
            rows[idx] = record           # replay-safe: same id overwrites, never dupes
        elif prepend:
            rows.insert(0, record)       # recipes: newest first (matches app order)
        else:
            rows.append(record)
        _write_atomic(collection, rows)
    return record


def patch(collection, rid, updates):
    with _LOCK:
        rows = _read(collection)
        row = next((r for r in rows if r.get("id") == rid), None)
        if row is None:
            return None
        merged = dict(row)
        merged.update(updates or {})
        clean = SANITIZERS[collection](merged)
        clean["id"] = rid                # id is immutable across a patch
        rows[[r.get("id") for r in rows].index(rid)] = clean
        _write_atomic(collection, rows)
    return clean


def delete(collection, rid):
    with _LOCK:
        rows = _read(collection)
        kept = [r for r in rows if r.get("id") != rid]
        if len(kept) == len(rows):
            return False
        _write_atomic(collection, kept)
    return True


# --------------------------------------------------------------------------- #
# HTTP handler
# --------------------------------------------------------------------------- #
class Handler(SimpleHTTPRequestHandler):
    # Serve static files from the project root.
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # ---- helpers ----
    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        if length > MAX_BODY:
            raise ValueError("payload too large")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _route(self):
        """Return (collection, id) for an /api path, or (None, None)."""
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "api" and parts[1] in COLLECTIONS:
            rid = parts[2] if len(parts) >= 3 and parts[2] else None
            return parts[1], rid
        return None, None

    def _is_api(self):
        return urlparse(self.path).path.strip("/").startswith("api/") or \
            urlparse(self.path).path.strip("/") in ("api", "api/health")

    # ---- verbs ----
    def do_GET(self):
        path = urlparse(self.path).path.strip("/")
        if path == "api/health":
            return self._send_json({"ok": True, "ts": _now()})
        collection, _ = self._route()
        if collection:
            return self._send_json(_read(collection))
        return super().do_GET()  # static file

    def do_POST(self):
        collection, _ = self._route()
        if not collection:
            return self._send_json({"error": "not found"}, 404)
        try:
            body = self._read_body()
            rows = body if isinstance(body, list) else [body]
            saved = [upsert(collection, r, prepend=(collection == "recipes")) for r in rows]
            return self._send_json(saved, 201)
        except ValueError as e:
            return self._send_json({"error": str(e)}, 400)
        except json.JSONDecodeError:
            return self._send_json({"error": "invalid JSON"}, 400)

    def do_PATCH(self):
        collection, rid = self._route()
        if not collection or not rid:
            return self._send_json({"error": "not found"}, 404)
        try:
            updates = self._read_body()
            row = patch(collection, rid, updates)
            if row is None:
                return self._send_json({"error": "not found"}, 404)
            return self._send_json(row)
        except ValueError as e:  # JSONDecodeError is a ValueError subclass
            return self._send_json({"error": str(e)}, 400)

    def do_DELETE(self):
        collection, rid = self._route()
        if not collection or not rid:
            return self._send_json({"error": "not found"}, 404)
        ok = delete(collection, rid)
        return self._send_json({"deleted": ok}, 200 if ok else 404)

    # Quieter, structured-ish logging.
    def log_message(self, format, *args):  # noqa: A002 — name must match base class
        if os.environ.get("HK_QUIET") == "1":
            return
        super().log_message(format, *args)


def main():
    host = os.environ.get("HK_HOST", "127.0.0.1")
    port = int(os.environ.get("HK_PORT", "9210"))
    os.makedirs(DATA_DIR, exist_ok=True)
    for c in COLLECTIONS:  # seed empty collections so GET never 404s on first run
        if not os.path.exists(_path(c)):
            _write_atomic(c, [])
    srv = ThreadingHTTPServer((host, port), Handler)
    print(f"Home Kitchen API+static on http://{host}:{port}  (data: {DATA_DIR})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
