#!/usr/bin/env python3
"""Run the EO LAB browser tests in headless Edge/Chrome and print the results.

Usage (from the repository root):
    python tools/run_tests.py                     # every test
    python tools/run_tests.py --filter pinhole    # tests whose name contains "pinhole"

Exit code 0 when the page reports failed=0.
"""
import argparse
import functools
import html
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from serve import ROOT, Handler  # noqa: E402

BROWSERS = [
    os.environ.get("EOLAB_BROWSER"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    shutil.which("msedge"),
    shutil.which("google-chrome"),
    shutil.which("chromium"),
]


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


def find_browser():
    for candidate in BROWSERS:
        if candidate and Path(candidate).exists():
            return candidate
    sys.exit("No Edge or Chrome found; set EOLAB_BROWSER to the browser executable.")


def main():
    # Test names contain −, µ and Chinese; Windows consoles default to cp1252.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--filter", default="")
    parser.add_argument("--page", default="tests/index.html")
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/{args.page}"
    if args.filter:
        url += "?filter=" + urllib.parse.quote(args.filter)

    profile = tempfile.mkdtemp(prefix="eolab-tests-")
    command = [
        find_browser(),
        "--headless=new",
        "--disable-gpu",
        "--enable-unsafe-swiftshader",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        f"--user-data-dir={profile}",
        "--virtual-time-budget=120000",
        "--dump-dom",
        url,
    ]
    try:
        proc = subprocess.run(
            command, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=args.timeout,
        )
    finally:
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    match = re.search(r'<pre id="results"[^>]*>(.*?)</pre>', proc.stdout, re.S)
    text = html.unescape(match.group(1)).strip() if match else ""
    print(text or "(no results block in the page output)")
    summary = re.search(r"SUMMARY passed=(\d+) failed=(\d+)", text)
    if not summary:
        print("FAIL: the test page did not finish (no SUMMARY line)")
        return 1
    return 0 if summary.group(2) == "0" else 1


if __name__ == "__main__":
    sys.exit(main())
