#!/usr/bin/env python3
"""
IgnisHarmonize Local Development Server & NASA FIRMS API Proxy
NASA Space Apps Challenge: Harmonization of MODIS and VIIRS Hot Spots
"""

import http.server
import socketserver
import os
import sys
import urllib.request
import urllib.parse

PORT = 8080
NASA_MAP_KEY = os.environ.get("FIRMS_MAP_KEY", "d3482fbea45aa613a24989c27e983048")

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable cache during dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Check if this is an API proxy call to NASA FIRMS
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == '/api/firms':
            self.handle_firms_proxy(parsed_url.query)
        else:
            super().do_GET()

    def handle_firms_proxy(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        source = params.get('source', ['VIIRS_SNPP_NRT'])[0]
        bbox = params.get('bbox', ['-124.5,32.5,-114.0,42.0'])[0]
        day_range = params.get('dayRange', ['1'])[0]
        map_key = params.get('mapKey', [NASA_MAP_KEY])[0]

        target_url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{bbox}/{day_range}"

        try:
            req = urllib.request.Request(
                target_url,
                headers={'User-Agent': 'Mozilla/5.0 (NASA SpaceApps IgnisHarmonize Client)'}
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                content = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.end_headers()
                self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            err_json = f'{{"error": "Failed to proxy to NASA FIRMS: {str(e)}"}}'
            self.wfile.write(err_json.encode('utf-8'))

def main():
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(workspace_dir)

    print("=" * 68)
    print("🔥 IGNIS HARMONIZE | Burning Activity Calendar")
    print("   NASA Space Apps Challenge: MODIS and VIIRS Harmonization")
    print("=" * 68)
    print(f"[*] Workspace Root: {workspace_dir}")
    print(f"[*] Local Web App:  http://localhost:{PORT}")
    print(f"[*] NASA FIRMS Key: {NASA_MAP_KEY[:6]}...{NASA_MAP_KEY[-4:]} [ACTIVE]")
    print(f"[*] API Proxy:      http://localhost:{PORT}/api/firms")
    print("=" * 68)
    print("Press Ctrl+C to stop the server.\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server. Goodbye!")

if __name__ == '__main__':
    main()
