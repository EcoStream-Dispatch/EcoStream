"""
Render a quick preview PNG of a built model (for checking, not shipped).
    Blender --background --python models/blender/preview.py -- <model_id> <out.png> [explode 0..1] [az_deg] [el_deg] [dist]
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
model, out = argv[0], argv[1]
explode = float(argv[2]) if len(argv) > 2 else 0.0
az = math.radians(float(argv[3]) if len(argv) > 3 else 35)
el = math.radians(float(argv[4]) if len(argv) > 4 else 18)
dist = float(argv[5]) if len(argv) > 5 else None

root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(root, "models", "build", f"{model}.glb"))
meta = json.load(open(os.path.join(root, "models", "build", f"{model}.meta.json")))
for p in meta["parts"]:
    o = bpy.data.objects.get(p["id"])
    if o and p.get("distance"):
        d = Vector(p["explode"]) * p["distance"] * explode  # glTF (x, y, z) -> Blender (x, -z, y)
        o.location += Vector((d.x, -d.z, d.y)) if o.parent is None or o.parent.type == "EMPTY" else Vector((d.x, -d.z, d.y))

for name in filter(None, os.environ.get("HIDE", "").split(",")):  # e.g. HIDE=tyre
    if name in bpy.data.objects:
        bpy.data.objects[name].hide_render = True
objs = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center, size = (lo + hi) / 2, (hi - lo).length
d = dist or size * 1.35
if len(argv) > 8:  # optional focus point (Blender coords)
    center = Vector((float(argv[6]), float(argv[7]), float(argv[8])))
cam_loc = center + Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el))) * d
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.scene.collection.objects.link(cam)
cam.location = cam_loc
cam.rotation_euler = (center - cam_loc).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 50
bpy.context.scene.camera = cam
for (x, y, z, e) in [(4, -4, 6, 600), (-5, 3, 3, 250), (0, 6, 2, 150)]:
    L = bpy.data.objects.new("L", bpy.data.lights.new("L", "AREA"))
    L.data.energy = e * max(1.0, size) ** 2
    L.data.size = 3 * max(1.0, size)
    L.location = center + Vector((x, y, z)) * max(1.0, size) * 0.6
    L.rotation_euler = (center - L.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(L)
w = bpy.data.worlds.new("w")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.93, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
bpy.context.scene.world = w
s = bpy.context.scene
s.render.engine = "BLENDER_EEVEE"
s.render.resolution_x, s.render.resolution_y = 1000, 700
s.render.film_transparent = False
s.view_settings.view_transform = "AgX"
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
