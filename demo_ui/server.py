"""Local viewer for saved core eval reports. Uses only Python's standard library."""
import argparse
import hashlib
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


UI_DIR = Path(__file__).resolve().parent
ROOT = UI_DIR.parent
REPORT_NAME = re.compile(r"eval_(?:before|after(?:_v[0-9]+)?)\.json\Z")
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def reports():
    """Discover only saved core reports; never expose arbitrary repository files."""
    found = []
    for path in ROOT.glob("eval_*.json"):
        if not REPORT_NAME.fullmatch(path.name):
            continue
        try:
            data = read_json(path)
            if not isinstance(data, dict) or not isinstance(data.get("cases"), list):
                continue
            if data.get("config", {}).get("dataset") != "core":
                continue
            version = re.search(r"_v([0-9]+)\.json$", path.name)
            number = int(version.group(1)) if version else 0
            label = (f"V{number}" if version else
                     "Trước cải tiến" if path.name == "eval_before.json" else "Bản nộp")
            found.append({
                "file": path.name, "label": label, "version": number,
                "summary": data.get("summary", {}), "config": data.get("config", {}),
                "digest": hashlib.sha256(path.read_bytes()).hexdigest(),
            })
        except (OSError, ValueError, TypeError, AttributeError):
            # A report may still be being written. Refresh after eval finishes.
            continue

    # Avoid showing the final report twice if eval_after.json is an exact copy.
    version_hashes = {r["digest"] for r in found if r["version"]}
    found = [r for r in found if not (
        r["file"] == "eval_after.json" and r["digest"] in version_hashes)]
    found.sort(key=lambda r: (r["version"], r["file"] == "eval_after.json"), reverse=True)
    for report in found:
        report.pop("digest", None)
    return found


class ViewerHandler(BaseHTTPRequestHandler):
    def send_data(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; "
                         "script-src 'self'; style-src 'self'; img-src 'self' data:; "
                         "connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, value):
        self.send_data(status, json.dumps(value, ensure_ascii=False).encode("utf-8"),
                       "application/json; charset=utf-8")

    def do_GET(self):
        request = urlsplit(self.path)
        try:
            if request.path in ASSETS:
                filename, content_type = ASSETS[request.path]
                self.send_data(200, (UI_DIR / filename).read_bytes(), content_type)
            elif request.path == "/api/health":
                self.send_json(200, {"app": "react-loop-lab-demo", "repo": ROOT.name})
            elif request.path == "/api/catalog":
                cases = read_json(ROOT / "evals" / "cases.json")
                available = reports()
                self.send_json(200, {
                    "cases": cases, "reports": available,
                    "default_report": available[0]["file"] if available else None,
                })
            elif request.path == "/api/report":
                filename = parse_qs(request.query).get("file", [""])[0]
                if filename not in {r["file"] for r in reports()}:
                    self.send_json(404, {"error": "Không tìm thấy file eval hợp lệ."})
                    return
                self.send_json(200, read_json(ROOT / filename))
            elif request.path == "/favicon.ico":
                self.send_data(204, b"", "image/x-icon")
            else:
                self.send_json(404, {"error": "Không tìm thấy nội dung."})
        except (OSError, ValueError, TypeError) as exc:
            self.log_error("Cannot read saved report: %s", type(exc).__name__)
            self.send_json(500, {"error": "Không đọc được dữ liệu. "
                                "Chờ eval ghi xong file rồi tải lại trang."})


def main():
    parser = argparse.ArgumentParser(description="Xem 22 case và trace đã lưu trên localhost")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port phải nằm trong khoảng 1–65535.")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), ViewerHandler)
    except OSError:
        parser.exit(1, "Cannot bind port. Try: python demo_ui/server.py --port 8001\n")
    # ASCII startup messages also work when Windows redirects output to a log.
    print(f"Open demo: http://localhost:{args.port}", flush=True)
    print("Saved eval viewer. No model/API calls. Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
