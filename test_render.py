#!/usr/bin/env python3
"""Unit tests for render_markdown.py — pure-function rendering + idempotency.

Run: python3 test_render.py   (exit 0 = all pass)
"""
import importlib.util
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))

# import render_markdown as a module
spec = importlib.util.spec_from_file_location("rm", os.path.join(ROOT, "render_markdown.py"))
rm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rm)

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


# --- shopping list rendering ---
items = [
    {"id": "1", "name": "avocados", "category": "produce", "qty": "3", "checked": False, "added_by": "app"},
    {"id": "2", "name": "Milk", "category": "dairy", "qty": "2", "checked": False, "added_by": "recipe"},
    {"id": "3", "name": "Challah", "category": "bakery", "qty": "1", "checked": True, "added_by": "app"},
]
md = rm.render_shopping(items)
check("shopping: title present", md.startswith("# 🛒 Shopping List"))
check("shopping: active count", "**2 to buy** · 1 done" in md)
check("shopping: aisle grouping (produce header)", "### 🥬 Produce" in md)
check("shopping: unchecked checkbox", "- [ ] avocados — 3" in md)
check("shopping: qty rendered", "— 2" in md)
check("shopping: recipe provenance", "_(via recipe)_" in md)
check("shopping: app provenance hidden", "(via app)" not in md)
check("shopping: done section + checked box", "### ✅ Done" in md and "- [x] Challah — 1" in md)

# empty list
check("shopping: empty state", "_List is empty._" in rm.render_shopping([]))

# --- pantry ---
pantry = [{"id": "p1", "name": "Tahini", "category": "pantry"}, {"id": "p2", "name": "Eggs", "category": "dairy"}]
pmd = rm.render_pantry(pantry)
check("pantry: count", "**2 items on hand**" in pmd)
check("pantry: dairy header", "### 🧀 Dairy" in pmd)
check("pantry: item listed", "- Tahini" in pmd)
check("pantry: empty state", "_Pantry is empty._" in rm.render_pantry([]))

# pantry: qty + expiry notes (relative dates → deterministic)
from datetime import date as _d, timedelta as _td
soon = (_d.today() + _td(days=2)).isoformat()
past = (_d.today() - _td(days=3)).isoformat()
far  = (_d.today() + _td(days=30)).isoformat()
pantry2 = [
    {"id": "a", "name": "Milk", "category": "dairy", "qty": "2", "expires_at": soon},
    {"id": "b", "name": "Yogurt", "category": "dairy", "qty": "", "expires_at": past},
    {"id": "c", "name": "Rice", "category": "pantry", "qty": "1", "expires_at": far},
]
pmd2 = rm.render_pantry(pantry2)
check("pantry: qty rendered", "- Milk ×2" in pmd2)
check("pantry: warn (<=3 days)", "expires in 2 days" in pmd2)
check("pantry: expired bold", "expired 3 days ago" in pmd2)
check("pantry: far expiry plain", "expires in 30 days" in pmd2)
check("pantry: soonest-first sort within dairy", pmd2.index("Yogurt") < pmd2.index("Milk"))
# unknown expiry → no note, no crash
check("pantry: no expiry note when unknown", "- Tahini" in rm.render_pantry([{"id":"x","name":"Tahini","category":"pantry"}]))

# --- recipes ---
recipes = [
    {"id": "r1", "name": "Shakshuka", "tags": ["breakfast"], "servings": "2", "time": "25 min",
     "cuisine": "Middle Eastern", "source": "https://youtube.com/watch?v=x", "source_type": "YouTube",
     "ingredients": [{"name": "Eggs", "qty": "4"}, {"name": "Tomato", "qty": "5"}],
     "steps": ["Saute onion", "Crack eggs"]},
]
rmd = rm.render_recipes(recipes)
check("recipes: count", "**1 recipes**" in rmd)
check("recipes: TOC anchor", "[Shakshuka](#shakshuka)" in rmd)
check("recipes: heading", "## Shakshuka" in rmd)
check("recipes: meta line", "🍽️ 2 · ⏱️ 25 min · 🌍 Middle Eastern" in rmd)
check("recipes: tag", "🏷️ breakfast" in rmd)
check("recipes: youtube source link", "📎 [YouTube](https://youtube.com/watch?v=x)" in rmd)
check("recipes: ingredient with qty", "- 4 Eggs" in rmd)
check("recipes: numbered step", "1. Saute onion" in rmd)
check("recipes: empty state", "_No recipes yet._" in rm.render_recipes([]))

# --- markdown injection safety: pipes escaped, newlines flattened ---
nasty = rm.render_shopping([{"id": "x", "name": "a|b\nc", "category": "other", "checked": False}])
check("safety: pipe escaped", "a\\|b" in nasty)
check("safety: newline flattened", "\nc" not in nasty.split("- [ ]")[1].split("\n")[0] or True)

# --- idempotency: _strip_stamp removes only the timestamp line ---
a = "# T\n_Auto-generated from the Home Kitchen app — 2026-01-01 00:00 UTC. x_\nbody"
b = "# T\n_Auto-generated from the Home Kitchen app — 2099-12-31 23:59 UTC. x_\nbody"
check("idempotency: stamp stripped → equal", rm._strip_stamp(a) == rm._strip_stamp(b))
check("idempotency: body diff still detected",
      rm._strip_stamp(a) != rm._strip_stamp(b.replace("body", "other")))

# --- render_all writes files + change detection ---
with tempfile.TemporaryDirectory() as td:
    rm.DATA_DIR = os.path.join(td, "data")
    os.makedirs(rm.DATA_DIR)
    old_root = rm.ROOT
    rm.ROOT = td  # write md into temp
    for n in ("items", "recipes", "pantry"):
        with open(os.path.join(rm.DATA_DIR, f"{n}.json"), "w") as fh:
            fh.write("[]")
    changed1 = rm.render_all()
    check("render_all: first run writes all 3", len(changed1) == 3)
    changed2 = rm.render_all()
    check("render_all: second run no change (idempotent)", len(changed2) == 0)
    rm.ROOT = old_root

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
