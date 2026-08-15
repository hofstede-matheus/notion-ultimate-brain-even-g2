---
name: simulator-debug
description: Run an Even Hub app in the desktop simulator and inspect it headlessly — screenshot the glasses display and the phone webview, read the JS console, and send touch input via the automation HTTP API. Use when the user asks to test, debug, or preview the app, asks what the glasses or webview currently show, reports a visual or interaction bug, or wants a change confirmed in the running app rather than just unit tests.
---

# Debugging in the Even Hub simulator

Drives `@evenrealities/evenhub-simulator` headlessly so you can *see* what the
app renders instead of inferring it. Official reference:
https://hub.evenrealities.com/docs/test/simulator

The simulator is a Rust/LVGL desktop app hosting your web app in a native
webview. It is **not** a hardware emulator: it re-implements the drawing logic
rather than running firmware. Use it for layout, copy, and event logic. Timing,
BLE, permissions, and background lifecycle are not reproduced.

**Screenshots are the point.** Always `Read` the PNGs you capture — the glasses
display is monochrome green on transparent, which is easy to get wrong in ways
type-checking and unit tests cannot catch.

Helper (stdlib only): `python3 .claude/skills/simulator-debug/scripts/simctl.py`
Every app-specific value is a flag; run `--help` for the full surface.

## Before launching

Work out these three things for the app at hand — they are not in this skill,
because they differ per app:

1. **Target URL.** Usually the dev server (Vite defaults to `:5173`). Start it
   first and confirm it answers.
2. **Env the app needs to reach a useful screen.** Many apps prompt for
   credentials or config on first run; most have a dev-only env escape hatch so
   the simulator boots straight into the real UI. Check `.env.example` and the
   config-loading path. Never print secret values.
3. **A ready marker** — a log line the app emits *after* its startup page
   container exists (see step 4). Grep the boot path for its first post-render
   log call.

Env changes require a dev-server restart; HMR will not pick them up.

## Steps

Reuse whatever is already up: `simctl.py ping` and a `curl` against the dev
server before starting anything. Only stop processes you started this session.

1. **Start the app's dev server** if it isn't running.

2. **Launch the simulator with the automation port.** A plain launch (including
   most projects' `sim` script) omits `--automation-port` and every command
   below then fails:

   ```bash
   python3 .claude/skills/simulator-debug/scripts/simctl.py up --url http://localhost:5173
   ```

   `up` reuses a live instance, prefers the workspace-pinned binary over a
   global one, blocks until `/api/ping` answers, and writes the simulator's own
   output to `/tmp/evenhub-sim.log`. Add `--debug` (`RUST_LOG=debug`) when a
   payload may be getting rejected.

3. **Read the simulator's own log before `/api/console`.** Malformed SDK
   payloads are reported on the simulator's stderr and appear *nowhere* in the
   webview console — a rejected container is simply a screen that never
   renders. A silent log here is the first real signal.

4. **Wait for ready — do not just sleep.** Input posted before the app has an
   active event container is **silently ignored** (no error, HTTP 200):

   ```bash
   python3 .claude/skills/simulator-debug/scripts/simctl.py wait --marker "<app's ready line>"
   ```

   `wait` aborts early on `[uncaught]`/`[unhandledrejection]`; pass repeatable
   `--fail "<substring>"` for app-specific boot-failure lines. Expect ~2–5s from
   launch to first render.

5. **Read the JS console** (exceptions, failed fetches, the app's own traces):

   ```bash
   simctl.py console                 # whole buffer
   simctl.py console --errors        # warn/error + [uncaught]/[unhandledrejection]/[fetch]
   simctl.py console --since 42      # exclusive: returns ids > 42
   simctl.py console --grep 'NAV|API'
   ```

   Track the highest `id` you have seen. `since_id` is parsed as **unsigned** —
   a negative value is an HTTP 400, not an "everything" sentinel. `clear` wipes
   the buffer, and startup lines are emitted once, so wait-for-ready **before**
   clearing.

6. **Screenshot both surfaces and `Read` them:**

   ```bash
   simctl.py shot                    # /tmp/glasses.png + /tmp/webview.png
   simctl.py shot --glasses --prefix after-
   ```

   Both are native captures and return in well under a second. Glasses is the
   raw 576×288 framebuffer; the glow flag is post-processing only and never
   appears in the PNG. The webview shot comes from the platform webview
   (WKWebView / WebKitGTK / WebView2) and is captured at device pixel ratio, so
   it is typically 2× the CSS size.

7. **Send input**, then shot + `Read` again:

   ```bash
   simctl.py input click
   ```

   Actions are exactly `up`, `down`, `click`, `double_click` — anything else is
   a 400. `up`/`down` move the list highlight; `double_click` is the standard
   back/exit gesture. Allow a beat for async work (a fetch on navigation) before
   screenshotting.

8. **Clean up** only what you started. There is no shutdown endpoint; `stop`
   kills the process `up` recorded:

   ```bash
   simctl.py stop
   ```

## Automation API reference

Base URL `http://127.0.0.1:<PORT>` (available since simulator 0.7.0).

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/ping` | plain-text `pong` |
| GET | `/api/screenshot/glasses` | 576×288 RGBA PNG of the LVGL framebuffer |
| GET | `/api/screenshot/webview` | native webview capture, PNG |
| GET | `/api/console` | `{ entries, total }`; `?since_id=N` is exclusive |
| DELETE | `/api/console` | clears the buffer |
| POST | `/api/input` | `{"action": "up\|down\|click\|double_click"}` → `{"ok": true}` |

Console entry shape:

```json
{ "id": 0, "level": "log|warn|error|info|debug|trace", "message": "...", "ts": 1712150400000 }
```

Non-console sources are prefixed in the message: `[uncaught]`,
`[unhandledrejection]`, `[fetch]` (non-ok response or network error). Note that
`console.log` arrives as level `log`, which is *not* one of the four levels the
`--errors` filter keeps.

## What the simulator enforces (and doesn't)

Recent versions moved toward firmware parity, so a payload that passed on an
older simulator can be rejected by a newer one. Check the installed version
(`evenhub-simulator --version`) against the changelog in the package README
before blaming the app.

Enforced: list item text ≤63 **UTF-8 bytes** and ≤20 items; text container
≤999 bytes; width/height caps on a single container; no scrollbar even when
containers exceed the screen; unknown property fields are an error;
`zOrderIndex` must be set on **all** containers or none, unique within the page
(partial or duplicate payloads are rejected); decoded image pixel dimensions are
capped.

Not reproduced: frame pacing and BLE timing; status events (device status and
user profiles are hardcoded); background/foreground lifecycle; hardware image
size limits; exact font rendering and greyscale; focused-item position in a
scrolling list; error-response handling for invalid input.

Inputs are limited to Up / Down / Click / Double Click — there is no ring,
gesture, or IMU input, and `imuData` is always null.

## Simulator is not hardware

Passing here does **not** mean it works on the G2. When a change touches
container payloads or the page lifecycle, say plainly that the simulator check
is not hardware confirmation, and ask the user to verify on a device. Two
classes of bug this misses in general:

- Payloads the simulator accepts and firmware rejects — an empty or degenerate
  list is the classic one; on hardware it can crash and tear down the webview.
- One-shot-per-session SDK calls (notably creating the startup page container).
  A duplicate call is tolerated here and is not on hardware.

**Equally: do not dismiss a wrong value as "just the simulator."** "Status
events are not emitted" is a real limitation and also a convenient excuse — a
wrong connection state has turned out to be an actual event-subscription bug
rather than a simulator artifact. Investigate first; conclude "simulator
artifact" only with evidence.

## Notes

- Glasses PNGs are **RGBA** with a transparent background. Background and text
  are both pure green, so collapsing to RGB fuses them. Lit-pixel test:
  `alpha > 0` (background `(0,255,0,0)`, text `(0,255,0,255)`).
- Vite HMR reaches the simulator's webview; small edits usually need no
  restart. Restart after build-config or boot-path changes.
- The automation port is whatever you pass; `9898` is the docs' example and
  this helper's default (override with `--port` or `EVENHUB_SIM_PORT`).
- Clicking the simulator window exports a screenshot to the **current working
  directory** and logs the path as a warning — unrelated to the API endpoints.
- Headless runs do not replace beta testing. See
  https://hub.evenrealities.com/docs/test
