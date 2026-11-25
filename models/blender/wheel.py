"""
Wheel assembly: truck tyre (295/80 R22.5), steel disc rim, hub with lug nuts, valve stem and
the EcoStream tyre-pressure sensor (a sealed, generic cap-mount puck: no internals, ever).

    /Applications/Blender.app/Contents/MacOS/Blender --background --python models/blender/wheel.py

Wheel axis = Blender X (outboard side = +X). Origin = wheel centre.
Output: models/build/wheel.glb and models/build/wheel.meta.json
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402

C.reset_scene()

# ---------- Materials (clean CAD-style PBR) ----------
RUBBER = C.material("rubber", "#1b1c1f", roughness=0.88)
STEEL = C.material("rim_paint", "#c8ccd1", metallic=0.55, roughness=0.32)
HUB_PAINT = C.material("hub_green", "#3E7231", metallic=0.3, roughness=0.38, clearcoat=0.5)
CHROME = C.material("chrome", "#e4e7ea", metallic=1.0, roughness=0.15)
VALVE = C.material("valve_brass", "#b08d57", metallic=0.9, roughness=0.3)
SENSOR_SHELL = C.material("sensor_shell", "#f4f5f2", roughness=0.35, clearcoat=0.6)
SENSOR_BAND = C.material("sensor_band", "#5C9A35", roughness=0.4, emissive="#5C9A35", emissive_strength=0.6)

SEG = 96  # segments around the wheel

root = bpy.data.objects.new("wheel_assembly", None)
bpy.context.scene.collection.objects.link(root)

# ---------- Tyre: lathe profile with 4 circumferential grooves ----------
R_OUT = 0.522  # outer radius (1.044 m diameter)
R_BEAD = 0.288  # bead seat (22.5" rim)
W = 0.148  # half section width
tread = []
# tread surface from -W to +W with grooves at -0.075, -0.025, +0.025, +0.075
xs = [-0.125, -0.09, -0.08, -0.07, -0.06, -0.035, -0.03, -0.02, -0.015, 0.015, 0.02, 0.03, 0.035, 0.06, 0.07, 0.08, 0.09, 0.125]
groove = {-0.08, -0.07, -0.03, -0.02, 0.02, 0.03, 0.07, 0.08}
for x in xs:
    tread.append((R_OUT - (0.014 if round(x, 3) in groove else 0.0), x))
profile = [(R_BEAD, -0.118), (0.33, -0.132), (0.40, -W), (0.47, -W + 0.004), (0.505, -0.138)]
profile += tread
profile += [(0.505, 0.138), (0.47, W - 0.004), (0.40, W), (0.33, 0.132), (R_BEAD, 0.118), (R_BEAD, -0.118)]
tyre_bm = C.lathe(profile, SEG, axis="X")
# Shoulder lugs (blocks across the shoulder) for a real truck-tyre look
for side in (-1, 1):
    for i in range(48):
        a = 2 * math.pi * (i + (0.5 if side > 0 else 0)) / 48
        rot = Matrix.Rotation(a, 4, "X")
        c = rot @ Vector((side * 0.116, 0.0, R_OUT - 0.009))
        C.box(tyre_bm, c, (0.042, 0.024, 0.012), rot=rot)
tyre = C.new_object("tyre", tyre_bm, RUBBER, parent=root, auto_smooth_deg=40)

# ---------- Rim: steel barrel + dished disc with 8 hand holes ----------
rim_profile = [
    (0.300, -0.108), (0.300, -0.100), (0.287, -0.096), (0.284, -0.06), (0.262, -0.035), (0.262, 0.035),
    (0.284, 0.06), (0.287, 0.096), (0.300, 0.100), (0.300, 0.108), (0.292, 0.108), (0.278, 0.098),
    (0.276, 0.064), (0.254, 0.040), (0.254, -0.040), (0.276, -0.064), (0.278, -0.098), (0.292, -0.108), (0.300, -0.108),
]
rim_bm = C.lathe(rim_profile, SEG, axis="X")
disc_profile = [(0.256, 0.020), (0.20, 0.030), (0.135, 0.058), (0.112, 0.060), (0.112, 0.048), (0.135, 0.046), (0.20, 0.018), (0.256, 0.008), (0.256, 0.020)]
disc_bm = C.lathe(disc_profile, SEG, axis="X")
disc = C.new_object("rim_disc_tmp", disc_bm, STEEL)
# hand holes: boolean-cut 8 short cylinders through the disc
cutters = bmesh.new()
for i in range(8):
    a = 2 * math.pi * (i + 0.5) / 8
    C.cylinder(cutters, (0.035, 0.218 * math.cos(a), 0.218 * math.sin(a)), 0.026, 0.12, segments=24, axis="X")
cut = C.new_object("rim_cut_tmp", cutters, None, smooth=False)
mod = disc.modifiers.new("Holes", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.object = cut
bpy.context.view_layer.objects.active = disc
bpy.ops.object.modifier_apply(modifier="Holes")
bpy.data.objects.remove(cut, do_unlink=True)
rim = C.new_object("rim", rim_bm, STEEL, parent=root)
# join disc into rim
bpy.ops.object.select_all(action="DESELECT")
disc.select_set(True)
rim.select_set(True)
bpy.context.view_layer.objects.active = rim
bpy.ops.object.join()
rim = bpy.data.objects["rim"]
rim.parent = root

# ---------- Hub: green hub body, cap ----------
hub_bm = bmesh.new()
C.cylinder(hub_bm, (0.045, 0, 0), 0.105, 0.09, segments=48, axis="X")
C.cylinder(hub_bm, (0.097, 0, 0), 0.07, 0.018, segments=48, axis="X", radius2=0.05)
C.cylinder(hub_bm, (-0.03, 0, 0), 0.085, 0.07, segments=48, axis="X")
hub = C.new_object("hub", hub_bm, HUB_PAINT, parent=root)
C.bevel_modifier(hub, 0.004, 2)

# ---------- Lug nuts: 10 on a 335 mm pitch circle ----------
nuts_bm = bmesh.new()
for i in range(10):
    a = 2 * math.pi * i / 10
    y, z = 0.1675 * math.cos(a), 0.1675 * math.sin(a)
    C.cylinder(nuts_bm, (0.078, y, z), 0.016, 0.026, segments=6, axis="X")  # hex nut
    C.cylinder(nuts_bm, (0.096, y, z), 0.009, 0.012, segments=12, axis="X")  # stud end
lug_nuts = C.new_object("lug_nuts", nuts_bm, CHROME, parent=root, auto_smooth_deg=20)

# ---------- Valve stem (reaches out through a hand hole, at the top) ----------
VA = math.radians(90 + 22.5)  # angle of a hand hole
vy, vz = 0.218 * math.cos(VA), 0.218 * math.sin(VA)
valve_bm = bmesh.new()
C.cylinder(valve_bm, (0.06, vy, vz), 0.0055, 0.09, segments=16, axis="X")
C.cylinder(valve_bm, (0.0, vy * 1.12, vz * 1.12), 0.007, 0.03, segments=16, axis="X")
valve = C.new_object("valve_stem", valve_bm, VALVE, parent=root)

# ---------- EcoStream TPMS sensor: sealed cap-mount puck on the valve (no internals) ----------
sensor_bm = bmesh.new()
C.cylinder(sensor_bm, (0.118, vy, vz), 0.0135, 0.026, segments=32, axis="X")
sensor = C.new_object("tpms_sensor", sensor_bm, SENSOR_SHELL, parent=valve)
C.bevel_modifier(sensor, 0.004, 3)
band_bm = bmesh.new()
C.cylinder(band_bm, (0.112, vy, vz), 0.0139, 0.004, segments=32, axis="X")
band = C.new_object("tpms_sensor_band", band_bm, SENSOR_BAND, parent=sensor)

# ---------- Metadata ----------
# explode: glTF direction (Y-up) x distance in metres. Sensor never explodes on its own.
parts = [
    dict(id="hub", label="Wheel hub", group="wheel", order=1,
         description="Bolts the wheel to the axle and carries the wheel bearings.",
         explode=[-1, 0, 0], distance=0.32),
    dict(id="rim", label="Steel disc rim", group="wheel", order=2,
         description="22.5-inch steel rim. Holds the tyre bead; the hand holes cool the brakes.",
         explode=[0, 0, 0], distance=0.0),
    dict(id="tyre", label="Truck tyre 295/80 R22.5", group="wheel", order=3,
         description="Tubeless radial truck tyre, about 1.04 m tall. EcoStream watches its pressure and temperature.",
         explode=[-1, 0, 0], distance=0.62),
    dict(id="lug_nuts", label="Wheel nuts (10)", group="wheel", order=4,
         description="Ten nuts on a 335 mm circle clamp the rim to the hub.",
         explode=[1, 0, 0], distance=0.22),
    dict(id="valve_stem", label="Valve stem", group="wheel", order=5,
         description="Where air goes in. The EcoStream sensor screws on in place of the valve cap.",
         explode=[1, 0, 0], distance=0.16),
    dict(id="tpms_sensor", label="EcoStream tyre sensor", group="sensor", order=6, sealed=True,
         description="Sealed cap-mount sensor. Reads tyre pressure and temperature and radios them to the in-cab unit.",
         explode=[0, 0, 0], distance=0.0),
    dict(id="tpms_sensor_band", label="EcoStream tyre sensor", group="sensor", order=6, sealed=True, partOf="tpms_sensor",
         description="Sealed cap-mount sensor. Reads tyre pressure and temperature and radios them to the in-cab unit.",
         explode=[0, 0, 0], distance=0.0),
]
C.write_meta(
    "wheel",
    "Wheel and tyre sensor",
    "Truck wheel assembly with the EcoStream cap-mount tyre-pressure sensor.",
    parts,
    extra={
        "root": "wheel_assembly",
        "animations": [
            {"id": "spin", "label": "Spin wheel", "node": "wheel_assembly", "type": "rotate", "axis": [1, 0, 0], "pivot": [0, 0, 0], "speed": 1.2}
        ],
        "camera": {"position": [1.6, 0.6, 1.6], "target": [0, 0, 0], "minDistance": 0.6, "maxDistance": 4.0},
        "ground": -0.53,
        "shadowScale": 3,
    },
)
C.export_glb("wheel")
