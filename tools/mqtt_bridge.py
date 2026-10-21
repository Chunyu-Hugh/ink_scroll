#!/usr/bin/env python3
"""
MQTT → 墨卷 桥（可选，需要 paho-mqtt）

    pip install paho-mqtt
    MQTT_HOST=192.168.1.10 MQTT_TOPIC=studio/spot python3 tools/mqtt_bridge.py
    python3 server.py 8888 &

作用：把 MQTT 上的消息转成 server.py 的 HTTP 广播，页面订阅 room=ext 即可。
这样 Flic 按钮 / ESP32 / Home Assistant / Node-RED / 树莓派 都能直接驱动光圈。

支持的 payload（JSON 或纯数字）：
    {"x":0.4,"y":0.6,"r":1.2}            → 光位与半径
    {"x":0.4,"y":0.6,"z":0.3}            → 加深度（点云推轨）
    {"scene":2} / {"style":3}            → 换画 / 换风格
    {"presence":0.2}                     → 在场度（0=没人，1=满）
    {"cmd":"splat"} / {"cmd":"paint"}    → 泼墨 / 留痕
    "0.4,0.6"                            → 最简：逗号分隔的 x,y

⚠️ 诚实说明：本脚本**没有在真实 broker 上验证过**（这台机器装不了 mosquitto，
也没有 root）。逻辑很简单（订阅 → 转发），但首次使用请自己看一眼日志。
校验过的那条 MQTT 等价路径是 HTTP：`curl -X POST '/send?room=ext' -d '{...}'`。
"""
import json
import os
import sys
import urllib.request

try:
    import paho.mqtt.client as mqtt
except ImportError:
    sys.exit("需要 paho-mqtt：pip install paho-mqtt")

HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
PORT = int(os.environ.get("MQTT_PORT", "1883"))
TOPIC = os.environ.get("MQTT_TOPIC", "ink/spot")
RELAY = os.environ.get("INK_RELAY", "http://127.0.0.1:8888")
ROOM = os.environ.get("INK_ROOM", "ext")


def to_message(raw: bytes):
    """MQTT payload → 墨卷的 JSON 契约（尽量宽容）。"""
    text = raw.decode("utf-8", "ignore").strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
        if isinstance(obj, (int, float)):
            return {"x": float(obj)}
        if isinstance(obj, list) and len(obj) >= 2:
            return {"x": float(obj[0]), "y": float(obj[1]),
                    **({"r": float(obj[2])} if len(obj) > 2 else {})}
    except Exception:
        pass
    parts = [p for p in text.replace(";", ",").split(",") if p.strip()]
    try:
        vals = [float(p) for p in parts[:3]]
    except ValueError:
        return None
    if len(vals) >= 2:
        return {"x": vals[0], "y": vals[1], **({"r": vals[2]} if len(vals) > 2 else {})}
    if len(vals) == 1:
        return {"x": vals[0]}
    return None


def forward(msg: dict):
    body = json.dumps(msg).encode()
    req = urllib.request.Request(f"{RELAY}/send?room={ROOM}", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=1.5) as r:
            return r.status
    except Exception as e:
        return str(e)


def on_connect(c, _u, _f, rc):
    print(f"[mqtt] connected rc={rc} → subscribing {TOPIC}")
    c.subscribe(TOPIC)


def on_message(_c, _u, m):
    msg = to_message(m.payload)
    if not msg:
        print("[mqtt] skip:", m.payload[:40])
        return
    st = forward(msg)
    print(f"[mqtt] {m.topic} {msg} → {st}")


def main():
    c = mqtt.Client()
    if os.environ.get("MQTT_USER"):
        c.username_pw_set(os.environ["MQTT_USER"], os.environ.get("MQTT_PASS", ""))
    c.on_connect = on_connect
    c.on_message = on_message
    print(f"[mqtt] {HOST}:{PORT} topic={TOPIC} → {RELAY}/send?room={ROOM}")
    c.connect(HOST, PORT, 60)
    c.loop_forever()


if __name__ == "__main__":
    main()
