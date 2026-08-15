#!/usr/bin/env python3
"""Headless control for the Even Hub simulator's automation HTTP API.

App-agnostic: every app-specific value (target URL, ready marker, failure
lines) is a flag, so this drives any Even Hub app. Stdlib only.

  simctl.py up --url http://localhost:5173   # launch WITH --automation-port
  simctl.py wait --marker "app ready"        # block until the app has rendered
  simctl.py shot                             # /tmp/glasses.png + /tmp/webview.png
  simctl.py input click
  simctl.py console --since 42 --errors
  simctl.py stop                             # only kills what `up` started
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_PORT = int(os.environ.get("EVENHUB_SIM_PORT", "9898"))
PIDFILE = Path("/tmp/evenhub-sim.pid")
DEFAULT_LOG = Path("/tmp/evenhub-sim.log")

# Generic runtime-failure signals the automation API prefixes onto non-console
# sources. Not app-specific — every Even Hub app reports crashes this way.
CRASH_PREFIXES = ("[uncaught]", "[unhandledrejection]")
ERROR_PREFIXES = CRASH_PREFIXES + ("[fetch]",)


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def base(args: argparse.Namespace) -> str:
    return f"http://127.0.0.1:{args.port}"


def request(
    args: argparse.Namespace,
    path: str,
    method: str = "GET",
    body: dict | None = None,
    timeout: float = 20,
    quiet: bool = False,
):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"{base(args)}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read(), resp.headers.get_content_type()
    except urllib.error.HTTPError as exc:
        if quiet:
            raise
        # The simulator returns a plain-text reason on 400 — surface it, it
        # names the valid values.
        die(f"{method} {path} -> HTTP {exc.code}: {exc.read().decode(errors='replace')[:300]}")
    except urllib.error.URLError as exc:
        if quiet:
            raise
        die(
            f"automation API unreachable at {base(args)} ({exc.reason}).\n"
            f"The simulator must be started with --automation-port {args.port}; "
            f"a plain launch does not expose it. Try: simctl.py up --url <dev-server-url>"
        )


def get_json(args: argparse.Namespace, path: str, **kw):
    raw, _ = request(args, path, **kw)
    if raw.strip() == b"pong":
        return "pong"
    return json.loads(raw)


def alive(args: argparse.Namespace) -> bool:
    try:
        request(args, "/api/ping", timeout=2, quiet=True)
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------
# lifecycle
# --------------------------------------------------------------------------


def resolve_binary() -> list[str]:
    """Prefer a workspace-local install so the pinned version is what runs."""
    for parent in [Path.cwd(), *Path.cwd().parents]:
        candidate = parent / "node_modules" / ".bin" / "evenhub-simulator"
        if candidate.is_file():
            return [str(candidate)]
    found = shutil.which("evenhub-simulator")
    if found:
        return [found]
    return ["npx", "--yes", "evenhub-simulator"]


def cmd_up(args: argparse.Namespace) -> None:
    if alive(args):
        print(f"already running on port {args.port}")
        return

    log = Path(args.log)
    env = dict(os.environ)
    if args.debug:
        # Malformed SDK payloads are only explained on the simulator's own
        # stderr, never in /api/console.
        env["RUST_LOG"] = env.get("RUST_LOG", "debug")

    cmd = [*resolve_binary(), args.url, "--automation-port", str(args.port)]
    with log.open("wb") as sink:
        proc = subprocess.Popen(
            cmd, stdout=sink, stderr=subprocess.STDOUT, env=env, start_new_session=True
        )
    PIDFILE.write_text(str(proc.pid))

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            die(f"simulator exited (code {proc.returncode}) — see {log}")
        if alive(args):
            print(f"simulator up on port {args.port} (pid {proc.pid}, log {log})")
            return
        time.sleep(0.25)
    die(f"simulator did not answer /api/ping within {args.timeout}s — see {log}")


def cmd_stop(args: argparse.Namespace) -> None:
    if not PIDFILE.exists():
        print("no pidfile; nothing started by simctl to stop", file=sys.stderr)
        return
    pid = int(PIDFILE.read_text().strip())
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
        print(f"stopped pid {pid}")
    except ProcessLookupError:
        print(f"pid {pid} already gone")
    PIDFILE.unlink(missing_ok=True)


def cmd_ping(args: argparse.Namespace) -> None:
    result = get_json(args, "/api/ping", timeout=5)
    print(result if isinstance(result, str) else json.dumps(result))


# --------------------------------------------------------------------------
# console
# --------------------------------------------------------------------------


def console_path(since_id: int | None) -> str:
    if since_id is None:
        return "/api/console"
    if since_id < 0:
        # since_id is parsed as unsigned; a negative value is a 400, not an
        # "everything" sentinel.
        die("since_id must be >= 0 (omit the flag to read the whole buffer)")
    return f"/api/console?since_id={since_id}"


def print_entries(entries: list) -> int:
    last_id = 0
    for entry in entries:
        last_id = max(last_id, int(entry.get("id", 0)))
        level = str(entry.get("level", "?"))
        message = str(entry.get("message", "")).replace("\n", "\\n")
        print(f"{entry.get('id', '?'):>4}  {level:<5}  {message}")
    return last_id


def cmd_console(args: argparse.Namespace) -> None:
    data = get_json(args, console_path(args.since))
    entries = data.get("entries", [])
    if args.errors:
        entries = [
            e
            for e in entries
            if e.get("level") in {"error", "warn"}
            or str(e.get("message", "")).startswith(ERROR_PREFIXES)
        ]
    if args.grep:
        pattern = re.compile(args.grep)
        entries = [e for e in entries if pattern.search(str(e.get("message", "")))]
    last_id = print_entries(entries)
    print(f"# total={data.get('total', len(entries))} last_id={last_id}", file=sys.stderr)


def cmd_wait(args: argparse.Namespace) -> None:
    """Block until `marker` appears. Input sent before the app has created its
    startup page container is silently dropped, so callers need a real signal
    rather than a sleep."""
    deadline = time.time() + args.timeout
    since_id: int | None = None
    while time.time() < deadline:
        data = get_json(args, console_path(since_id))
        for entry in data.get("entries", []):
            since_id = max(since_id or 0, int(entry.get("id", 0)))
            message = str(entry.get("message", ""))
            if args.marker in message:
                print(f"ready: {message}")
                return
            if message.startswith(CRASH_PREFIXES):
                die(f"app crashed while booting: {message}")
            if any(f in message for f in args.fail):
                die(f"boot failed: {message}")
        time.sleep(0.25)
    die(
        f"timed out after {args.timeout}s waiting for {args.marker!r}.\n"
        f"Check `simctl.py console --errors` and the simulator's own stderr log."
    )


def cmd_clear(args: argparse.Namespace) -> None:
    request(args, "/api/console", method="DELETE")
    print("cleared")


# --------------------------------------------------------------------------
# capture + input
# --------------------------------------------------------------------------


def cmd_shot(args: argparse.Namespace) -> None:
    out = Path(args.dir)
    out.mkdir(parents=True, exist_ok=True)
    both = args.glasses == args.webview  # neither flag, or both flags
    targets = []
    if both or args.glasses:
        targets.append(("/api/screenshot/glasses", out / f"{args.prefix}glasses.png"))
    if both or args.webview:
        targets.append(("/api/screenshot/webview", out / f"{args.prefix}webview.png"))

    for path, dest in targets:
        raw, _ = request(args, path, timeout=20)
        dest.write_bytes(raw)
        print(dest)


def cmd_input(args: argparse.Namespace) -> None:
    raw, _ = request(args, "/api/input", method="POST", body={"action": args.action})
    if not raw:
        print("ok")
        return
    try:
        print(json.loads(raw))
    except json.JSONDecodeError:
        print(raw.decode(errors="replace"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"automation port (default {DEFAULT_PORT})")
    sub = parser.add_subparsers(dest="cmd", required=True)

    up = sub.add_parser("up", help="launch the simulator with --automation-port and wait for /api/ping")
    up.add_argument("--url", required=True, help="target URL to load (dev server or packaged app)")
    up.add_argument("--log", default=str(DEFAULT_LOG), help=f"simulator stdout/stderr (default {DEFAULT_LOG})")
    up.add_argument("--timeout", type=float, default=45)
    up.add_argument("--debug", action="store_true", help="RUST_LOG=debug — logs rejected SDK payloads")

    sub.add_parser("stop", help="SIGTERM the simulator started by `up`")
    sub.add_parser("ping", help="GET /api/ping")

    wait = sub.add_parser("wait", help="poll the console until a marker line appears")
    wait.add_argument("--marker", required=True, help="substring your app logs once it has rendered")
    wait.add_argument("--fail", action="append", default=[], help="substring that means boot failed (repeatable)")
    wait.add_argument("--timeout", type=float, default=45)

    console = sub.add_parser("console", help="GET /api/console")
    console.add_argument("--since", type=int, default=None, help="since_id, exclusive; must be >= 0")
    console.add_argument("--errors", action="store_true", help="warn/error plus [uncaught]/[unhandledrejection]/[fetch]")
    console.add_argument("--grep", help="regex filter on the message")

    shot = sub.add_parser("shot", help="write glasses.png and/or webview.png")
    shot.add_argument("--glasses", action="store_true")
    shot.add_argument("--webview", action="store_true")
    shot.add_argument("--dir", default="/tmp")
    shot.add_argument("--prefix", default="", help="filename prefix, e.g. 'after-' for before/after pairs")

    inp = sub.add_parser("input", help="POST /api/input")
    inp.add_argument("action", choices=["up", "down", "click", "double_click"])

    sub.add_parser("clear", help="DELETE /api/console (read startup lines first)")

    args = parser.parse_args()
    {
        "up": cmd_up,
        "stop": cmd_stop,
        "ping": cmd_ping,
        "wait": cmd_wait,
        "console": cmd_console,
        "shot": cmd_shot,
        "input": cmd_input,
        "clear": cmd_clear,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
