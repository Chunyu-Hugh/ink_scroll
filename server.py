#!/usr/bin/env python3
"""
墨卷 · Ink Scroll — 极简 SSE 中继 + 静态文件服务器
Ink Scroll — tiny SSE relay + static file server (stdlib only, no dependencies).

为什么需要它 / Why this exists
    手机魔杖（📱 手机 · 众光）让观众用**自己的手机**当光圈。手机把陀螺仪读数
    发到本进程，大屏用 EventSource 订阅同一个 room，一部手机 = 一个光圈。
    纯静态服务器做不到这一点（需要长连接 + 广播），所以补上这个 130 行的中继。

用法 / Usage
    cd ink_scroll && python3 server.py            # http://localhost:8888
    python3 server.py 9000                        # 换端口 / custom port

    摄像头与手机陀螺仪都要求 secure context（HTTPS 或 localhost）。
    在局域网演示时用 Tailscale / Caddy 反代本端口即可：
        tailscale serve --bg 8888

接口 / Endpoints
    GET  /events?room=<token>   → text/event-stream（大屏订阅）
    POST /send?room=<token>     → 广播一段 JSON 给该 room 的所有订阅者（手机发送）
    POST /osc                   → 同上，但专给本地脚本用（JSON）
    UDP  :9000                  → OSC（TouchDesigner / Max / Pure Data / python-osc）
    GET  /*                     → web/ 静态文件

OSC → 光圈 的约定（地址 → 字段）
    /spot   f,f[,f]   → x, y, radius   (0..1, 0..1, 0.02..3)
    /spot/x f         → x
    /spot/y f         → y
    /spot/r f         → radius
    /scene  i         → 0..4
    /style  i         → 0=墨线 1=素描 2=暗调 3=纸本
"""

import json
import os
import queue
import socket
import struct
import sys
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
MAX_BODY = 64 * 1024          # a phone never sends more than a few hundred bytes
HEARTBEAT = 15.0              # seconds; keeps proxies from closing idle SSE streams

_lock = threading.Lock()
_rooms: dict[str, set[queue.Queue]] = {}


def subscribe(room: str) -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _lock:
        _rooms.setdefault(room, set()).add(q)
    return q


def unsubscribe(room: str, q: queue.Queue) -> None:
    with _lock:
        subs = _rooms.get(room)
        if not subs:
            return
        subs.discard(q)
        if not subs:
            _rooms.pop(room, None)


def broadcast(room: str, payload: bytes) -> int:
    with _lock:
        subs = list(_rooms.get(room, ()))
    sent = 0
    for q in subs:
        try:
            q.put_nowait(payload)
            sent += 1
        except queue.Full:
            pass                       # slow consumer: drop rather than block the phone
    return sent


# ── OSC (UDP) ────────────────────────────────────────────────────────────
OSC_PORT = int(os.environ.get("OSC_PORT", "9000"))
OSC_ROOM = "osc"


def _osc_str(data, i):
    j = data.index(b"\x00", i)
    return data[i:j].decode("utf-8", "replace"), (j + 4) & ~3


def parse_osc(data):
    """Minimal OSC reader: enough for /spot, /scene, /style from any tool."""
    address, i = _osc_str(data, 0)
    tags, i = _osc_str(data, i)
    args = []
    for t in tags[1:]:
        if t == "f":
            args.append(struct.unpack(">f", data[i:i + 4])[0]); i += 4
        elif t == "i":
            args.append(struct.unpack(">i", data[i:i + 4])[0]); i += 4
        elif t in "TF":
            args.append(t == "T")
        elif t == "s":
            v, i = _osc_str(data, i); args.append(v)
    msg = {}
    if address.startswith("/spot"):
        tail = address[5:].lstrip("/")
        if tail in ("x", "y", "r") and args:
            msg[tail] = float(args[0])
        elif len(args) >= 2:
            msg["x"] = float(args[0]); msg["y"] = float(args[1])
            if len(args) >= 3:
                msg["r"] = float(args[2])
    elif address.rstrip("/") == "/scene" and args:
        msg["scene"] = int(args[0])
    elif address.rstrip("/") == "/style" and args:
        msg["style"] = int(args[0])
    return msg


def _osc_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", OSC_PORT))
    except OSError as e:
        print("  ! OSC port %d unavailable (%s) — OSC disabled" % (OSC_PORT, e))
        return
    print("  osc       udp/%d  → /spot  /scene  /style" % OSC_PORT)
    while True:
        try:
            data, _ = sock.recvfrom(65535)
            msg = parse_osc(data)
            if msg:
                broadcast(OSC_ROOM, b"data: " + json.dumps(msg).encode() + b"\n\n")
        except Exception:
            pass


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # ── quiet, informative logging ────────────────────────────────────────
    def log_message(self, fmt, *args):
        if self.path.startswith(("/events", "/send")):
            return                      # SSE reconnects would flood the console
        sys.stderr.write("  %s\n" % (fmt % args))

    def end_headers(self):
        # no cache for the app itself; the scenes may cache
        if self.path.endswith((".html", "/")) or "?" in self.path:
            self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    # ── GET ───────────────────────────────────────────────────────────────
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/events":
            return self.serve_events(parse_qs(u.query).get("room", [""])[0])
        return super().do_GET()

    # ── POST /send ────────────────────────────────────────────────────────
    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/osc":                     # local script / TouchDesigner bridge
            room = OSC_ROOM
        elif u.path != "/send":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        room = parse_qs(u.query).get("room", [""])[0] if u.path != "/osc" else OSC_ROOM
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n <= 0 or n > MAX_BODY:
            self.send_error(HTTPStatus.BAD_REQUEST, "bad body size")
            return
        body = self.rfile.read(n)
        try:
            json.loads(body)             # validate before fanning out
        except Exception:
            self.send_error(HTTPStatus.BAD_REQUEST, "invalid json")
            return
        count = broadcast(room, b"data: " + body.replace(b"\n", b" ") + b"\n\n")
        out = json.dumps({"ok": True, "delivered": count}).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(out)

    # ── SSE stream ────────────────────────────────────────────────────────
    def serve_events(self, room: str):
        if not room:
            self.send_error(HTTPStatus.BAD_REQUEST, "room required")
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")   # nginx: do not buffer
        self.end_headers()
        q = subscribe(room)
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    payload = q.get(timeout=HEARTBEAT)
                except queue.Empty:
                    payload = b": ping\n\n"          # heartbeat
                self.wfile.write(payload)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            unsubscribe(room, q)
            self.close_connection = True


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    if not os.path.isdir(ROOT):
        sys.exit("cannot find web/ next to server.py")
    ThreadingHTTPServer.allow_reuse_address = True
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    srv.daemon_threads = True
    print("\n  墨卷 · Ink Scroll")
    print("  display   http://localhost:%d" % port)
    print("  phone     http://<your-lan-ip>:%d/phone.html  (scan the QR on screen)" % port)
    print("  relay     /events  /send  /osc   (SSE, rooms)")
    threading.Thread(target=_osc_loop, daemon=True).start()
    print("  Ctrl-C to stop\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  bye")


if __name__ == "__main__":
    main()
