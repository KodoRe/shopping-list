#!/usr/bin/env python3
"""add_recipe.py — inject a recipe into the Home Kitchen app via its local API.

WHY THIS EXISTS
---------------
The recipe-from-YouTube flow has two halves:
  1. REASONING (the agent's job): fetch the transcript, understand the cooking,
     and produce a clean structured recipe — name, ingredients[{name,qty}],
     steps[], servings, time, source URL.
  2. INJECTION (this script's job): take that structured recipe and POST it to
     the running server (server.py) so it lands in data/recipes.json and shows
     up in the app on next sync.

Keeping injection in a small, tested CLI means the deterministic part — HTTP,
payload shape, idempotent id, error handling — is reliable and reusable, while
the messy NL→structure extraction stays with the agent where it belongs.

USAGE
-----
# From a JSON file (the agent writes the recipe to a temp file, then calls this):
  python3 add_recipe.py --file /tmp/recipe.json

# From stdin:
  cat recipe.json | python3 add_recipe.py -

# Quick inline (minimal):
  python3 add_recipe.py --name "Shakshuka" --source "https://youtu.be/x" \
      --ingredient "Eggs:4" --ingredient "Tomato:5" \
      --step "Saute onion" --step "Crack eggs in"

The recipe JSON shape (all except name optional):
  {
    "name": "YouTube Shakshuka",
    "servings": "2", "time": "25 min", "cuisine": "Middle Eastern",
    "tags": ["breakfast"],
    "source": "https://youtube.com/watch?v=...", "source_type": "YouTube",
    "ingredients": [{"name": "Eggs", "qty": "4"}, {"name": "Tomato", "qty": "5"}],
    "steps": ["Saute the onion", "Add tomatoes", "Crack in the eggs"]
  }

Exit 0 on success (prints the saved recipe id + name). Non-zero on any failure,
with a human-readable reason on stderr — so a wrapper/agent can detect problems.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_API = os.environ.get("HK_API", "http://127.0.0.1:9210")


def _slug_id(name):
    base = "".join(c if c.isalnum() else "-" for c in (name or "recipe").lower()).strip("-")
    return f"yt-{base[:48]}-{os.urandom(3).hex()}"


def build_recipe(args, base=None):
    """Merge a base dict (from --file/stdin) with CLI overrides into a clean recipe."""
    r = dict(base or {})
    if args.name:
        r["name"] = args.name
    if args.servings:
        r["servings"] = args.servings
    if args.time:
        r["time"] = args.time
    if args.cuisine:
        r["cuisine"] = args.cuisine
    if args.source:
        r["source"] = args.source
        r.setdefault("source_type", "YouTube")
    if args.source_type:
        r["source_type"] = args.source_type
    if args.tag:
        r.setdefault("tags", [])
        r["tags"].extend(args.tag)
    # --ingredient "Name:qty" (qty optional)
    if args.ingredient:
        r.setdefault("ingredients", [])
        for spec in args.ingredient:
            name, _, qty = spec.partition(":")
            if name.strip():
                r["ingredients"].append({"name": name.strip(), "qty": qty.strip()})
    if args.step:
        r.setdefault("steps", [])
        r["steps"].extend(args.step)

    if not r.get("name"):
        raise ValueError("recipe needs a name (use --name or include it in the JSON)")
    # Stable, deterministic-ish id so accidental re-runs upsert instead of duplicating.
    r.setdefault("id", _slug_id(r["name"]))
    r.setdefault("added_by", "agent")
    return r


def post_recipe(api, recipe, timeout=8):
    url = api.rstrip("/") + "/api/recipes"
    data = json.dumps(recipe).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        saved = json.loads(body) if body else None
        return resp.status, saved


def main():
    ap = argparse.ArgumentParser(description="Inject a recipe into Home Kitchen via the local API.")
    ap.add_argument("file", nargs="?", help="JSON file path, or '-' for stdin")
    ap.add_argument("--file", dest="file_opt", help="JSON file path (alternative to positional)")
    ap.add_argument("--api", default=DEFAULT_API, help=f"API base (default {DEFAULT_API})")
    ap.add_argument("--name")
    ap.add_argument("--servings")
    ap.add_argument("--time")
    ap.add_argument("--cuisine")
    ap.add_argument("--source")
    ap.add_argument("--source-type", dest="source_type")
    ap.add_argument("--tag", action="append", help="repeatable")
    ap.add_argument("--ingredient", action="append", help="'Name:qty', repeatable")
    ap.add_argument("--step", action="append", help="repeatable")
    ap.add_argument("--dry-run", action="store_true", help="print the recipe JSON, don't POST")
    args = ap.parse_args()

    base = None
    src = args.file_opt or args.file
    if src:
        try:
            raw = sys.stdin.read() if src == "-" else open(src, encoding="utf-8").read()
            base = json.loads(raw)
        except (OSError, json.JSONDecodeError) as e:
            print(f"error: could not read recipe JSON from {src}: {e}", file=sys.stderr)
            return 2

    try:
        recipe = build_recipe(args, base)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.dry_run:
        print(json.dumps(recipe, ensure_ascii=False, indent=2))
        return 0

    try:
        status, saved = post_recipe(args.api, recipe)
    except urllib.error.URLError as e:
        print(f"error: could not reach the Home Kitchen API at {args.api} ({e}). "
              f"Is server.py running?", file=sys.stderr)
        return 3

    if status not in (200, 201):
        print(f"error: API returned {status}: {saved}", file=sys.stderr)
        return 4

    rec = saved[0] if isinstance(saved, list) and saved else saved
    if not isinstance(rec, dict):
        rec = {}
    name = rec.get("name", recipe["name"])
    rid = rec.get("id", recipe["id"])
    ings = len(rec.get("ingredients", recipe.get("ingredients", [])))
    steps = len(rec.get("steps", recipe.get("steps", [])))
    print(f"✓ added recipe '{name}' (id={rid}) — {ings} ingredients, {steps} steps")
    return 0


if __name__ == "__main__":
    sys.exit(main())
