#!/usr/bin/env python3
"""Integration tests for server.py — boots the REAL server on a throwaway port
and exercises the actual HTTP surface. No mocks: if these pass, the wire works.

Run: python3 test_server.py   (exit 0 = all pass)
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 9219  # throwaway, distinct from prod 9210
BASE = f"http://127.0.0.1:{PORT}"

PASS = 0
FAIL = 0


def check(label, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok   {label}")
    else:
        FAIL += 1
        print(f"  FAIL {label}")


def _maybe_json(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw  # non-JSON (e.g. static HTML) — return as text


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            return resp.status, _maybe_json(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, _maybe_json(e.read().decode())


def main():
    # Run the server against an ISOLATED temp data dir so we never touch real data.
    tmp = tempfile.mkdtemp(prefix="hk-test-")
    env = dict(os.environ, HK_PORT=str(PORT), HK_QUIET="1")
    # Symlink trick: server writes to <ROOT>/data, so point that at tmp via env-less
    # override is not supported; instead we run a copy with DATA_DIR patched via cwd.
    # Simpler: monkeypatch through an env var the server understands. It doesn't have
    # one for DATA_DIR, so we run from tmp as cwd and pass an override module path.
    # --- Cleanest: set DATA_DIR via a tiny wrapper that imports server and overrides.
    wrapper = os.path.join(tmp, "run.py")
    with open(wrapper, "w") as fh:
        fh.write(
            "import sys, os\n"
            f"sys.path.insert(0, {ROOT!r})\n"
            "import server\n"
            f"server.DATA_DIR = {os.path.join(tmp, 'data')!r}\n"
            "server.main()\n"
        )
    proc = subprocess.Popen([sys.executable, wrapper], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # wait for readiness
        for _ in range(50):
            try:
                s, _ = req("GET", "/api/health")
                if s == 200:
                    break
            except Exception:
                time.sleep(0.1)
        else:
            print("server failed to start")
            return 1

        # 1. health
        s, b = req("GET", "/api/health")
        check("health 200 + ok flag", s == 200 and b.get("ok") is True)

        # 2. empty collection
        s, b = req("GET", "/api/items")
        check("empty items → [] 200", s == 200 and b == [])

        # 3. upsert item with client id
        s, b = req("POST", "/api/items", {"id": "loc-abc", "name": "Milk", "category": "dairy", "qty": "2"})
        check("POST item 201", s == 201 and isinstance(b, list) and b[0]["id"] == "loc-abc")
        check("item sanitized (checked defaulted)", b[0]["checked"] is False and b[0]["added_by"] == "app")

        # 4. it persisted
        s, b = req("GET", "/api/items")
        check("item persisted", len(b) == 1 and b[0]["name"] == "Milk")

        # 5. IDEMPOTENT REPLAY — same id again must NOT duplicate (the load-bearing property)
        req("POST", "/api/items", {"id": "loc-abc", "name": "Milk", "category": "dairy", "qty": "2"})
        s, b = req("GET", "/api/items")
        check("idempotent replay (no dup on same id)", len(b) == 1)

        # 6. second distinct item appends
        req("POST", "/api/items", {"id": "loc-def", "name": "Eggs", "category": "dairy"})
        s, b = req("GET", "/api/items")
        check("second item appended", len(b) == 2)

        # 7. PATCH toggles checked
        s, b = req("PATCH", "/api/items/loc-abc", {"checked": True})
        check("PATCH updates field", s == 200 and b["checked"] is True)
        check("PATCH preserves id", b["id"] == "loc-abc")

        # 8. PATCH unknown id → 404
        s, b = req("PATCH", "/api/items/nope", {"checked": True})
        check("PATCH unknown → 404", s == 404)

        # 9. DELETE
        s, b = req("DELETE", "/api/items/loc-def")
        check("DELETE 200 + deleted true", s == 200 and b["deleted"] is True)
        s, b = req("GET", "/api/items")
        check("delete removed row", len(b) == 1)

        # 10. validation: missing name → 400
        s, b = req("POST", "/api/items", {"id": "x1", "qty": "5"})
        check("missing name → 400", s == 400)

        # 11. unknown category coerced to 'other'
        s, b = req("POST", "/api/items", {"id": "cat1", "name": "Mystery", "category": "wat"})
        check("bad category → other", b[0]["category"] == "other")

        # 12. unknown fields dropped (whitelist)
        s, b = req("POST", "/api/items", {"id": "evil", "name": "X", "hacker": "DROP TABLE"})
        check("unknown field dropped", "hacker" not in b[0])

        # 13. recipe upsert with nested ingredients/steps, newest-first
        recipe = {
            "id": "r1", "name": "Shakshuka", "tags": ["breakfast"], "servings": "2",
            "time": "25 min", "ingredients": [{"name": "Eggs", "qty": "4"}, {"name": "Tomato", "qty": "3"}],
            "steps": ["Heat oil", "Add tomatoes", "Crack eggs"],
        }
        s, b = req("POST", "/api/recipes", recipe)
        check("recipe POST 201", s == 201 and b[0]["name"] == "Shakshuka")
        check("recipe ingredients sanitized", len(b[0]["ingredients"]) == 2 and b[0]["ingredients"][0]["name"] == "Eggs")
        check("recipe steps kept", len(b[0]["steps"]) == 3)

        # 14. recipes are prepended (newest first)
        req("POST", "/api/recipes", {"id": "r2", "name": "Salad"})
        s, b = req("GET", "/api/recipes")
        check("recipe newest-first", b[0]["id"] == "r2" and b[1]["id"] == "r1")

        # 15. pantry collection + expiry schema
        s, b = req("POST", "/api/pantry", {"id": "p1", "name": "Olive Oil", "category": "pantry"})
        check("pantry POST 201", s == 201 and b[0]["name"] == "Olive Oil")
        check("pantry: qty field present", "qty" in b[0])
        check("pantry: shelf_life_days estimated (olive oil=540)", b[0]["shelf_life_days"] == 540)
        check("pantry: stocked_at + expires_at present", bool(b[0]["stocked_at"]) and bool(b[0]["expires_at"]))

        # 15b. shelf-life estimation: longest-keyword-wins
        s, b = req("POST", "/api/pantry", {"id": "p2", "name": "White Cheese block"})
        check("pantry: 'white cheese' (10) beats 'cheese' (21)", b[0]["shelf_life_days"] == 10)
        s, b = req("POST", "/api/pantry", {"id": "p3", "name": "Cheddar Cheese"})
        check("pantry: plain 'cheese' → 21", b[0]["shelf_life_days"] == 21)
        s, b = req("POST", "/api/pantry", {"id": "p4", "name": "Mystery Widget"})
        check("pantry: unknown → default 14", b[0]["shelf_life_days"] == 14)

        # 15c. client-supplied shelf_life_days overrides the estimate
        s, b = req("POST", "/api/pantry", {"id": "p5", "name": "Milk", "shelf_life_days": 99})
        check("pantry: client shelf_life_days override honored", b[0]["shelf_life_days"] == 99)

        # 15d. qty carried (from a check→pantry move)
        s, b = req("POST", "/api/pantry", {"id": "p6", "name": "Eggs", "qty": "12"})
        check("pantry: qty carried", b[0]["qty"] == "12" and b[0]["shelf_life_days"] == 28)

        # 16. size cap (>256KB) → 400
        big = {"id": "big", "name": "x" * (300 * 1024)}
        s, b = req("POST", "/api/items", big)
        check("oversized payload → 400", s == 400)

        # 17. static file still served (index.html)
        s2, _ = req("GET", "/index.html")
        check("static index served", s2 == 200)

        # 18. unknown api collection → 404
        s, b = req("POST", "/api/bogus", {"name": "x"})
        check("unknown collection → 404", s == 404)

        print(f"\n{PASS} passed, {FAIL} failed")
        return 1 if FAIL else 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    sys.exit(main())
