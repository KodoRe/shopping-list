#!/usr/bin/env python3
"""render_markdown.py — project the canonical JSON data into human-readable markdown.

WHY
---
data/{items,recipes,pantry}.json is the source of truth (structured, the app reads
it). But Nitai wants a readable, grep-able, git-backed mirror — the kind of thing
you can open on your phone, skim, or search from a terminal. Markdown is that mirror.

IMPORTANT: markdown is a GENERATED PROJECTION, never an input. We render JSON → md,
never parse md → JSON. Parsing markdown back would be lossy and brittle; the JSON
stays canonical. This is a one-way, deterministic render.

The nightly cron calls this with --commit to render + git add/commit/push in one shot.
It only commits when something actually changed, so history stays clean.

Usage:
  python3 render_markdown.py            # render md files only
  python3 render_markdown.py --commit   # render, then git commit+push if changed
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, date

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("HK_DATA_DIR") or os.path.join(ROOT, "data")

CAT_LABELS = {
    "produce": "🥬 Produce", "dairy": "🧀 Dairy", "meat": "🥩 Meat & Fish",
    "bakery": "🍞 Bakery", "frozen": "🧊 Frozen", "drinks": "🥤 Drinks",
    "snacks": "🍿 Snacks", "pantry": "🥫 Pantry", "household": "🧹 Household",
    "personal": "🧴 Personal Care", "other": "📦 Other",
}
CAT_ORDER = ["produce", "dairy", "meat", "bakery", "frozen", "drinks",
             "snacks", "pantry", "household", "personal", "other"]


def _load(name):
    try:
        with open(os.path.join(DATA_DIR, f"{name}.json"), encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return []


def _stamp():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _esc(s):
    """Escape markdown-significant chars in inline text."""
    return str(s or "").replace("|", "\\|").replace("\n", " ").strip()


# --------------------------------------------------------------------------- #
# renderers — each returns a markdown string
# --------------------------------------------------------------------------- #
def render_shopping(items):
    lines = ["# 🛒 Shopping List", "",
             f"_Auto-generated from the Home Kitchen app — {_stamp()}. Do not edit by hand._", ""]
    active = [i for i in items if not i.get("checked")]
    done = [i for i in items if i.get("checked")]

    if not items:
        lines += ["_List is empty._", ""]
        return "\n".join(lines)

    lines.append(f"**{len(active)} to buy**" + (f" · {len(done)} done" if done else ""))
    lines.append("")

    # group active items by category in aisle order
    by_cat = {}
    for it in active:
        by_cat.setdefault(it.get("category", "other"), []).append(it)
    for cat in CAT_ORDER:
        rows = by_cat.get(cat)
        if not rows:
            continue
        lines.append(f"### {CAT_LABELS.get(cat, cat)}")
        for it in rows:
            qty = f" — {_esc(it['qty'])}" if it.get("qty") else ""
            who = it.get("added_by")
            tag = f"  _(via {_esc(who)})_" if who and who not in ("app", "") else ""
            lines.append(f"- [ ] {_esc(it['name'])}{qty}{tag}")
        lines.append("")

    if done:
        lines.append("### ✅ Done")
        for it in done:
            qty = f" — {_esc(it['qty'])}" if it.get("qty") else ""
            lines.append(f"- [x] {_esc(it['name'])}{qty}")
        lines.append("")
    return "\n".join(lines)


def _pantry_expiry_note(p):
    """Human note for a pantry item's expiry, or '' if unknown."""
    iso = p.get("expires_at")
    if not iso:
        return ""
    try:
        exp = datetime.strptime(iso[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return ""
    d = (exp - date.today()).days
    if d < 0:
        return " — ⚠️ **expired**" if d == -1 else f" — ⚠️ **expired {-d} days ago**"
    if d == 0:
        return " — ⚠️ **expires today**"
    if d == 1:
        return " — ⏳ expires tomorrow"
    if d <= 3:
        return f" — ⏳ expires in {d} days"
    return f" — expires in {d} days"


def render_pantry(pantry):
    lines = ["# 🏪 Pantry", "",
             f"_Auto-generated from the Home Kitchen app — {_stamp()}. Do not edit by hand._", ""]
    if not pantry:
        lines += ["_Pantry is empty._", ""]
        return "\n".join(lines)
    lines.append(f"**{len(pantry)} items on hand**")
    lines.append("")
    by_cat = {}
    for p in pantry:
        by_cat.setdefault(p.get("category", "other"), []).append(p)
    for cat in CAT_ORDER:
        rows = by_cat.get(cat)
        if not rows:
            continue
        # Within a category, soonest-to-expire first (unknown expiry last).
        rows = sorted(rows, key=lambda p: (p.get("expires_at") or "9999-12-31"))
        lines.append(f"### {CAT_LABELS.get(cat, cat)}")
        for p in rows:
            qty = str(p.get("qty", "") or "").strip()
            qty_str = f" ×{qty}" if qty else ""
            lines.append(f"- {_esc(p['name'])}{qty_str}{_pantry_expiry_note(p)}")
        lines.append("")
    return "\n".join(lines)


def render_recipes(recipes):
    lines = ["# 🍳 Recipes", "",
             f"_Auto-generated from the Home Kitchen app — {_stamp()}. Do not edit by hand._", ""]
    if not recipes:
        lines += ["_No recipes yet._", ""]
        return "\n".join(lines)
    lines.append(f"**{len(recipes)} recipes**")
    lines.append("")
    # table of contents
    for r in recipes:
        lines.append(f"- [{_esc(r.get('name', 'Untitled'))}](#{_slug(r.get('name', 'untitled'))})")
    lines.append("")
    lines.append("---")
    lines.append("")
    for r in recipes:
        name = _esc(r.get("name", "Untitled"))
        lines.append(f"## {name}")
        meta = []
        if r.get("servings"):
            meta.append(f"🍽️ {_esc(r['servings'])}")
        if r.get("time"):
            meta.append(f"⏱️ {_esc(r['time'])}")
        if r.get("cuisine"):
            meta.append(f"🌍 {_esc(r['cuisine'])}")
        tags = r.get("tags") or []
        if tags:
            meta.append("🏷️ " + ", ".join(_esc(t) for t in tags))
        if meta:
            lines.append(" · ".join(meta))
            lines.append("")
        if r.get("source"):
            st = _esc(r.get("source_type") or "Source")
            lines.append(f"📎 [{st}]({_esc(r['source'])})")
            lines.append("")
        ings = r.get("ingredients") or []
        if ings:
            lines.append("**Ingredients**")
            lines.append("")
            for ing in ings:
                qty = f"{_esc(ing.get('qty'))} " if ing.get("qty") else ""
                lines.append(f"- {qty}{_esc(ing.get('name'))}")
            lines.append("")
        steps = r.get("steps") or []
        if steps:
            lines.append("**Steps**")
            lines.append("")
            for i, s in enumerate(steps, 1):
                lines.append(f"{i}. {_esc(s)}")
            lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


def _slug(text):
    return "".join(c if c.isalnum() else "-" for c in str(text).lower()).strip("-")


# --------------------------------------------------------------------------- #
# write + optional commit
# --------------------------------------------------------------------------- #
TARGETS = {
    "SHOPPING-LIST.md": ("items", render_shopping),
    "PANTRY.md": ("pantry", render_pantry),
    "RECIPES.md": ("recipes", render_recipes),
}


def render_all():
    """Render all markdown files. Returns list of files whose content changed."""
    changed = []
    for fname, (collection, fn) in TARGETS.items():
        content = fn(_load(collection))
        path = os.path.join(ROOT, fname)
        old = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
        # Compare ignoring the timestamp line so an unchanged dataset doesn't churn.
        if _strip_stamp(old) != _strip_stamp(content):
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            changed.append(fname)
        elif old is None:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            changed.append(fname)
    return changed


def _strip_stamp(text):
    """Drop the 'Auto-generated … UTC' line so timestamp-only diffs don't trigger commits."""
    if not text:
        return text
    return "\n".join(l for l in text.splitlines() if "Auto-generated from the Home Kitchen" not in l)


def git_commit_push():
    env = dict(os.environ)
    env.setdefault("GH_CONFIG_DIR", "/home/jacopo/.config/gh")
    env.setdefault("HOME", "/home/jacopo")

    def git(*args):
        return subprocess.run(["git", "-C", ROOT, *args], env=env,
                              capture_output=True, text=True)

    # Stage canonical data + rendered markdown.
    git("add", "data/items.json", "data/recipes.json", "data/pantry.json",
        "SHOPPING-LIST.md", "PANTRY.md", "RECIPES.md")
    # Did anything we care about actually get staged? Check the INDEX, not the work
    # tree — unrelated untracked files (e.g. new deploy units) must not trigger a
    # commit, and an unchanged dataset must be a clean no-op. `git diff --cached
    # --quiet` exits 0 when the index matches HEAD (nothing staged), 1 when it differs.
    staged = git("diff", "--cached", "--quiet")
    if staged.returncode == 0:
        print("nothing to commit (data + markdown unchanged)")
        return 0
    msg = f"chore(data): nightly kitchen snapshot {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    c = git("commit", "-m", msg)
    if c.returncode != 0:
        print("commit failed:", c.stderr, file=sys.stderr)
        return 1
    p = git("push")
    if p.returncode != 0:
        print("push failed:", p.stderr, file=sys.stderr)
        return 1
    print("committed + pushed:", msg)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="git add/commit/push after rendering")
    args = ap.parse_args()
    changed = render_all()
    print(f"rendered {len(TARGETS)} files; {len(changed)} changed: {', '.join(changed) or 'none'}")
    if args.commit:
        return git_commit_push()
    return 0


if __name__ == "__main__":
    sys.exit(main())
