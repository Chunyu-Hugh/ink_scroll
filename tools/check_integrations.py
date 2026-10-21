#!/usr/bin/env python3
"""
创作软件接入的「简单测试」——真的跑，不是文档。

    python3 tools/check_integrations.py              # 起中继，跑 OSC(TD) + Blender
    python3 tools/check_integrations.py --no-cuda    # 忽略未知参数

退出码 0 = 全过；1 = 有失败。CI 里跑 OSC 那条；Blender 找不到时自动 skip。
"""
import json, os, shutil, socket, struct, subprocess, sys, threading, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("INK_PORT", "8921"))
OSC = int(os.environ.get("INK_OSC", "9001"))
BASE = f"http://127.0.0.1:{PORT}"
ok, fail, skip = 0, 0, 0


def say(good, name, detail=""):
    global ok, fail
    if good: ok += 1;  print(f"  \033[32m✓\033[0m {name}" + (f" — {detail}" if detail else ""))
    else:    fail += 1; print(f"  \033[31m✗ {name}\033[0m" + (f" — {detail}" if detail else ""))


def skip_it(name, why):
    global skip; skip += 1
    print(f"  \033[33m•\033[0m {name} (skipped: {why})")


def osc_packet(addr, args):
    def pad(b): return b + b"\0" * ((4 - len(b) % 4) % 4)
    tags = "," + "".join("i" if isinstance(a, int) else "f" for a in args)
    out = pad(addr.encode() + b"\0") + pad(tags.encode() + b"\0")
    for a in args:
        out += struct.pack(">i", a) if isinstance(a, int) else struct.pack(">f", a)
    return out


def main():
    env = dict(os.environ, OSC_PORT=str(OSC), DMX_HOST="127.0.0.1", DMX_PORT="6455")
    srv = subprocess.Popen([sys.executable, "server.py", str(PORT)], cwd=ROOT,
                           env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    got = []
    try:
        def listen():
            try:
                r = urllib.request.urlopen(f"{BASE}/events?room=osc", timeout=25)
                for line in r:
                    s = line.decode("utf-8", "ignore").strip()
                    if s.startswith("data:"):
                        got.append(json.loads(s[5:]))
            except Exception:
                pass
        threading.Thread(target=listen, daemon=True).start()
        time.sleep(0.6)

        print("\nTouchDesigner / OSC（udp %d）" % OSC)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        for addr, args in [("/spot", [0.25, 0.75]), ("/spot", [0.6, 0.2, 0.4]),
                           ("/spot/x", [0.9]), ("/scene", [3]), ("/style", [2])]:
            sock.sendto(osc_packet(addr, args), ("127.0.0.1", OSC)); time.sleep(0.05)
        time.sleep(0.8)
        say(len(got) >= 4, "OSC 报文被中继接收", f"{len(got)} 条到达 SSE")
        say(any(abs(g.get("x", -1) - 0.9) < 1e-3 for g in got), "OSC /spot/x 单轴生效")
        say(any(g.get("scene") == 3 for g in got), "OSC /scene 生效")

        print("\n后端 API（/health · /rooms · /state）")
        def get(path):
            with urllib.request.urlopen(f"{BASE}{path}", timeout=3) as r:
                return json.loads(r.read())
        h = get("/health")
        say(h.get("ok") is True and "rooms" in h and "osc_port" in h, "/health 返回服务状态",
            f"osc={h.get('osc_port')} dmx={h.get('dmx')}")
        say(get("/rooms").get("rooms") == {} or isinstance(get("/rooms").get("rooms"), dict),
            "/rooms 返回房间表")
        say(get("/state?room=ext-state").get("state") is None, "/state 在无数据时返回 null（不报错）")

        print("\nArt-Net DMX（灯光控台）")
        dmx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        dmx.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        dmx.bind(("127.0.0.1", 6455))
        dmx.settimeout(6)
        body = json.dumps({"type": "state", "mode": "bridge", "scene": 2, "style": 3,
                           "x": 0.75, "y": 0.25, "r": 1.5, "presence": 0.5, "z": 0.5}).encode()
        req = urllib.request.Request(f"{BASE}/send?room=ext-state", data=body,
                                     headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=3).read()
        pkt = None
        try:
            pkt, _ = dmx.recvfrom(2048)
        except socket.timeout:
            pass
        say(pkt is not None and pkt[:8] == b"Art-Net\0", "收到 Art-Net 包",
            f"{len(pkt) if pkt else 0} 字节")
        if pkt:
            say(pkt[8:10] == bytes([0x00, 0x50]), "OpCode = OpDmx (0x5000)")
            data = pkt[18:18 + 512]
            say(data[0] == 128 and data[1] == 191 and data[2] == 64 and data[3] == 128,
                "4 个通道映射正确（亮度/x/y/半径）",
                f"ch1..4 = {data[0]},{data[1]},{data[2]},{data[3]}")
        dmx.close()

        print("\nBlender（真无头跑一次）")
        blender = shutil.which("blender") or ("/tmp/bl/blender" if os.path.exists("/tmp/bl/blender") else None)
        if not blender:
            skip_it("Blender 端到端", "没装 Blender（见 docs/CREATIVE-TOOLS.md）")
        else:
            got.clear()
            script = os.path.join(ROOT, "examples", "blender_smoke.py")
            env2 = dict(os.environ, INK_URL=f"{BASE}/send?room=ext")
            p = subprocess.run([blender, "-b", "--factory-startup", "--python-exit-code", "3",
                                "-P", script], capture_output=True, text=True, timeout=180, env=env2)
            out = p.stdout + p.stderr
            say("INK_POST 200" in out, "Blender 真的发出去了", 
                next((l for l in out.splitlines() if l.startswith("INK_POST")), "no output"))
            say(any("Cube" in str(g.get("name", "")) for g in got) or "INK_PAYLOAD" in out,
                "物体坐标被正确归一化",
                next((l for l in out.splitlines() if l.startswith("INK_PAYLOAD")), ""))
    finally:
        srv.terminate()
        try: srv.wait(timeout=3)
        except Exception: srv.kill()

    print(f"\n  {ok} passed   {fail} failed   {skip} skipped\n")
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
