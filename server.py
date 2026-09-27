#!/usr/bin/env python3
"""
AI Smart Grocery Assistant — local backend

Uses only the Python standard library, so there is nothing to install.

It does two jobs:
  1. Serves the web/ folder as a normal static site.
  2. Proxies /api/chat to OpenRouter, so the API key stays on this machine
     and the browser never has to deal with CORS.

Run it with:  python server.py       (or just double-click launch.bat)
"""

import http.server
import json
import os
import socket
import socketserver
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

# Windows consoles often default to cp1252, which cannot print box characters.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")

DEFAULT_API_KEY = ""
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

PREFERRED_PORT = 8765
SITE_TITLE = "AI Smart Grocery Assistant"


def resolve_api_key() -> str:
    """Environment variable wins, then api_key.txt, then the built-in key."""
    env = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if env:
        return env
    key_file = os.path.join(BASE_DIR, "api_key.txt")
    if os.path.exists(key_file):
        try:
            with open(key_file, "r", encoding="utf-8") as fh:
                found = fh.read().strip()
            if found:
                return found
        except OSError:
            pass
    return DEFAULT_API_KEY


API_KEY = resolve_api_key()


def find_free_port(start: int) -> int:
    for port in range(start, start + 40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("No free port found between %d and %d" % (start, start + 40))


# --------------------------------------------------------------------------
# Request handler
# --------------------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "SmartGrocery/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    # Quieter console: skip the routine 200s for static assets
    def log_message(self, fmt, *args):
        msg = fmt % args
        if " 200 " in msg and "/api/" not in msg:
            return
        sys.stderr.write("  %s\n" % msg)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    # ---------------------------------------------------------------- GET
    def do_GET(self):
        if self.path.startswith("/api/health"):
            self._send_json({
                "ok": True,
                "hasKey": bool(API_KEY),
                "keyPreview": (API_KEY[:12] + "..." + API_KEY[-4:]) if API_KEY else None,
                "time": time.time(),
                "python": sys.version.split()[0],
            })
            return
        if self.path.startswith("/api/"):
            self._send_json({"error": "Unknown endpoint"}, status=404)
            return
        if self.path == "/favicon.ico":
            # The page supplies an inline SVG icon; answer the legacy request quietly.
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        super().do_GET()

    # --------------------------------------------------------------- POST
    def do_POST(self):
        if not self.path.startswith("/api/chat"):
            self._send_json({"error": "Unknown endpoint"}, status=404)
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            self._send_json({"error": "Bad request body: %s" % exc}, status=400)
            return

        if not API_KEY:
            self._send_json({"error": "No OpenRouter API key configured on the server."}, status=500)
            return

        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            OPENROUTER_URL,
            data=body,
            method="POST",
            headers={
                "Authorization": "Bearer %s" % API_KEY,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost",
                "X-Title": SITE_TITLE,
            },
        )

        streaming = bool(payload.get("stream"))
        model = payload.get("model", "?")
        sys.stderr.write("  → %s %s\n" % (model, "(stream)" if streaming else ""))

        try:
            with urllib.request.urlopen(req, timeout=180) as upstream:
                if streaming:
                    # The browser reads this response until the socket closes,
                    # so the connection must not be reused.
                    self.close_connection = True
                    self.send_response(200)
                    self.send_header("Content-Type", "text/event-stream")
                    self.send_header("Cache-Control", "no-cache")
                    self.send_header("Connection", "close")
                    self.send_header("X-Accel-Buffering", "no")
                    self.end_headers()
                    # Server-sent events are line based. Reading a line at a
                    # time forwards each token as soon as it arrives, instead
                    # of waiting for a fixed-size block to fill up.
                    #
                    # OpenRouter keeps the upstream socket open after the final
                    # "data: [DONE]" frame, so waiting for EOF would hang. Stop
                    # as soon as that sentinel has been forwarded.
                    while True:
                        line = upstream.readline()
                        if not line:
                            break
                        try:
                            self.wfile.write(line)
                            self.wfile.flush()
                        except (BrokenPipeError, ConnectionAbortedError):
                            return  # browser navigated away mid-stream
                        if line.strip() == b"data: [DONE]":
                            break
                else:
                    data = upstream.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)

        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:900]
            sys.stderr.write("  ! OpenRouter %s: %s\n" % (exc.code, detail[:200]))
            self._send_json({"error": "OpenRouter returned %s" % exc.code, "detail": detail},
                            status=exc.code if 400 <= exc.code < 600 else 502)
        except urllib.error.URLError as exc:
            sys.stderr.write("  ! Network error: %s\n" % exc.reason)
            self._send_json({"error": "Could not reach OpenRouter", "detail": str(exc.reason)}, status=503)
        except Exception as exc:                                    # noqa: BLE001
            sys.stderr.write("  ! %s\n" % exc)
            self._send_json({"error": "Proxy failure", "detail": str(exc)}, status=500)

    # ------------------------------------------------------------ helpers
    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionAbortedError):
            pass


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
def main():
    if not os.path.isdir(WEB_DIR):
        print("ERROR: the web/ folder is missing next to server.py")
        input("Press Enter to close...")
        return 1

    port = find_free_port(PREFERRED_PORT)
    url = "http://localhost:%d/" % port

    print("=" * 62)
    print("   AI SMART GROCERY ASSISTANT")
    print("=" * 62)
    print("  Serving : %s" % WEB_DIR)
    print("  URL     : %s" % url)
    print("  API key : %s" % (("configured (" + API_KEY[:12] + "...)") if API_KEY else "MISSING"))
    print("  Python  : %s" % sys.version.split()[0])
    print("-" * 62)
    print("  The app should open in your browser automatically.")
    print("  Keep this window open while you use it.")
    print("  Press Ctrl+C (or just close this window) to stop.")
    print("=" * 62)

    server = ThreadedServer(("127.0.0.1", port), Handler)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down. Goodbye!")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
