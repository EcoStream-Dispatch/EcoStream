"""
Wheel geometry shared by wheel.py (the wheel assembly model) and truck.py (10 wheels).
build(seg, root) creates: tyre, rim, hub, lug_nuts, valve_stem, tpms_sensor (+ tpms_sensor_band),
all parented to `root` (an Empty at the wheel centre; wheel axis = X, outboard = +X).
The EcoStream sensor is a sealed cap only: no internals.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common as C  # noqa: E402


def build(SEG, root):
    # ---------- Materials (clean CAD-style PBR) ----------
    RUBBER = C.material("rubber", "#1b1c1f", roughness=0.88)
    STEEL = C.material("rim_paint", "#c8ccd1", metallic=0.55, roughness=0.32)
    HUB_PAINT = C.material("hub_green", "#3E7231", metallic=0.3, roughness=0.38, clearcoat=0.5)
    CHROME = C.material("chrome", "#e4e7ea", metallic=1.0, roughness=0.15)
    VALVE = C.material("valve_brass", "#b08d57", metallic=0.9, roughness=0.3)
    SENSOR_SHELL = C.material("sensor_shell", "#1f2327", roughness=0.72)
    SENSOR_BAND = C.material("sensor_band", "#5C9A35", roughness=0.45, emissive="#5C9A35", emissive_strength=0.8)



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

    # ---------- Valve + EcoStream TPMS sensor (valve-mounted, inside the tyre, on the rim well) ----------
    # Patent rule: outside housing only (no internals), never opens or explodes.
    VA = math.radians(90 + 22.5)  # valve angle = a hand-hole angle, so the stem reaches the outside
    def at(ang, r, x=0.0):
        return Vector((x, r * math.cos(ang), r * math.sin(ang)))

    # valve stem: through the rim well (radial), then out through the hand hole (axial), with a cap
    valve_bm = bmesh.new()
    R_V = 0.232
    rad_rot = Matrix.Rotation(VA - math.pi / 2, 4, "X")
    C.cylinder(valve_bm, at(VA, 0.250), 0.0055, 0.036, segments=16, axis="Z")
    valve_bm.verts.ensure_lookup_table()
    # rotate the radial piece to point along the valve angle
    radial = [v for v in valve_bm.verts]
    bmesh.ops.rotate(valve_bm, verts=radial, cent=at(VA, 0.250), matrix=rad_rot)
    C.cylinder(valve_bm, at(VA, R_V, 0.052), 0.0055, 0.104, segments=16, axis="X")
    C.cylinder(valve_bm, at(VA, R_V, 0.0), 0.0075, 0.012, segments=16, axis="X")  # bend / grommet
    C.cylinder(valve_bm, at(VA, R_V, 0.108), 0.0078, 0.016, segments=6, axis="X")  # hex cap
    valve = C.new_object("valve_stem", valve_bm, VALVE, parent=root, auto_smooth_deg=25)

    # sensor housing 70 (along the rim) x 40 (across) x 25 (tall) mm; valve end of the housing sits on the valve
    SENSOR_SEAM = C.material("sensor_seam", "#0b0d0f", roughness=0.9)
    SENSOR_LED = C.material("sensor_led", "#7dff5a", roughness=0.3, emissive="#7dff5a", emissive_strength=6.0)
    SA = VA + 0.026 / 0.277  # housing centre is 26 mm along the rim from the valve
    rot = Matrix.Rotation(SA - math.pi / 2, 4, "X")  # local: x across, y along rim, z = radial (out)
    centre = at(SA, 0.2765)
    FRAME = Matrix.Translation(centre) @ rot

    def local(bm_, c, size):
        C.box(bm_, c, size)  # built in the housing frame; moved with bm.transform(FRAME)

    shell_bm = bmesh.new()
    local(shell_bm, (0, 0, -0.0040), (0.040, 0.070, 0.017))  # lower housing
    local(shell_bm, (0, 0, 0.0075), (0.038, 0.066, 0.008))   # upper lid (slightly smaller -> seam step)
    shell_bm.transform(FRAME)
    sensor = C.new_object("tpms_sensor", shell_bm, SENSOR_SHELL, parent=rim, auto_smooth_deg=30)
    C.bevel_modifier(sensor, 0.0035, 3)

    seam_bm = bmesh.new()
    local(seam_bm, (0, 0, 0.0035), (0.0392, 0.0685, 0.0012))  # dark seam line between body and lid
    seam_bm.transform(FRAME)
    seam = C.new_object("tpms_seam_tmp", seam_bm, SENSOR_SEAM, parent=rim, smooth=False)

    screw_bm = bmesh.new()  # mounting screw through the housing into the valve
    C.cylinder(screw_bm, (0.0, -0.026, 0.0118), 0.0048, 0.003, segments=24, axis="Z")
    C.cylinder(screw_bm, (0.0, -0.026, 0.0136), 0.0040, 0.0016, segments=6, axis="Z")
    screw_bm.transform(FRAME)
    screw = C.new_object("tpms_screw_tmp", screw_bm, CHROME, parent=rim, auto_smooth_deg=20)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (seam, screw, sensor):
        o.select_set(True)
    bpy.context.view_layer.objects.active = sensor
    bpy.ops.object.join()
    sensor = bpy.data.objects["tpms_sensor"]

    band_bm = bmesh.new()  # EcoStream green accent band around the middle
    local(band_bm, (0, 0.010, -0.0005), (0.0408, 0.008, 0.0245))
    band_bm.transform(FRAME)
    band = C.new_object("tpms_sensor_band", band_bm, SENSOR_BAND, parent=sensor, smooth=False)

    led_bm = bmesh.new()  # status LED on the outboard face
    C.cylinder(led_bm, (0.0205, 0.024, -0.002), 0.0028, 0.002, segments=20, axis="X")
    led_bm.transform(FRAME)
    led = C.new_object("tpms_sensor_led", led_bm, SENSOR_LED, parent=sensor)

    return dict(tyre=tyre, rim=rim, hub=hub, lug_nuts=lug_nuts, valve_stem=valve, tpms_sensor=sensor, tpms_sensor_band=band, tpms_sensor_led=led)
