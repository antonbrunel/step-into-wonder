#!/usr/bin/env python3
"""Static server with cache disabled. ALWAYS use this (or equivalent) instead of
`python -m http.server`, which sends no cache headers: browsers will silently
re-serve stale assets when filenames are reused between versions.

Usage: python3 serve_nocache.py [port] [directory]
"""
import http.server
import socketserver
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else "."


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving {os.getcwd()} at http://localhost:{PORT} (cache disabled)")
        httpd.serve_forever()
