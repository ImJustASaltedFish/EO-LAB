#!/usr/bin/env python3
"""Serve the EO LAB site locally with correct JavaScript MIME types.

Usage (from the repository root):  python tools/serve.py [--port 8765]
Then open http://127.0.0.1:8765/ in a browser.
"""
import argparse
import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # Some Windows machines map .js to text/plain, which breaks ES modules.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        # Always revalidate, so edited files show up on the next reload.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", args.port), functools.partial(Handler, directory=str(ROOT))
    )
    print(f"Serving {ROOT} at http://127.0.0.1:{args.port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
