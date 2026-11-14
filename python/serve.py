#!/usr/bin/env python3
"""
IgnisHarmonize Local Development Server
NASA Space Apps Challenge: Harmonization of MODIS and VIIRS Hot Spots
"""

import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable cache during dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def main():
    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(workspace_dir)

    print("=" * 65)
    print("🔥 IGNIS HARMONIZE | Burning Activity Calendar")
    print("   NASA Space Apps Challenge: MODIS and VIIRS Harmonization")
    print("=" * 65)
    print(f"[*] Serving workspace at: {workspace_dir}")
    print(f"[*] Open in your browser: http://localhost:{PORT}")
    print("=" * 65)
    print("Press Ctrl+C to stop the server.\n")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server. Goodbye!")

if __name__ == '__main__':
    main()
