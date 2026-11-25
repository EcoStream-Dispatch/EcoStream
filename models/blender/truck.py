"""
Generic Indian 10-wheel tipper truck (cab-over), no brand badges or logos.
Parts: cab (+ two hinged doors), chassis, front axle, rear tandem axles, 10 wheel assemblies
(each with the sealed EcoStream tyre sensor), fuel tank, battery box, tipper body, and the
sealed EcoStream in-cab unit on the dashboard.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python models/blender/truck.py

Blender axes: X = across (right side +X), Y = forward, Z = up, ground at z = 0. Metres.
Patent rule: the tyre sensors and the in-cab unit are closed generic shells only. They never
open, never show internals and never explode on their own.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402
import wheel_parts  # noqa: E402

C.reset_scene()

# ---------- Materials ----------
CAB = C.material("cab_paint", "#1f3a6e", metallic=0.35, roughness=0.32, clearcoat=0.8)
WHITE = C.material("body_white", "#eef0ec", metallic=0.1, roughness=0.4, clearcoat=0.4)
GREEN = C.material("eco_green", "#3E7231", metallic=0.2, roughness=0.4, clearcoat=0.5)
GLASS = C.material("glass", "#1b2833", metallic=0.2, roughness=0.06)
TRIM = C.material("trim_dark", "#2b2f33", metallic=0.3, roughness=0.55)
FRAME = C.material("chassis_black", "#1d1f22", metallic=0.45, roughness=0.5)
STEELG = C.material("steel_grey", "#7d838a", metallic=0.8, roughness=0.35)
ALU = C.material("aluminium", "#c9ced3", metallic=0.9, roughness=0.25)
PLATE = C.material("plate_yellow", "#f2c230", roughness=0.5)
HEAD = C.material("headlight", "#fff6d8", roughness=0.1, emissive="#fff6d8", emissive_strength=1.5)
AMBER = C.material("amber", "#ff9a1f", roughness=0.3, emissive="#ff9a1f", emissive_strength=0.8)
RED = C.material("tail_red", "#d3271f", roughness=0.3, emissive="#d3271f", emissive_strength=0.8)
GRAVEL = C.material("gravel", "#8a8276", roughness=0.95)
UNIT = C.material("unit_shell", "#1f2327", roughness=0.7)
LED = C.material("unit_led", "#7dff5a", roughness=0.3, emissive="#7dff5a", emissive_strength=6.0)
BAND = C.material("unit_band", "#5C9A35", roughness=0.45, emissive="#5C9A35", emissive_strength=0.8)


def bx(center, size, rot=None):
    bm = bmesh.new()
    C.box(bm, center, size, rot=rot)
    return bm


def cyl(center, r, depth, axis="X", seg=32, r2=None):
    bm = bmesh.new()
    C.cylinder(bm, center, r, depth, segments=seg, axis=axis, radius2=r2)
    return bm


def mk(name, pieces, parent=None, bevel=None, smooth_deg=35):
    """pieces: [(bmesh, material), ...] -> one object (materials kept per piece)."""
    objs = []
    for i, (bm, mat) in enumerate(pieces):
        objs.append(C.new_object(name if i == 0 else f"{name}_tmp{i}", bm, mat, auto_smooth_deg=smooth_deg))
    if len(objs) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
    obj = bpy.data.objects[name]
    if bevel:
        C.bevel_modifier(obj, bevel, 2)
    if parent:
        obj.parent = parent
    return obj


def set_origin(obj, p):
    """Move the object's origin (its pivot) to world point p, keeping the geometry in place."""
    p = Vector(p)
    obj.data.transform(Matrix.Translation(-p))
    obj.location = p


root = bpy.data.objects.new("truck", None)
bpy.context.scene.collection.objects.link(root)

R = 0.522  # wheel radius

# ---------- Chassis ----------
pieces = []
for sx in (-1, 1):
    pieces.append((bx((sx * 0.45, -0.05, 1.05), (0.09, 8.1, 0.26)), FRAME))  # main rails
for y in (3.7, 2.2, 0.9, -0.4, -1.6, -2.95, -3.95):
    pieces.append((bx((0, y, 1.05), (0.82, 0.1, 0.18)), FRAME))  # cross members
for sx in (-1, 1):  # rear mudguards over the duals, front mudflaps
    pieces.append((bx((sx * 0.88, -2.27, 1.16), (0.66, 2.9, 0.04)), TRIM))
    pieces.append((bx((sx * 0.88, -3.78, 0.78), (0.66, 0.03, 0.72)), TRIM))
    pieces.append((bx((sx * 0.98, -4.0, 1.0), (0.22, 0.06, 0.1)), RED))  # tail lights
pieces.append((bx((0, -4.08, 0.72), (2.3, 0.08, 0.1)), STEELG))  # under-run bar
pieces.append((bx((-0.15, -4.13, 0.85), (0.4, 0.02, 0.18)), PLATE))  # blank rear plate
pieces.append((cyl((0.85, 1.85, 2.55), 0.06, 1.3, axis="Z", seg=20), STEELG))  # exhaust stack behind cab
pieces.append((cyl((0.0, 1.75, 1.6), 0.09, 0.9, axis="Z", seg=24), STEELG))  # tipper ram (closed)
chassis = mk("chassis", pieces, parent=root, bevel=0.008)

# ---------- Axles ----------
pieces = [(bx((0, 3.0, R), (1.85, 0.12, 0.14)), FRAME)]
for sx in (-1, 1):
    pieces.append((bx((sx * 0.45, 3.0, 0.8), (0.08, 1.3, 0.09)), STEELG))  # leaf spring
    pieces.append((cyl((sx * 0.8, 3.0, R), 0.07, 0.3, axis="X", seg=20), FRAME))  # stub axle
front_axle = mk("front_axle", pieces, parent=root, bevel=0.006)

pieces = []
for y in (-1.6, -2.95):
    pieces.append((cyl((0, y, R), 0.075, 1.75, axis="X", seg=24), FRAME))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=0.2, matrix=Matrix.Translation((0, y, R)))
    pieces.append((bm, FRAME))  # differential
    pieces.append((cyl((0, y + 0.22, R), 0.06, 0.25, axis="Y", seg=16), STEELG))  # pinion
for sx in (-1, 1):
    pieces.append((bx((sx * 0.45, -2.27, 0.78), (0.09, 1.9, 0.12)), STEELG))  # bogie spring
pieces.append((cyl((0, -1.0, 0.85), 0.05, 1.1, axis="Y", seg=16), STEELG))  # prop shaft
rear_axles = mk("rear_axles", pieces, parent=root, bevel=0.006)

# ---------- Fuel tank (left), battery box (right) ----------
fuel = mk("fuel_tank", [(cyl((-0.8, 1.15, 0.85), 0.27, 1.1, axis="Y", seg=48), ALU),
                        (cyl((-0.8, 1.15, 1.13), 0.05, 0.04, axis="Z", seg=16), TRIM)], parent=root, bevel=0.01)
battery = mk("battery_box", [(bx((0.82, 1.15, 0.82), (0.42, 0.75, 0.42)), TRIM),
                             (bx((0.82, 1.15, 1.05), (0.44, 0.77, 0.03)), STEELG)], parent=root, bevel=0.01)

# ---------- Cab (cab-over), origin at world origin so the doors can hang off it ----------
CY0, CY1, CZ0, CZ1, CW = 2.2, 4.2, 1.08, 3.3, 1.2
pieces = [
    (bx((0, (CY0 + CY1) / 2, (CZ0 + CZ1) / 2), (2 * CW, CY1 - CY0, CZ1 - CZ0)), CAB),
    (bx((0, CY1 - 0.2, CZ1 + 0.06), (2 * CW - 0.1, 0.5, 0.12)), CAB),  # roof visor
    (bx((0, CY1 + 0.012, 2.72), (2 * CW - 0.16, 0.03, 0.95)), GLASS),  # windscreen
    (bx((0, CY1 + 0.03, 2.2), (2 * CW - 0.1, 0.03, 0.08)), GREEN),  # green line under windscreen
    (bx((0, CY1 + 0.13, 1.2), (2 * CW + 0.08, 0.24, 0.32)), TRIM),  # bumper
    (bx((0.0, CY1 + 0.255, 1.2), (0.52, 0.015, 0.13)), PLATE),  # blank front plate
]
for i in range(5):  # grille slats (no badge)
    pieces.append((bx((0, CY1 + 0.02, 1.48 + i * 0.1), (1.3, 0.04, 0.045)), TRIM))
for sx in (-1, 1):
    pieces.append((cyl((sx * 0.92, CY1 + 0.02, 1.62), 0.11, 0.05, axis="Y", seg=32), HEAD))  # headlights
    pieces.append((bx((sx * 1.1, CY1 + 0.02, 1.85), (0.14, 0.04, 0.08)), AMBER))  # indicators
    pieces.append((bx((sx * (CW + 0.21), CY1 - 0.05, 2.65), (0.04, 0.04, 0.5)), TRIM))  # mirror arm
    pieces.append((bx((sx * (CW + 0.22), CY1 - 0.05, 2.6), (0.07, 0.2, 0.42)), TRIM))  # mirror
    pieces.append((bx((sx * (CW + 0.1), CY1 - 0.05, 2.85), (0.22, 0.04, 0.04)), TRIM))
    pieces.append((bx((sx * (CW - 0.08), 3.5, 0.82), (0.32, 0.5, 0.05)), STEELG))  # step
    pieces.append((bx((sx * (CW + 0.005), 2.6, 1.85), (0.02, 0.75, 0.12)), GREEN))  # green side stripe
    pieces.append((bx((sx * (CW + 0.005), 2.6, 2.7), (0.02, 0.6, 0.6)), GLASS))  # rear quarter window
    pieces.append((bx((sx * 1.03, 3.0, 1.12), (0.4, 1.2, 0.04)), TRIM))  # front wheel arch lip
# dashboard inside the cab (seen in X-ray view)
pieces.append((bx((0, 3.97, 2.05), (2.2, 0.38, 0.3)), TRIM))
pieces.append((cyl((-0.55, 3.72, 2.3), 0.2, 0.04, axis="Y", seg=32, r2=0.2), TRIM))  # steering wheel
cab = mk("cab", pieces, parent=root, bevel=0.02)

# ---------- Doors (origin on the hinge at the front edge) ----------
DY0, DY1 = 2.95, 4.05
for side, sx in (("left", -1), ("right", 1)):
    x = sx * (CW + 0.03)
    pieces = [
        (bx((x, (DY0 + DY1) / 2, 2.1), (0.05, DY1 - DY0, 1.95)), CAB),
        (bx((x + sx * 0.03, (DY0 + DY1) / 2 + 0.03, 2.72), (0.02, 0.95, 0.7)), GLASS),
        (bx((x + sx * 0.03, (DY0 + DY1) / 2, 1.85), (0.02, DY1 - DY0 - 0.02, 0.12)), GREEN),
        (bx((x + sx * 0.04, DY0 + 0.15, 2.2), (0.03, 0.16, 0.04)), STEELG),  # handle
    ]
    door = mk(f"door_{side}", pieces, bevel=0.01)
    set_origin(door, (x, DY1, 2.1))
    door.parent = cab

# ---------- Tipper body (origin on the rear hinge) ----------
TY0, TY1, TW, FZ, WZ = -4.1, 1.9, 1.25, 1.38, 2.6
pieces = [
    (bx((0, (TY0 + TY1) / 2, FZ), (2 * TW, TY1 - TY0, 0.1)), WHITE),  # floor
    (bx((0, TY1 - 0.04, (FZ + WZ + 0.35) / 2), (2 * TW, 0.08, WZ + 0.35 - FZ)), WHITE),  # headboard
    (bx((0, TY1 + 0.2, WZ + 0.3), (2 * TW, 0.5, 0.06)), WHITE),  # canopy lip over the cab
    (bx((0, TY0 + 0.04, (FZ + WZ) / 2), (2 * TW, 0.08, WZ - FZ)), WHITE),  # tailgate
]
for sx in (-1, 1):
    pieces.append((bx((sx * 0.45, (TY0 + TY1) / 2, FZ - 0.1), (0.12, TY1 - TY0 - 0.1, 0.12)), FRAME))  # subframe
    pieces.append((bx((sx * (TW - 0.03), (TY0 + TY1) / 2, (FZ + WZ) / 2), (0.06, TY1 - TY0, WZ - FZ)), WHITE))
    pieces.append((bx((sx * (TW + 0.005), (TY0 + TY1) / 2, 2.25), (0.02, TY1 - TY0 - 0.2, 0.16)), GREEN))
    pieces.append((bx((sx * (TW + 0.005), (TY0 + TY1) / 2, 2.05), (0.02, TY1 - TY0 - 0.2, 0.05)), GREEN))
    pieces.append((bx((sx * (TW + 0.02), (TY0 + TY1) / 2, WZ - 0.02), (0.07, TY1 - TY0, 0.07)), WHITE))  # top rail
    for i in range(9):  # ribs
        y = TY0 + 0.35 + i * (TY1 - TY0 - 0.7) / 8
        pieces.append((bx((sx * (TW + 0.03), y, (FZ + WZ) / 2), (0.05, 0.08, WZ - FZ)), WHITE))
# gravel load: a gentle heap inside the body
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=20, y_segments=40, size=1.0)
for v in bm.verts:
    u, w = v.co.x, v.co.y  # -1..1
    h = 0.32 * (1 - u * u) * (1 - 0.6 * w * w) + 0.03 * math.sin(9 * u + 5 * w) + 0.02 * math.cos(13 * w)
    v.co = Vector((u * (TW - 0.07), (TY0 + TY1) / 2 + w * ((TY1 - TY0) / 2 - 0.1), 2.05 + h))
pieces.append((bm, GRAVEL))
tipper = mk("tipper_body", pieces, parent=root, bevel=0.008)
set_origin(tipper, (0, TY0, FZ - 0.08))

# ---------- EcoStream in-cab unit: sealed generic box on the dashboard ----------
# Rides with the cab (it is fixed to the dashboard) but never moves or opens on its own.
U = Vector((0.42, 3.92, 2.25))
unit = mk("in_cab_unit", [(bx(U, (0.2, 0.12, 0.06)), UNIT), (bx(U + Vector((0, 0.03, -0.045)), (0.12, 0.06, 0.03)), TRIM)],
          parent=cab, bevel=0.012)
mk("in_cab_unit_band", [(bx(U + Vector((0, 0, 0)), (0.205, 0.016, 0.062)), BAND)], parent=unit)
mk("in_cab_unit_led", [(cyl(U + Vector((0.07, -0.061, 0.012)), 0.006, 0.004, axis="Y", seg=20), LED)], parent=unit)

# ---------- Wheels: one master wheel, shared mesh data for all 10 ----------
master = bpy.data.objects.new("wheel_master", None)
bpy.context.scene.collection.objects.link(master)
wheel_parts.build(64, master)


def copy_tree(src, parent, prefix):
    o = src.copy()  # shares mesh data (instanced in the glTF)
    o.name = f"{prefix}_{src.name}"
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    for ch in src.children:
        copy_tree(ch, o, prefix)
    return o


WHEELS = [  # id, x, y, label
    ("wheel_fl", -1.03, 3.0), ("wheel_fr", 1.03, 3.0),
    ("wheel_r1lo", -1.03, -1.6), ("wheel_r1li", -0.72, -1.6), ("wheel_r1ri", 0.72, -1.6), ("wheel_r1ro", 1.03, -1.6),
    ("wheel_r2lo", -1.03, -2.95), ("wheel_r2li", -0.72, -2.95), ("wheel_r2ri", 0.72, -2.95), ("wheel_r2ro", 1.03, -2.95),
]
for wid, x, y in WHEELS:
    e = bpy.data.objects.new(wid, None)
    bpy.context.scene.collection.objects.link(e)
    e.parent = root
    e.location = (x, y, R)
    if x < 0:
        e.rotation_euler = (0, 0, math.pi)  # outboard side faces out
    for ch in list(master.children):
        copy_tree(ch, e, wid)


def delete_tree(o):
    for ch in list(o.children):
        delete_tree(ch)
    bpy.data.objects.remove(o, do_unlink=True)


delete_tree(master)

# ---------- Metadata ----------
L = [-1, 0, 0]
Rt = [1, 0, 0]
SENSOR_TXT = ("Sealed EcoStream sensor inside each of the 10 tyres. Reads tyre pressure and temperature and "
              "radios them to the in-cab unit.")
parts = [
    dict(id="chassis", label="Chassis frame", group="truck", order=1, explode=[0, 0, 0], distance=0.0,
         description="Twin steel rails that carry everything. Includes mudguards, lights, exhaust and the tipper ram."),
    dict(id="front_axle", label="Front axle", group="truck", order=2, explode=[0, -1, 0], distance=0.45,
         description="Steering axle on leaf springs."),
    dict(id="rear_axles", label="Rear tandem axles", group="truck", order=2, explode=[0, -1, 0], distance=0.45,
         description="Two driven axles with differentials, on a shared spring bogie."),
    dict(id="wheel_fl", label="Front wheels (2)", group="wheel", order=3, explode=L, distance=1.0,
         description="Single front tyres. Each one carries an EcoStream tyre sensor.", hotspot=C.to_gltf((-1.2, 3.0, 0.9))),
    dict(id="wheel_fr", label="Front wheels (2)", group="wheel", order=3, explode=Rt, distance=1.0, partOf="wheel_fl",
         description=""),
]
first_rear = True
for wid, x, y in WHEELS[2:]:
    inner = wid.endswith("i")
    p = dict(id=wid, label="Rear wheels (8)", group="wheel", order=3, explode=L if x < 0 else Rt,
             distance=0.75 if inner else 1.2, description="Twin tyres on both rear axles. Each tyre has its own EcoStream sensor.")
    if first_rear:
        p["hotspot"] = C.to_gltf((-1.2, -2.27, 0.9))
        first_rear = False
    else:
        p["partOf"] = "wheel_r1lo"
        p["description"] = ""
    parts.append(p)
for p in parts:
    if p["id"].startswith("wheel_") and "hotspot" not in p:
        x, y = next((wx, wy) for w, wx, wy in WHEELS if w == p["id"])
        p["hotspot"] = C.to_gltf((x, y, R))
parts += [
    dict(id="wheel_fr_tpms_sensor", label="EcoStream tyre sensor", group="sensor", order=3, sealed=True,
         explode=[0, 0, 0], distance=0.0, description=SENSOR_TXT),
    dict(id="fuel_tank", label="Fuel tank", group="truck", order=4, explode=L, distance=0.9,
         description="Aluminium diesel tank on the left frame rail."),
    dict(id="battery_box", label="Battery box", group="truck", order=4, explode=Rt, distance=0.9,
         description="Two 12 V batteries; the in-cab unit runs from these."),
    dict(id="cab", label="Cab", group="truck", order=5, explode=[0, 0.55, -0.83], distance=1.6,
         description="Cab-over steel cab with the dashboard, seats and controls. No badges: a generic truck."),
    dict(id="door_left", label="Left door", group="truck", order=6, explode=L, distance=0.6,
         description="Hinged at the front edge."),
    dict(id="door_right", label="Right door", group="truck", order=6, explode=Rt, distance=0.6,
         description="Hinged at the front edge."),
    dict(id="tipper_body", label="Tipper body", group="truck", order=7, explode=[0, 1, 0], distance=1.8,
         description="Steel tipper body, hinged at the back and raised by the ram to dump the load."),
    dict(id="in_cab_unit", label="EcoStream in-cab unit", group="sensor", order=7, sealed=True,
         explode=[0, 0, 0], distance=0.0,
         description="Sealed box on the dashboard. Collects the tyre sensors' readings and the truck's GPS and sends them to EcoStream."),
    dict(id="in_cab_unit_band", label="EcoStream in-cab unit", group="sensor", order=7, sealed=True, partOf="in_cab_unit",
         explode=[0, 0, 0], distance=0.0, description=""),
    dict(id="in_cab_unit_led", label="EcoStream in-cab unit", group="sensor", order=7, sealed=True, partOf="in_cab_unit",
         explode=[0, 0, 0], distance=0.0, description=""),
]
spin_targets = [{"node": w, "axis": [1, 0, 0] if x < 0 else [-1, 0, 0]} for w, x, _ in WHEELS]
C.write_meta(
    "truck",
    "10-wheel tipper truck",
    "Generic Indian tipper truck with the EcoStream tyre sensors and in-cab unit.",
    parts,
    extra={
        "root": "truck",
        "animations": [
            {"id": "spin", "label": "Spin wheels", "node": "wheel_fl", "type": "rotate", "axis": [1, 0, 0],
             "pivot": [0, 0, 0], "speed": 0.8, "targets": spin_targets},
            {"id": "doors", "label": "Open doors", "node": "door_left", "type": "hinge", "axis": [0, -1, 0],
             "pivot": [0, 0, 0], "maxAngle": 70,
             "targets": [{"node": "door_left", "axis": [0, -1, 0]}, {"node": "door_right", "axis": [0, 1, 0]}]},
            {"id": "tip", "label": "Raise tipper", "node": "tipper_body", "type": "hinge", "axis": [1, 0, 0],
             "pivot": [0, 0, 0], "maxAngle": 45},
        ],
        "camera": {"position": [7.5, 3.6, -8.5], "target": [0, 1.5, 0], "minDistance": 3.0, "maxDistance": 26.0},
        "ghost": ["cab"],
        "ghostLabel": "See-through cab",
        "focus": {"part": "in_cab_unit", "label": "Show in-cab unit", "led": "in_cab_unit_led", "ghost": True,
                  "direction": [1, 0.55, -0.35], "distance": 1.4},
        "ground": 0,
        "shadowScale": 16,
    },
)
C.export_glb("truck")
