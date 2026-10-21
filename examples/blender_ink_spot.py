"""
墨卷 · Blender 适配器 —— 用 Blender 里的物体（或相机）驱动光圈。

两种用法：
  A. 零插件（推荐）：Blender ▸ Scripting ▸ 打开本文件 ▸ Run Script
     每帧把选中物体的世界坐标 POST 到 server.py，页面自动切到「外设桥」。
  B. 走 OSC：装 NodeOSC 插件（maybites/NodeOSC），OSC Out 指向
     udp://127.0.0.1:9000，地址用 /spot，两个 float = x,y（0..1）。
     这条路径不需要 Blender 里跑任何脚本。

自检（不需要 Blender）：
  python3 examples/blender_ink_spot.py --dry     # 打印会发送的 JSON
  python3 examples/blender_ink_spot.py --dry --post   # 顺便真的发一次
"""
import json
import sys

URL = "http://127.0.0.1:8888/send?room=ext"
STEP = 3            # 每 3 帧发一次，够顺滑也不刷屏
BOUND = 10.0        # 世界坐标 ±10 m 映射到画面 0..1


def payload(loc, name="blender", scene=None, style=None):
    """世界坐标 → 归一化坐标。x 反向是因为用户期待镜像手感。"""
    x = 0.5 - float(loc[0]) / (2 * BOUND)
    y = 0.5 + float(loc[2]) / (2 * BOUND)      # Blender 的 +Z 是"上"
    out = {"x": round(max(0.0, min(1.0, x)), 4),
           "y": round(max(0.0, min(1.0, y)), 4),
           "r": 1.0, "name": name}
    if scene is not None:
        out["scene"] = int(scene)
    if style is not None:
        out["style"] = int(style)
    return out


def send(data, url=URL):
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=0.5) as r:
            return r.status
    except Exception as e:                       # 页面没开 / 中继没跑
        return str(e)


# ── 自检路径：不需要 bpy ────────────────────────────────────────────────
if "--dry" in sys.argv:
    demo = payload((2.5, 0, -3.0), name="blender-demo")
    print(json.dumps(demo, ensure_ascii=False))
    if "--post" in sys.argv:
        import urllib.request
        print("post:", send(demo))
    sys.exit(0)

# ── Blender 内部路径 ────────────────────────────────────────────────────
import urllib.request
import bpy                                         # noqa: E402  (仅 Blender 里有)

_frame = {"n": 0}


def tick():
    _frame["n"] += 1
    obj = bpy.context.object
    if obj is None:
        return 1.0 / 30.0
    if _frame["n"] % STEP:
        return 1.0 / 30.0
    loc = obj.matrix_world.translation
    scene = bpy.context.scene
    send(payload(loc, name=obj.name[:18],
                 scene=scene.get("ink_scene"),
                 style=scene.get("ink_style")))
    return 1.0 / 30.0


bpy.app.timers.register(tick, first_interval=0.5)
print("[ink] Blender → 墨卷 已启动：移动选中物体即可驱动光圈")
