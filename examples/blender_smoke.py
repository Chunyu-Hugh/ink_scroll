"""Headless 自检：blender -b -P examples/blender_smoke.py
建一个物体 → 用 blender_ink_spot.payload() 算坐标 → 真发一次 POST → 退出。"""
import sys, os, json, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import blender_ink_spot as ink

bpy.ops.mesh.primitive_cube_add(location=(3.0, 0.0, -2.0))
obj = bpy.context.object
data = ink.payload(obj.matrix_world.translation, name=obj.name[:18])
print("INK_PAYLOAD " + json.dumps(data))
print("INK_POST " + str(ink.send(data, url=os.environ.get("INK_URL", ink.URL))))
