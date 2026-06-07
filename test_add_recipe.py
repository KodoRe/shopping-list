#!/usr/bin/env python3
"""Unit tests for add_recipe.py build_recipe() — the deterministic merge logic.

The network POST is exercised live in the integration flow; here we lock down the
pure transform (CLI args + base JSON → clean recipe dict). Run: python3 test_add_recipe.py
"""
import argparse
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ar", os.path.join(ROOT, "add_recipe.py"))
ar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ar)

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


def args(**kw):
    """Build an argparse.Namespace with all expected fields defaulted to None/empty."""
    base = dict(name=None, servings=None, time=None, cuisine=None, source=None,
                source_type=None, tag=None, ingredient=None, step=None)
    base.update(kw)
    return argparse.Namespace(**base)


# 1. inline-only build
r = ar.build_recipe(args(name="Soup", ingredient=["Onion:2", "Stock:1L"], step=["Chop", "Boil"]))
check("inline: name set", r["name"] == "Soup")
check("inline: ingredients parsed", r["ingredients"] == [{"name": "Onion", "qty": "2"}, {"name": "Stock", "qty": "1L"}])
check("inline: steps set", r["steps"] == ["Chop", "Boil"])
check("inline: id auto-generated with yt- prefix", r["id"].startswith("yt-soup-"))
check("inline: added_by defaults to agent", r["added_by"] == "agent")

# 2. ingredient with no qty
r = ar.build_recipe(args(name="X", ingredient=["Salt"]))
check("ingredient without qty → empty qty", r["ingredients"] == [{"name": "Salt", "qty": ""}])

# 3. base JSON + CLI override merge
base = {"name": "Base Name", "servings": "2", "ingredients": [{"name": "Egg", "qty": "1"}]}
r = ar.build_recipe(args(name="Override Name", time="20 min", ingredient=["Milk:1c"]), base)
check("merge: CLI name overrides base", r["name"] == "Override Name")
check("merge: base servings preserved", r["servings"] == "2")
check("merge: CLI time added", r["time"] == "20 min")
check("merge: ingredients appended to base", len(r["ingredients"]) == 2)

# 4. source sets default source_type
r = ar.build_recipe(args(name="X", source="https://youtu.be/abc"))
check("source: default source_type YouTube", r["source_type"] == "YouTube")
r = ar.build_recipe(args(name="X", source="https://youtu.be/abc", source_type="Custom"))
check("source: explicit source_type wins", r["source_type"] == "Custom")

# 5. tags accumulate
r = ar.build_recipe(args(name="X", tag=["breakfast", "quick"]))
check("tags: collected", r["tags"] == ["breakfast", "quick"])

# 6. explicit id preserved (idempotency anchor)
r = ar.build_recipe(args(name="X"), {"id": "fixed-123", "name": "Y"})
check("id: explicit base id preserved (idempotency)", r["id"] == "fixed-123")

# 7. missing name raises
try:
    ar.build_recipe(args())
    check("no name → ValueError", False)
except ValueError:
    check("no name → ValueError", True)

# 8. id is url-safe (slugified)
r = ar.build_recipe(args(name="Crème Brûlée & Co!"))
check("id: slugified to url-safe chars", all(c.isalnum() or c == "-" for c in r["id"]))

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
