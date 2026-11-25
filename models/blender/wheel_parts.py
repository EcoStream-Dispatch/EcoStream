"""
Wheel geometry shared by wheel.py (the wheel assembly model) and truck.py (10 wheels).
build(seg, root) creates: tyre, rim, hub, lug_nuts, valve_stem, tpms_sensor (+ tpms_sensor_band),
all parented to `root` (an Empty at the wheel centre; wheel axis = X, outboard = +X).
The EcoStream sensor is a sealed valve-mounted housing only: no internals.
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
    # ---------- Materials (PBR, with micro-detail normal maps) ----------
    RUBBER = C.material("rubber", "#151619", roughness=0.86)
    C.add_noise_normal(RUBBER, "rubber_grain", scale=0.12, strength=0.22, tiles=14)
    TREAD = C.material("rubber_tread", "#18191c", roughness=0.8)
    C.add_noise_normal(TREAD, "rubber_grain", scale=0.12, strength=0.3, tiles=14)
    STEEL = C.material("rim_paint", "#c9cdd2", metallic=0.6, roughness=0.3, clearcoat=0.6)
    C.add_noise_normal(STEEL, "paint_peel", scale=0.02, strength=0.15, tiles=6)
    HUB_PAINT = C.material("hub_green", "#3E7231", metallic=0.35, roughness=0.35, clearcoat=0.7)
    CHROME = C.material("chrome", "#dfe3e7", metallic=1.0, roughness=0.22)
    C.add_brushed_normal(CHROME, "brushed", strength=0.35)
    ZINC = C.material("zinc_stud", "#a9adb1", metallic=1.0, roughness=0.4)
    VALVE = C.material("valve_brass", "#b08d57", metallic=0.95, roughness=0.28)
    SENSOR_SHELL = C.material("sensor_shell", "#1f2327", roughness=0.72)
    SENSOR_BAND = C.material("sensor_band", "#5C9A35", roughness=0.45, emissive="#5C9A35", emissive_strength=0.8)

    def bezier_profile(points, n=8):
        """Catmull-Rom through (r, x) control points -> smooth sampled profile."""
        out = []
        P = [points[0]] + points + [points[-1]]
        for i in range(1, len(P) - 2):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            for k in range(n):
                t = k / n
                t2, t3 = t * t, t * t * t
                out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                       + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
        out.append(points[-1])
        return out

    # ---------- Tyre carcass: smooth sidewall bulge, rounded shoulders ----------
    R_OUT = 0.522  # outer radius (1.044 m diameter, 295/80 R22.5)
    RB = 0.506  # carcass crown radius (tread blocks stand 16 mm proud)
    half = [(0.288, 0.104), (0.296, 0.121), (0.318, 0.134), (0.360, 0.145), (0.405, 0.1485), (0.448, 0.146),
            (0.482, 0.138), (0.499, 0.128), (0.505, 0.118)]
    side_out = bezier_profile(half, 6)  # bead -> shoulder, outboard (+x)
    crown = [(RB, -0.118 + i * 0.236 / 12) for i in range(1, 12)]
    # orientation: from inboard bead, up the inboard sidewall, across the crown, down the outboard side
    profile = [(0.288, -0.104)] + [(r, -x) for r, x in side_out][1:] + crown + [(r, x) for r, x in reversed(side_out)][:-1] \
        + [(0.288, 0.104), (0.288, -0.104)]
    tyre_bm = C.lathe(profile, SEG * 2, axis="X")
    # sidewall rib lines (moulded rings) near the rim and at the bulge
    for x_sign in (-1, 1):
        for rr, dx in ((0.318, 0.135), (0.452, 0.1465)):
            ring = C.lathe([(rr - 0.003, x_sign * dx), (rr, x_sign * (dx + 0.0018)), (rr + 0.003, x_sign * dx)], SEG * 2, axis="X")
            tmp = bmesh.new()
            me_tmp = bpy.data.meshes.new("tmp")
            ring.to_mesh(me_tmp)
            tyre_bm.from_mesh(me_tmp)
            bpy.data.meshes.remove(me_tmp)
            ring.free()
            tmp.free()
    tyre = C.new_object("tyre", tyre_bm, RUBBER, parent=root, auto_smooth_deg=50)
    C.uv_cylinder(tyre, 0.05)

    # ---------- Tread: directional drive-pattern blocks (5 rows, 52 pitches) ----------
    tread_bm = bmesh.new()
    PITCH = 52
    P = 2 * math.pi / PITCH

    def block(x0, x1, a0, a1, slope, top=R_OUT, base=RB - 0.004, taper=0.0015, crown_drop=0.0):
        """Prism standing on the crown: corners (x, angle); angle shifts with x (slope) for the directional look."""
        def ang(x, a):
            return a + slope * x
        corners = [(x0, a0), (x1, a0), (x1, a1), (x0, a1)]
        vb, vt = [], []
        cx, ca = (x0 + x1) / 2, (a0 + a1) / 2
        for x, a in corners:
            aa = ang(x, a)
            vb.append(tread_bm.verts.new((x, base * math.cos(aa), base * math.sin(aa))))
            # top face slightly smaller (draft) and dropping towards the shoulder
            xt = x + (cx - x) * 0.08
            at = ang(xt, a + (ca - a) * 0.08)
            rt = top - crown_drop * (abs(xt) / 0.122) ** 2
            vt.append(tread_bm.verts.new((xt, rt * math.cos(at), rt * math.sin(at))))
        tread_bm.faces.new(vt)
        tread_bm.faces.new(list(reversed(vb)))
        for i in range(4):
            j = (i + 1) % 4
            tread_bm.faces.new((vb[i], vb[j], vt[j], vt[i]))

    for i in range(PITCH):
        a = i * P
        for s in (-1, 1):
            # shoulder blocks with lateral grooves, slanted (directional)
            x0, x1 = (0.070, 0.124) if s > 0 else (-0.124, -0.070)
            block(x0, x1, a + 0.10 * P, a + 0.86 * P, slope=s * 1.2, crown_drop=0.006)
            # intermediate row: two siped halves, offset half a pitch
            x0, x1 = (0.030, 0.062) if s > 0 else (-0.062, -0.030)
            block(x0, x1, a + 0.55 * P, a + 1.00 * P, slope=s * 2.0, crown_drop=0.003)
            block(x0, x1, a + 1.04 * P, a + 1.42 * P, slope=s * 2.0, crown_drop=0.003)
        # centre rib: continuous-looking blocks with thin sipes
        block(-0.022, 0.022, a + 0.0 * P, a + 0.47 * P, slope=0.0)
        block(-0.022, 0.022, a + 0.51 * P, a + 0.97 * P, slope=0.0)
    bmesh.ops.recalc_face_normals(tread_bm, faces=tread_bm.faces)
    tread = C.new_object("tyre_tread_tmp", tread_bm, TREAD, auto_smooth_deg=30)
    C.uv_box(tread, 0.05)

    # ---------- Moulded sidewall lettering (generic size markings, no brand) ----------
    def sidewall_x(r):
        pts = [(rr, xx) for rr, xx in side_out]
        for (r0, x0), (r1, x1) in zip(pts, pts[1:]):
            if r0 <= r <= r1:
                return x0 + (x1 - x0) * (r - r0) / (r1 - r0)
        return pts[-1][1]

    def arc_text(body, r_t, size, top=True, spread=1.0):
        cu = bpy.data.curves.new("txt", "FONT")
        cu.body = body
        cu.size = size
        cu.extrude = 0.0012
        cu.offset = size * 0.018  # bolder strokes
        cu.align_x = "CENTER"
        cu.resolution_u = 3
        cu.space_character = spread
        ob = bpy.data.objects.new("txt", cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.curves.remove(cu)
        bm = bmesh.new()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        for v in bm.verts:
            tx, ty, tz = v.co
            ty -= size * 0.35
            if top:
                th, r = math.pi / 2 - tx / r_t, r_t + ty
            else:
                th, r = -math.pi / 2 + tx / r_t, r_t - ty
            x = sidewall_x(r) + 0.0016 + tz  # raised ~2.5 mm out of the sidewall
            v.co = Vector((x, r * math.cos(th), r * math.sin(th)))
        return bm

    letters = bmesh.new()
    for bm in (arc_text("295/80 R22.5", 0.415, 0.034, True, 1.15),
               arc_text("TUBELESS  RADIAL  152/148 M", 0.468, 0.016, True, 1.2),
               arc_text("MAX LOAD 3550 kg   MAX PRESS 830 kPa (120 PSI)", 0.468, 0.0135, False, 1.15),
               arc_text("REGROOVABLE", 0.33, 0.012, False, 1.4)):
        me = bpy.data.meshes.new("tmp")
        bm.to_mesh(me)
        bm.free()
        letters.from_mesh(me)
        bpy.data.meshes.remove(me)
    text_obj = C.new_object("tyre_text_tmp", letters, RUBBER, smooth=False)
    C.uv_box(text_obj, 0.05)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (tread, text_obj, tyre):
        o.select_set(True)
    bpy.context.view_layer.objects.active = tyre
    bpy.ops.object.join()
    tyre = bpy.data.objects["tyre"]

    # ---------- Rim: barrel with rolled flanges + dished disc, chamfered hand holes ----------
    rim_half = [(0.296, 0.112), (0.303, 0.108), (0.304, 0.102), (0.299, 0.097), (0.288, 0.094), (0.285, 0.064),
                (0.263, 0.040), (0.262, 0.0)]
    outer = bezier_profile(rim_half, 4)
    inner = [(r - 0.007, x - (0.004 if x > 0.09 else 0.0)) for r, x in outer]
    rim_profile = [(r, -x) for r, x in outer] + [(r, x) for r, x in reversed(outer)][1:] \
        + inner + [(r, -x) for r, x in reversed(inner)][1:] + [(outer[0][0], -outer[0][1])]
    rim_bm = C.lathe(rim_profile, SEG * 2, axis="X")
    disc_profile = [(0.258, 0.022), (0.235, 0.024), (0.20, 0.032), (0.186, 0.044), (0.15, 0.060), (0.112, 0.062),
                    (0.112, 0.050), (0.15, 0.048), (0.186, 0.032), (0.20, 0.020), (0.235, 0.012), (0.258, 0.010), (0.258, 0.022)]
    disc_bm = C.lathe(disc_profile, SEG * 2, axis="X")
    disc = C.new_object("rim_disc_tmp", disc_bm, STEEL)
    cutters = bmesh.new()
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        C.cylinder(cutters, (0.035, 0.218 * math.cos(a), 0.218 * math.sin(a)), 0.027, 0.12, segments=40, axis="X")
    for i in range(10):  # stud holes
        a = 2 * math.pi * i / 10
        C.cylinder(cutters, (0.05, 0.1675 * math.cos(a), 0.1675 * math.sin(a)), 0.0135, 0.12, segments=20, axis="X")
    cut = C.new_object("rim_cut_tmp", cutters, None, smooth=False)
    mod = disc.modifiers.new("Holes", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cut
    bpy.context.view_layer.objects.active = disc
    bpy.ops.object.modifier_apply(modifier="Holes")
    bpy.data.objects.remove(cut, do_unlink=True)
    rim = C.new_object("rim", rim_bm, STEEL, parent=root, auto_smooth_deg=40)
    bpy.ops.object.select_all(action="DESELECT")
    disc.select_set(True)
    rim.select_set(True)
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.join()
    rim = bpy.data.objects["rim"]
    rim.parent = root
    C.uv_box(rim, 0.15)
    C.finish(rim, 0.0012, 2)

    # ---------- Hub: flange, drum, domed cap with bolts ----------
    hub_bm = bmesh.new()
    C.cylinder(hub_bm, (0.045, 0, 0), 0.108, 0.012, segments=96, axis="X")  # flange behind the disc
    C.cylinder(hub_bm, (0.075, 0, 0), 0.098, 0.05, segments=96, axis="X", radius2=0.09)
    C.cylinder(hub_bm, (0.106, 0, 0), 0.072, 0.014, segments=96, axis="X", radius2=0.066)
    C.cylinder(hub_bm, (-0.03, 0, 0), 0.085, 0.07, segments=96, axis="X")
    cap = C.lathe([(0.0003, 0.135), (0.02, 0.1345), (0.04, 0.131), (0.055, 0.124), (0.062, 0.115), (0.062, 0.112), (0.0003, 0.112)], 96, axis="X")
    me_tmp = bpy.data.meshes.new("tmp")
    cap.to_mesh(me_tmp)
    cap.free()
    hub_bm.from_mesh(me_tmp)
    bpy.data.meshes.remove(me_tmp)
    hub = C.new_object("hub", hub_bm, HUB_PAINT, parent=root, auto_smooth_deg=30)
    C.uv_box(hub, 0.1)
    C.finish(hub, 0.003, 3)

    # ---------- Wheel nuts: flanged hex nuts on threaded studs (335 mm PCD) ----------
    nuts_bm = bmesh.new()
    studs_bm = bmesh.new()
    for i in range(10):
        a = 2 * math.pi * i / 10
        y, z = 0.1675 * math.cos(a), 0.1675 * math.sin(a)
        C.cylinder(nuts_bm, (0.0655, y, z), 0.0185, 0.004, segments=32, axis="X")  # washer face
        C.cylinder(nuts_bm, (0.081, y, z), 0.0165, 0.027, segments=6, axis="X")  # hex (32 mm A/F)
        C.cylinder(nuts_bm, (0.0955, y, z), 0.0125, 0.003, segments=24, axis="X", radius2=0.0105)  # chamfer
        C.cylinder(studs_bm, (0.1, y, z), 0.0095, 0.012, segments=16, axis="X")
        for k in range(4):  # thread rings
            C.cylinder(studs_bm, (0.0955 + k * 0.0032, y, z), 0.0101, 0.0012, segments=16, axis="X")
    lug_nuts = C.new_object("lug_nuts", nuts_bm, CHROME, parent=root, auto_smooth_deg=25)
    C.uv_box(lug_nuts, 0.03)
    C.finish(lug_nuts, 0.0011, 2)
    studs = C.new_object("lug_studs_tmp", studs_bm, ZINC, auto_smooth_deg=25)
    bpy.ops.object.select_all(action="DESELECT")
    studs.select_set(True)
    lug_nuts.select_set(True)
    bpy.context.view_layer.objects.active = lug_nuts
    bpy.ops.object.join()
    lug_nuts = bpy.data.objects["lug_nuts"]

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
