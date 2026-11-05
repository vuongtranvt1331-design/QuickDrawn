"""Serve this folder (or the common Arcade Hub root) without external packages."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
import json
from urllib.parse import quote

parser = argparse.ArgumentParser(description='Quick Drawn localhost server')
parser.add_argument('--port', type=int, default=8000)
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent)
parser.add_argument('--no-browser', action='store_true')
args = parser.parse_args()
root = args.root.resolve()
if not root.is_dir():
    parser.error('Root folder does not exist')
class FreshGameHandler(SimpleHTTPRequestHandler):
    # Full responses prevent a browser from keeping an older index/JS/PNG combination.
    def send_head(self):
        for header in ('If-Modified-Since', 'If-None-Match'):
            if header in self.headers:
                del self.headers[header]
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?', 1)[0].endswith('/__quickdrawn_build__.json'):
            payload = json.dumps({'build': 'independent-sprites-v4', 'root': str(root)}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

try:
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(FreshGameHandler, directory=str(root)))
except OSError as error:
    parser.exit(1, f'Cannot start localhost:{args.port}: {error}\nClose the old server window and run run-local.bat again.\nOr choose another port with run-local.bat --port 8001 (separate IndexedDB origin).\n')
try:
    game_path = Path(__file__).resolve().parent.relative_to(root).as_posix()
    game_path = '' if game_path == '.' else quote(game_path) + '/'
except ValueError:
    game_path = ''
url = f'http://localhost:{server.server_port}/{game_path}'
print(f'Serving {root}\n{url}\nKeep this window open. Press Ctrl+C to stop.\n'
      'IndexedDB is shared only with Arcade Hub on the SAME protocol, host and port.', flush=True)
if not args.no_browser:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
