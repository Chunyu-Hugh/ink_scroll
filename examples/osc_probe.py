#!/usr/bin/env python3
"""
假 TouchDesigner：按 OSC Out CHOP 的真实报文形状打一遍，验证墨卷那侧收得住。

    python3 server.py 8895 &
    python3 examples/osc_probe.py 8895 9000

TD 的 OSC Out CHOP 每条样本发一个 **独立 UDP 报文**（不是 bundle），
address = CHOP 名字，参数是 float32。下面把这些形状逐条打进去：
  /spot f f        → x, y
  /spot f f f      → x, y, r
  /spot/x f        → 只动 x（单推子）
  /scene i         → 换画
  /style i         → 换风格
再补两个坏包（空包 / 乱码），服务端不能崩。
"""
import json, socket, struct, sys, threading, time, urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8895
OSC = int(sys.argv[2]) if len(sys.argv) > 2 else 9000
got = []


def osc(addr, args):
    def pad(b):
        return b + b"\0" * ((4 - len(b) % 4) % 4)
    tags = "," + "".join("i" if isinstance(a, int) else "f" for a in args)
    out = pad(addr.encode() + b"\0") + pad(tags.encode() + b"\0")
    for a in args:
        out += struct.pack(">i", a) if isinstance(a, int) else struct.pack(">f", a)
    return out


def listen():
    try:
        r = urllib.request.urlopen(f"http://127.0.0.1:{PORT}/events?room=osc", timeout=12)
        for line in r:
            s = line.decode("utf-8", "ignore").strip()
            if s.startswith("data:"):
                got.append(json.loads(s[5:]))
    except Exception:
        pass


threading.Thread(target=listen, daemon=True).start()
time.sleep(0.6)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
cases = [
    ("/spot", [0.25, 0.75], {"x": 0.25, "y": 0.75}),
    ("/spot", [0.6, 0.2, 1.6], {"x": 0.6, "y": 0.2, "r": 1.6}),
    ("/spot/x", [0.9], {"x": 0.9}),
    ("/spot/y", [0.1], {"y": 0.1}),
    ("/spot/r", [0.4], {"r": 0.4}),
    ("/scene", [3], {"scene": 3}),
    ("/style", [2], {"style": 2}),
]
for addr, args, want in cases:
    s.sendto(osc(addr, args), ("127.0.0.1", OSC))
    time.sleep(0.06)
# burst: TD at 60 fps
for i in range(120):
    s.sendto(osc("/spot", [i / 120, 0.5]), ("127.0.0.1", OSC))
# garbage
s.sendto(b"", ("127.0.0.1", OSC))
s.sendto(b"\xff\xfe\x00\x01not-osc", ("127.0.0.1", OSC))
time.sleep(1.4)

ok = 0
for addr, args, want in cases:
    hit = [g for g in got if all(abs(g.get(k, -9) - v) < 1e-3 if isinstance(v, float) else g.get(k) == v
                                  for k, v in want.items())]
    ok += 1 if hit else 0
    print(("  ✓ " if hit else "  ✗ ") + f"{addr} {args} → {want}")
print(f"\n  {ok}/{len(cases)} 形状正确 · 收到 {len(got)} 条（含 120 条 60fps 突发）")
print("  ✓ 坏包没有让服务端崩掉" if len(got) >= len(cases) else "  ✗ 服务端可能挂了")
sys.exit(0 if ok == len(cases) else 1)
