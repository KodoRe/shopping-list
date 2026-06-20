# Android APK + Google-Login Gate + Hebrew/RTL — Implementation Plan

> Branch: `feature/apk-auth-i18n` · Date: 2026-06-13
> Reviewer/architect: Neo · Status: **LOCKED** pending Nitai's final go
> Supersedes nothing; builds on `main` @ `f3cee29` (pantry-lifecycle shipped).

---

## Goal

Ship the Home Kitchen app to Nitai **and his wife** as a real, sideloadable
Android **`.apk`**, reaching the existing VM backend over the public internet,
**protected by Google sign-in restricted to their two email addresses**, with the
UI available in **English and Hebrew** (OS-default + manual toggle, full RTL).

## Problem statement (agreed)

The app works great for Nitai but is **tailnet-only** (Tailscale `…ts.net`, no public
route) and has **no authentication** — tailnet membership *is* the security model. To
share it with his wife as an installable Android app, three gaps must close:

1. **No installable-app surface.** No web manifest, service worker, or app icons —
   nothing for Android to install or for a TWA APK to wrap.
2. **No safe public route.** Reaching the VM backend from her phone means exposing it
   to the internet, which — with zero auth and a stdlib `http.server` — is unsafe as-is.
   Public exposure ⇒ authentication is **mandatory, not optional**.
3. **English-only, LTR-only.** Every visible string is hardcoded English; CSS has 17
   physical left/right properties and zero logical ones, so Hebrew/RTL needs real work.

## Decisions locked (from the design conversation)

- **Auth = oauth2-proxy in front (NOT Firebase).** Firebase is **parked**. We apply only
  what's necessary: a reverse-proxy doorman doing Google OIDC + a **2-email allowlist**,
  upstream-protecting the unchanged Python server. App code stays stdlib-pure.
- **"Identity separation" = attribution, not data siloing.** One shared list; every mutation
  stamped `added_by` / `checked_by` / `last_edited_by`. **Humans stamp by name** (`Nitai` / `Nat`,
  resolved from the gate-supplied email); **all agents collapse to one general `Agent` label**
  ("not us") — Neo, Jacopo, and Rosalind are deliberately NOT distinguished, by Nitai's request.
  No per-user data silos (that would break the shared-list use case).
- **APK = TWA (Trusted Web Activity) via Bubblewrap.** Thin signed shell around the PWA,
  built on the VM, sideloaded. Real Chrome engine ⇒ Google's cookie/redirect login works
  inside it. (Not Capacitor — overkill for two users; not bare PWA-only — Nitai wants a
  literal `.apk` file to hand her.)
- **Hebrew = both OS-default AND manual toggle.** `navigator.language` sets the default;
  a header EN/עב button overrides, persisted per-device in localStorage.
- **Reversible-first ordering.** Phases 1–2 are fully testable on the tailnet with **zero
  public exposure**. The public Funnel step (one-way-ish door) is gated behind auth being
  built and verified.

## Acceptance criteria

**Phase 1 — PWA foundation**
- [ ] `manifest.webmanifest` served with name, icons (192/512/maskable), `theme_color`,
      `display: standalone`, `start_url`, `scope`, `lang`, `dir`.
- [ ] Service worker registers and caches the app shell; app still loads with backend down.
- [ ] Real PNG icons exist (not the emoji favicon) at 192, 512, and maskable.
- [ ] Chrome on Android shows **"Add to Home Screen"** → installs as standalone (no URL bar).
- [ ] Lighthouse "Installable" check passes. JS passes `node --check`. Zero console errors.

**Phase 2 — i18n + RTL**
- [ ] Every visible string resolves through `t(key)` from an `en` / `he` table — no
      hardcoded user-facing English left in the rendered DOM.
- [ ] Phone set to Hebrew → app opens in Hebrew, RTL, with **zero taps**.
- [ ] Header **EN / עב** toggle flips language + direction live; choice persists across reload.
- [ ] `dir="rtl"` + `lang="he"` on `<html>` in Hebrew; layout correctly mirrored (the 17
      physical CSS properties converted to logical — nothing pinned to the wrong side).
- [ ] Nitai (native speaker) signs off on the Hebrew wording.

**Phase 3 — Auth gate (the public step)**
- [ ] Unauthenticated request to the public URL → redirected to Google sign-in.
- [ ] A Google account **NOT** on the 2-email allowlist → **access denied** (verified with a
      third throwaway account).
- [ ] An allowlisted account → reaches the app; session persists via secure cookie.
- [ ] The Python server **never** receives a request that didn't pass the proxy
      (binds `127.0.0.1` only; proxy is the sole public listener).
- [ ] Mutations stamp the actor: **Nitai** / **Nat** for human (gate) edits, **Agent** for all
      agent (loopback) edits — all three cases verified with real receipts.
- [ ] Verified end-to-end against the **real** public callback URL, not a localhost stand-in.

**Phase 4 — APK**
- [ ] Signed `.apk` builds on the VM via Bubblewrap.
- [ ] `/.well-known/assetlinks.json` served; APK's signing SHA-256 matches → TWA verifies
      (no browser address bar shown).
- [ ] APK installs on a real Android phone, opens straight to Google login, then the app.
- [ ] Keystore + passwords stored securely **off-repo**, backed up; recovery path documented.

## Non-goals (this round)

- **No Firebase** (parked) and **no per-user data silos** — shared list stays shared.
- **No Play Store** publishing ($25 account, review queue) — sideload only.
- **No Capacitor / native rewrite** — TWA shell is sufficient for two users.
- **No new app features** — this is delivery, auth, and i18n only; pantry/recipe logic frozen.
- **No migration off stdlib** for the app server — auth lives in the proxy, not the app.
- **No multi-language beyond EN/HE.** No translation of the generated markdown projections.
- **No kids-arcade** in this plan — Home Kitchen first; arcade can follow the same recipe.

## Architecture

```
  Her phone (APK / TWA)                    Your phone (APK / TWA or tailnet)
          │  HTTPS (Google-authenticated)            │
          ▼                                          ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Tailscale Funnel  (PUBLIC, port 443|8443|10000)         │   ← see RISK #1
  └───────────────────────────┬─────────────────────────────┘
                              ▼
  ┌─────────────────────────────────────────────────────────┐
  │  oauth2-proxy  (127.0.0.1:4180)                          │
  │  • Google OIDC  • 2-email allowlist  • secure cookie     │
  │  • injects X-Forwarded-Email upstream                    │
  └───────────────────────────┬─────────────────────────────┘
                              ▼ (localhost only)
  ┌─────────────────────────────────────────────────────────┐
  │  home-kitchen  server.py  (127.0.0.1:9210, UNCHANGED)    │
  │  • reads X-Forwarded-Email → stamps added_by/checked_by  │
  └─────────────────────────────────────────────────────────┘
```

**Key seam:** the app server never moves and never learns about OAuth. The proxy is a
bolt-on doorman; deleting it reverts us to tailnet-only. Attribution is the *only* app-code
change in Phase 3, and it degrades gracefully (header absent on tailnet → `added_by: null`).

**Defense in depth:** even if the proxy were bypassed, the app binds loopback only — the
public listener is exclusively the vetted-crypto proxy, never the stdlib server.

---

## Phase 1 — PWA Foundation (no exposure; ~1–2 hrs)

### Task 1.1 — Design + generate app icons
**Files:** Create `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`
- A simple branded mark (cart/basket on the terracotta brand color), generated on the VM
  (Pillow or rsvg). Maskable variant has ≥20% safe-zone padding.
- **Verify:** files exist, correct dimensions (`file`/`identify`), open as valid PNG.

### Task 1.2 — Write `manifest.webmanifest`
**Files:** Create `manifest.webmanifest`; Modify `index.html` `<head>` (link + theme).
- name, short_name "Home Kitchen", icons (3 entries), `theme_color`, `background_color`,
  `display: standalone`, `start_url: "/?source=pwa"`, `scope: "/"`, `lang: "en"`, `dir: "ltr"`.
- **Verify:** `node --check` n/a (JSON) → `python -m json.tool` parses; Chrome DevTools →
  Application → Manifest shows no errors.

### Task 1.3 — Service worker (app-shell cache)
**Files:** Create `sw.js`; Modify `index.html`/`app.js` to register it.
- Cache-first for the static shell (html/css/js/icons, versioned cache name keyed to the
  existing `v=16` bust); **network-only** for `/items`, `/pantry`, `/recipes` data calls
  (localStorage already owns offline data — SW must not shadow it). Skip-waiting + clients-claim.
- **Verify (headless):** load once online, kill backend, reload → shell renders; DevTools →
  Application → Service Workers shows activated; data calls bypass SW cache.

### Task 1.4 — Installability verification
- **Verify:** Lighthouse PWA "Installable" passes; real Android Chrome shows Add-to-Home-Screen;
  installed icon launches standalone (no address bar). Screenshot as receipt.

---

## Phase 2 — i18n + RTL (no exposure; ~0.5–1 day)

### Task 2.1 — Extract every visible string
**Files:** audit `index.html`, `app.js` for user-facing text.
- Produce a key list (e.g. `header.title`, `btn.add`, `pantry.expiresIn`, plurals…).
- **Verify:** grep shows no orphan hardcoded strings in rendered paths.

### Task 2.2 — Build `js/i18n.js`
**Files:** Create `js/i18n.js`.
- `STRINGS = { en: {...}, he: {...} }`; `t(key, vars)` with interpolation + simple
  pluralization (Hebrew has its own plural rules — handle 1 / 2 / many for day-counts).
- `detectLang()` = `localStorage.lang` ?? (`navigator.language` startsWith `he` ? `he` : `en`).
- `setLang(l)` writes localStorage, sets `<html lang dir>`, re-renders.
- **Verify (node):** `t('btn.add')` → "Add" / "הוסף"; pluralization unit-tested in `js/test-store.js` harness.

### Task 2.3 — Wire strings into render
**Files:** Modify `index.html` (static via `data-i18n`), `app.js` (dynamic via `t()`).
- **Verify:** DOM renders correct language; switching re-renders all of it.

### Task 2.4 — RTL CSS conversion
**Files:** Modify `style.css` — the **17** physical props → logical.
- `margin-left/right`→`margin-inline-start/end`; `left/right`→`inset-inline-start/end`;
  `text-align:left/right`→`start/end`; `border-left/right`→`border-inline-*`. Swipe-to-stock
  gesture direction reviewed under RTL (the stock reveal must still make sense mirrored).
- **Verify (headless, both dirs):** screenshot LTR vs RTL; nothing pinned wrong; swipe works.

### Task 2.5 — Header EN/עב toggle + Hebrew wording sign-off
**Files:** Modify `index.html` (button), `app.js` (handler), `js/i18n.js` (`he` strings).
- **Verify:** toggle flips live + persists; **Nitai reviews Hebrew copy**.

---

## Phase 3 — Auth Gate — THE PUBLIC STEP (⏸️ PARKED 2026-06-13)

> **PARKED by Nitai's decision (2026-06-13):** "No funnel for now." Going the **tailnet
> route** instead — Nat installs Tailscale once, the kitchen stays private, zero public
> exposure. This phase (oauth2-proxy + Google OAuth + Funnel) is **deferred, not cancelled** —
> revisit only if Nat later wants access **without** installing Tailscale. All sub-tasks below
> stay valid for that future; nothing here was started beyond the port spike (which found
> Funnel is not enabled tailnet-wide — see RISK #1).
>
> Original gate: do not start until Phases 1–2 are merged and Nitai explicitly green-lights going public.

### Task 3.1 — Resolve the Funnel port (RISK #1, below) — **build-time spike first**
- Decide/verify which of 443/8443/10000 carries this, or restructure. **Empirical**, not assumed.

### Task 3.2 — Google Cloud Console OAuth client
- Create OAuth 2.0 Client ID (Web); set authorized redirect URI to the **real** funnel
  callback (`https://<host>:<port>/oauth2/callback`). Client secret → VM env file, **not repo**.
- **Verify:** confirm Google accepts the `.ts.net` host/port (the fiddly bit I flagged).

### Task 3.3 — Install + configure oauth2-proxy
**Files:** Create `/etc/oauth2-proxy/oauth2-proxy.cfg` (or VM equivalent), systemd unit.
- provider=google; `--email-domain=*` + `--authenticated-emails-file` (the 2 addresses);
  upstream `http://127.0.0.1:9210`; cookie secret; `--set-xauthrequest`/`--pass-user-headers`.
- **Verify:** service active; `journalctl` clean; localhost curl through proxy → 302 to Google.

### Task 3.4 — Funnel the proxy public
- `tailscale funnel` the chosen port → `127.0.0.1:4180`.
- **Verify:** from off-tailnet (phone on cellular), URL → Google login.

### Task 3.5 — Allowlist enforcement test
- **Verify:** allowlisted email in; **third non-allowlisted account DENIED**; receipts for both.

### Task 3.6 — Attribution stamping (only app-code change this phase)

**Model (locked):** human-direct edits stamp the person (`Nitai` / `Nat`); **all agent edits
collapse to a single general `Agent` bucket** ("not us"). We do NOT distinguish Neo / Jacopo /
Rosalind — one label for all agent activity, by Nitai's request.

**The mechanism is free for on-VM agents:** a human edit arrives *through the gate* carrying
`X-Forwarded-Email`; an agent edit arrives on *loopback* (`127.0.0.1`) with **no** such header.
So **absence of the auth header IS the agent signal** — the old "degrades to `null`" case
becomes the `Agent` bucket, not an edge case. Neo + Jacopo (both on this VM → loopback) land in
`Agent` automatically, zero extra work.

**Files:** Modify `server.py` (resolve actor from headers in POST/PATCH), `js/store.js`,
`render_markdown.py` (surface `added_by` / `checked_by` / `last_edited_by`).

**Actor resolution:**
```python
EMAIL_TO_NAME = {            # the 2 allowlisted humans, lowercased
    "<nitai-email>": "Nitai",
    "<nat-email>":   "Nat",
}
def actor(headers):
    email = (headers.get("X-Forwarded-Email") or "").lower()
    if not email:
        return "Agent"                        # loopback / no gate = not-us
    return EMAIL_TO_NAME.get(email, "Agent")  # any other authed identity also buckets to Agent
```

**✅ Resolved — Rosalind buckets to `Agent` automatically.** Rosalind is **Nat's** agent but
runs as a **Hermes profile on this same VM** (like Neo and Jacopo). So all three agents edit
over **loopback** with **no `X-Forwarded-Email`** header → all land in `Agent` with zero config.
The earlier service-account-email contingency is **not needed**. (It only resurfaces if an agent
ever edits through the *public* gate instead of loopback — not the case for any current agent.)

- **Verify (real receipts, all three):** edit via public path as Nitai → `added_by: "Nitai"`;
  as Nat → `"Nat"`; edit via loopback (me, live) → `added_by: "Agent"`. 99 tests stay green +
  new stamping tests.

---

## Phase 4 — Signed APK via Bubblewrap (gated on Phase 3; ~0.5 day)

### Task 4.1 — Toolchain
- Install JDK + Android cmdline-tools + Bubblewrap CLI on the VM. **Verify:** `bubblewrap doctor`.

### Task 4.2 — Signing keystore
- Generate keystore; store password in VM secrets, **back it up off-VM**; document recovery.
- **Verify:** keystore exists; `keytool -list` shows the key; SHA-256 fingerprint captured.

### Task 4.3 — Digital Asset Links
**Files:** Create `.well-known/assetlinks.json` served by the app; ensure proxy passes it
**unauthenticated** (TWA verification must reach it pre-login).
- **Verify:** `curl https://<public>/.well-known/assetlinks.json` returns the SHA-256 (no auth wall).

### Task 4.4 — Build + sideload
- `bubblewrap init` from the manifest URL; `bubblewrap build` → signed APK.
- **Verify:** install on a real Android phone; opens to Google login → app; **no address bar**
  (proves asset-links verified); screenshot receipts. Then hand both phones the same APK.

---

## Risks, tradeoffs & open questions

1. **🔴 RISK #1 — Funnel port scarcity (load-bearing).** Tailscale Funnel works on **only**
   ports **443, 8443, 10000**. I verified **all three are already taken** by tailnet-only
   serves (443→agent-ops/9198, 8443→mission-control/9128, 10000→9200). Options to resolve
   at build time (Task 3.1), in preference order:
   (a) **Path-based Funnel on 443** (`--set-path /kitchen` → proxy) if it coexists with the
   existing tailnet serve on 443 — needs empirical confirmation Tailscale allows the mix;
   (b) **Repurpose 10000** for the public kitchen if `9200` can move/retire;
   (c) accept a dedicated Funnel port and relocate one existing service.
   **I will spike this first and not promise a specific resolution until proven.**

   **🔬 SPIKE RESULT (2026-06-13):** Before resolving *which* port, a harder gate surfaced:
   **Funnel is NOT enabled on this tailnet at all.** `tailscale funnel` hangs then reports
   *"Funnel is not enabled on your tailnet."* Per Tailscale docs, Funnel needs TWO things the
   CLI can't fully self-serve from the VM:
   1. **Tailnet feature-preview toggle** — admin console → Settings → Feature previews →
      enable **Funnel**. (Account-owner action in the web console; not doable via `sudo` on the VM.)
   2. **`funnel` nodeAttr** in the tailnet policy file targeting this node
      (`vm-agent-ops`). The CLI auto-adds this *once* the feature is enabled.
   Empirical granularity test (funnel a path on :10000, then revert) confirmed clean
   revert — `AllowFunnel` returned to `null`, no exposure left behind. But the per-port-vs-
   per-path question is **moot until Funnel is enabled tailnet-wide.**
   **➡️ NITAI ACTION REQUIRED (one-time):** enable Funnel in the admin console feature
   previews for tailnet `tail5ed1e6.ts.net`, then I can resume Task 3.1 and prove the port
   resolution empirically. **Alternatively, the tailnet route (RISK #4 standing alternative)
   needs none of this** — no Funnel, no public exposure, same APK.

2. **🟠 RISK #2 — Google accepting the `.ts.net` host/port** as an authorized redirect
   URI. Cert is real Let's Encrypt (good sign), but non-standard ports occasionally bite.
   Validated empirically in Task 3.2 before declaring Phase 3 done.

3. **🟠 RISK #3 — assetlinks fingerprint mismatch** → APK shows an address bar (TWA
   fails open as a normal browser tab). Mitigation: derive the SHA-256 from the *actual*
   signing keystore and verify the served file matches before building the final APK.

4. **🔴 The public exposure is the one near-irreversible commitment.** oauth2-proxy makes it
   *safe*, but once her phone + habits depend on a public URL, walking it back is disruptive.
   This is why Phases 1–2 are exposure-free and Phase 3 needs an explicit go.
   **Standing alternative (still on the table):** she joins the tailnet and gets the **same
   APK** — the APK and the network path are independent. Keeps everything private by
   construction; the only cost is installing Tailscale on her phone.

5. **🟡 Keystore custody.** Losing it means never updating the APK under the same identity.
   Backed up off-VM, documented.

6. **🟡 Plural/format edge cases in Hebrew** (day-counts, "expires in N days"). Handled in
   `t()` pluralization; Nitai verifies wording.

## Validation summary (receipts required at each gate)

- **P1:** Lighthouse installable + real-device Add-to-Home-Screen screenshot.
- **P2:** LTR/RTL screenshots, live toggle, OS-default in Hebrew, Nitai copy sign-off.
- **P3:** off-tailnet login flow; allowlisted-in / third-account-DENIED receipts; attribution persisted; 99+ tests green.
- **P4:** APK installs, no address bar, opens through login on a real phone.

## Suggested commit/PR shape

- **PR #5** = Phases 1–2 (PWA + i18n/RTL) → mergeable and useful on its own, zero exposure.
- **PR #6** = Phase 3 (auth) — reviewed carefully, the security-sensitive one.
- **PR #7** = Phase 4 (APK tooling + asset-links + docs).
- Each task: own commit, push, verify (per house rule). Live `data/*.json` churn never staged.

---

## Execution handoff

Plan is written to match the repo's `docs/plans/` convention. On Nitai's "go" I'll execute
**Phase 1 first** (cheapest, fully reversible, exposure-free), verifying each task with real
receipts before moving on. Phase 3 (public) will pause for an explicit second go.
