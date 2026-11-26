"""
Shared helpers for the EcoStream Blender model scripts.

Run any model script headless, from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python models/blender/wheel.py

Conventions
- Real-world scale in metres. Blender is Z-up; the glTF exporter converts to Y-up
  (Blender X -> glTF X, Blender Z -> glTF Y, Blender Y -> glTF -Z).
- Every part is one object named by its part id, with its origin at its pivot.
- Part metadata goes into models/build/<model>.meta.json (and into glTF extras).
- Patent rule: our own hardware (TPMS sensor, in-cab unit) is only ever a sealed generic
  shell. No internals, never exploded on its own.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BUILD = os.path.join(ROOT, "models", "build")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def material(name, color, metallic=0.0, roughness=0.5, emissive=None, emissive_strength=0.0, alpha=1.0, clearcoat=0.0, transmission=0.0, ior=1.5):
    """Principled BSDF material (exports as glTF PBR metallic-roughness)."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    r, g, b = hex_to_linear(color)
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if clearcoat:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
        bsdf.inputs["Coat Roughness"].default_value = 0.1
    if emissive:
        er, eg, eb = hex_to_linear(emissive)
        bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
        bsdf.inputs["IOR"].default_value = ior
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    return m


def hex_to_linear(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def new_object(name, bm, mat=None, parent=None, smooth=True, auto_smooth_deg=35):
    """Turn a bmesh into a named object (mesh data gets the same name)."""
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        me.materials.append(mat)
    if smooth:
        # smooth shading, but keep edges sharper than the angle crisp (CAD look)
        for p in me.polygons:
            p.use_smooth = True
        me.set_sharp_from_angle(angle=math.radians(auto_smooth_deg))
    if parent:
        obj.parent = parent
    return obj


def lathe(profile, segments, axis="X"):
    """Revolve a 2D profile [(radius, along_axis), ...] into a closed ring mesh around the axis."""
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ring = []
        for r, t in profile:
            if axis == "X":
                co = (t, r * math.cos(a), r * math.sin(a))
            else:
                co = (r * math.cos(a), r * math.sin(a), t)
            ring.append(bm.verts.new(co))
        rings.append(ring)
    n = len(profile)
    for i in range(segments):
        a, b = rings[i], rings[(i + 1) % segments]
        for j in range(n - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    bm.normal_update()
    return bm


def box(bm, center, size, rot=None):
    m = Matrix.Translation(Vector(center))
    if rot is not None:
        m = m @ rot
    bmesh.ops.create_cube(bm, size=1.0, matrix=m @ Matrix.Diagonal(Vector((*size, 1.0))))
    return bm


def cylinder(bm, center, radius, depth, segments=24, axis="X", radius2=None):
    rot = {
        "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
        "Y": Matrix.Rotation(math.pi / 2, 4, "X"),
        "Z": Matrix.Identity(4),
    }[axis]
    m = Matrix.Translation(Vector(center)) @ rot
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius2 is None else radius2, depth=depth, matrix=m
    )
    return bm


def bevel_modifier(obj, width=0.01, segments=2):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    return mod


def to_gltf(v):
    """Blender (x, y, z) -> glTF (x, z, -y)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def world_center(obj):
    bpy.context.view_layer.update()
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(pts, Vector()) / 8


def write_meta(model_id, title, description, parts, extra=None):
    """Write models/build/<id>.meta.json and copy each part's metadata into glTF extras."""
    os.makedirs(BUILD, exist_ok=True)
    for p in parts:
        obj = bpy.data.objects[p["id"]]
        if "hotspot" not in p:
            p["hotspot"] = to_gltf(world_center(obj))
        obj["ecostream"] = json.dumps({k: v for k, v in p.items() if k != "id"})
    meta = {"id": model_id, "title": title, "description": description, "units": "metres", "up": "Y", "parts": parts}
    if extra:
        meta.update(extra)
    with open(os.path.join(BUILD, f"{model_id}.meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    return meta


def export_glb(model_id):
    os.makedirs(BUILD, exist_ok=True)
    path = os.path.join(BUILD, f"{model_id}.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_extras=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    print("EXPORTED", path, os.path.getsize(path))
    return path


# ---------- surface detail helpers (realism pass) ----------
_IMAGES = {}


def _tileable_noise(n, scale, seed, aniso=None):
    import numpy as np
    rng = np.random.default_rng(seed)
    f = np.fft.fftfreq(n)
    fx, fy = np.meshgrid(f, f)
    if aniso:  # long streaks (brushed metal): squash one frequency axis
        fx = fx * aniso
    k = np.sqrt(fx ** 2 + fy ** 2)
    filt = np.exp(-(k / max(scale, 1e-4)) ** 2)
    h = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((n, n))) * filt))
    h = (h - h.mean()) / (h.std() + 1e-9)
    return h


def _normal_image(name, scale, aniso=None, n=256):
    if name in _IMAGES:
        return _IMAGES[name]
    import numpy as np
    h = _tileable_noise(n, scale, seed=abs(hash(name)) % 1000, aniso=aniso)
    h2 = _tileable_noise(n, scale * 4, seed=7) * 0.35  # finer grain on top
    h = h + h2
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx, ny, nz = -gx, -gy, np.ones_like(h) * 2.0
    ln = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    rgba = np.stack([nx / ln * 0.5 + 0.5, ny / ln * 0.5 + 0.5, nz / ln * 0.5 + 0.5, np.ones_like(h)], -1)
    img = bpy.data.images.new(name, n, n, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(rgba.astype("float32").ravel())
    img.file_format = "JPEG"
    img.pack()
    _IMAGES[name] = img
    return img


def _hook_normal(mat, img, strength):
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = strength
    nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])


def add_noise_normal(mat, name, scale=0.05, strength=0.5, tiles=1):
    """Fine grain (rubber, paint) as a tiling normal map. UVs come from uv_box()."""
    if mat.get("has_normal"):
        return
    _hook_normal(mat, _normal_image(name, scale), strength)
    mat["has_normal"] = 1


def add_brushed_normal(mat, name, strength=0.3):
    if mat.get("has_normal"):
        return
    _hook_normal(mat, _normal_image(name, 0.08, aniso=12.0), strength)
    mat["has_normal"] = 1


def uv_box(obj, size=0.1):
    """Box-projected UVs (metres / size per tile) so tiling detail maps sit at real scale."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != ax]
        for l in f.loops:
            co = l.vert.co
            l[uv].uv = (co[a] / size, co[b] / size)
    bm.to_mesh(me)
    bm.free()


uv_cylinder = uv_box


def finish(obj, width=0.002, segments=2):
    """Bevel hard edges + weighted normals: the CAD look that catches highlights on every edge."""
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(35)
    mod.harden_normals = True
    wn = obj.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    return mod
