#!/usr/bin/env python3
"""
Local server for the vinyl-collection app.
Serves static files and proxies Discogs API calls to avoid CORS issues.

Usage:
    python3 server.py
    Then open http://localhost:8000 in your browser.
"""

import http.server
import json
import ssl
import urllib.request
import urllib.error
import sys

PORT = 8000

# Direct HTTPS opener — explicitly bypasses any system/env proxy
_ctx = ssl.create_default_context()
_opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({}),          # no proxy
    urllib.request.HTTPSHandler(context=_ctx),
)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/discogs/'):
            self._proxy_discogs()
        else:
            super().do_GET()

    def _proxy_discogs(self):
        # /api/discogs/database/search?q=...&token=... → https://api.discogs.com/database/search?q=...&token=...
        discogs_path = self.path[len('/api/discogs/'):]
        url = 'https://api.discogs.com/' + discogs_path
        req = urllib.request.Request(url, headers={
            'User-Agent': 'VinylCollectionApp/1.0',
        })
        try:
            with _opener.open(req, timeout=15) as resp:
                body = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            # Network error — return a proper JSON error so the frontend can display it
            err = json.dumps({'message': f'Proxy error: {e}'}).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(err)

    def log_message(self, fmt, *args):
        # Compact logging
        if args and str(args[0]).startswith('GET /api/discogs/'):
            sys.stderr.write(f'  [proxy] {args[0]}\n')
        elif args and '200' not in str(args[1] if len(args) > 1 else ''):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    print(f'Vinyl Collection — http://localhost:{PORT}')
    print('Ctrl+C pour arrêter.\n')
    http.server.HTTPServer(('', PORT), Handler).serve_forever()
