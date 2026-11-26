"""
Generic Indian 10-wheel tipper truck (cab-over), built for realism. No brand badges or logos.

    /Applications/Blender.app/Contents/MacOS/Blender --background --python models/blender/truck.py

Parts: cab (+ hinged doors), chassis (ladder frame, lamps, guards, exhaust, tanks), front axle,
rear tandem axles, 10 wheel assemblies (each with the sealed EcoStream tyre sensor), fuel tank,
battery box, tipper body, and the sealed EcoStream in-cab unit on the dashboard.

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
CAB = C.material("cab_paint", "#1d3b74", metallic=0.55, roughness=0.28, clearcoat=1.0)
C.add_noise_normal(CAB, "paint_peel", scale=0.02, strength=0.08)
WHITE = C.material("body_white", "#e9ebe6", metallic=0.15, roughness=0.38, clearcoat=0.6)
C.add_noise_normal(WHITE, "paint_peel", scale=0.02, strength=0.1)
GREEN = C.material("eco_green", "#3E7231", metallic=0.3, roughness=0.35, clearcoat=0.8)
GLASS = C.material("glass", "#0e1820", metallic=0.0, roughness=0.02, clearcoat=1.0)
SEAL = C.material("rubber_seal", "#0c0d0f", roughness=0.7)
TRIM = C.material("trim_dark", "#26292d", metallic=0.2, roughness=0.6)
FRAME = C.material("chassis_black", "#16181b", metallic=0.4, roughness=0.55)
C.add_noise_normal(FRAME, "paint_peel", scale=0.02, strength=0.15)
STEELG = C.material("steel_grey", "#80868d", metallic=0.85, roughness=0.38)
C.add_brushed_normal(STEELG, "brushed", strength=0.3)
CHROME_T = C.material("chrome_trim", "#e6e9ec", metallic=1.0, roughness=0.08)
ALU = C.material("aluminium", "#c4c9ce", metallic=0.95, roughness=0.3)
C.add_brushed_normal(ALU, "brushed", strength=0.3)
CHEQUER = C.material("chequer_plate", "#9aa0a6", metallic=0.95, roughness=0.32)
PLATE = C.material("plate_yellow", "#f2c230", roughness=0.45, clearcoat=0.5)
REFLECTOR = C.material("lamp_reflector", "#f4f6f8", metallic=1.0, roughness=0.05)
LENS = C.material("lamp_lens", "#f6fbff", roughness=0.02, transmission=1.0, ior=1.49)
HEAD = C.material("headlight_bulb", "#fff3d6", roughness=0.2, emissive="#fff3d6", emissive_strength=8.0)
AMBER = C.material("amber_lens", "#ff8f1a", roughness=0.08, emissive="#ff8f1a", emissive_strength=1.2, clearcoat=1.0)
RED = C.material("tail_red", "#c4141a", roughness=0.08, emissive="#e0141a", emissive_strength=1.2, clearcoat=1.0)
GRAVEL = C.material("gravel", "#8b8378", roughness=0.95)
C.add_noise_normal(GRAVEL, "gravel_grain", scale=0.25, strength=1.2)
RUBBER_FLAP = C.material("mudflap", "#111214", roughness=0.85)
UNIT = C.material("unit_shell", "#1f2327", roughness=0.7)
LED = C.material("unit_led", "#7dff5a", roughness=0.3, emissive="#7dff5a", emissive_strength=6.0)
BAND = C.material("unit_band", "#5C9A35", roughness=0.45, emissive="#5C9A35", emissive_strength=0.8)
SIGN = C.material("sign_paint", "#c42e2a", roughness=0.4, clearcoat=0.6)


# ---------- geometry helpers ----------
def bx(center, size, rot=None):
    bm = bmesh.new()
    C.box(bm, center, size, rot=rot)
    return bm


def cyl(center, r, depth, axis="X", seg=32, r2=None):
    bm = bmesh.new()
    C.cylinder(bm, center, r, depth, segments=seg, axis=axis, radius2=r2)
    return bm


def prism(profile, x0, x1):
    """Extrude a closed (y, z) polygon across X from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
    n = len(profile)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def prism_y(profile, y0, y1):
    """Extrude a closed (x, z) polygon along Y from y0 to y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in profile]
    b = [bm.verts.new((x, y1, z)) for x, z in profile]
    n = len(profile)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def tube(points, r, seg=14, cap=True):
    """Sweep a circle of radius r along a polyline (grab handles, mirror arms, wipers, pipes)."""
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        n1 = t.cross(up).normalized()
        n2 = t.cross(n1).normalized()
        rings.append([bm.verts.new(p + (n1 * math.cos(2 * math.pi * k / seg) + n2 * math.sin(2 * math.pi * k / seg)) * r)
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def lathe_at(profile, center, axis, seg=32):
    """Revolve [(r, t)] about an axis through center ('X', 'Y' or 'Z')."""
    bm = C.lathe(profile, seg, axis="X")
    rot = {"X": Matrix.Identity(4), "Y": Matrix.Rotation(math.pi / 2, 4, "Z"), "Z": Matrix.Rotation(-math.pi / 2, 4, "Y")}[axis]
    bm.transform(Matrix.Translation(Vector(center)) @ rot)
    return bm


def leaf_spring(cx, cy, cz, length, n=6, camber=0.05, width=0.075, t=0.012):
    """Stacked, curved spring leaves (longest on top), with an eye at each end of the main leaf."""
    bm = bmesh.new()
    for i in range(n):
        L = length * (1 - i * 0.13)
        steps = 16
        z_off = -i * (t + 0.002)
        prof = []
        for k in range(steps + 1):
            u = -1 + 2 * k / steps
            prof.append((cy + u * L / 2, cz + z_off + camber * (1 - u * u)))
        top = [(y, z + t / 2) for y, z in prof]
        bot = [(y, z - t / 2) for y, z in reversed(prof)]
        part = prism_y_profile(top + bot, cx - width / 2, cx + width / 2)
        merge(bm, part)
    for s in (-1, 1):
        merge(bm, cyl((cx, cy + s * length / 2, cz + t / 2), 0.022, width + 0.01, axis="X", seg=16))
    # U-bolts and seat
    merge(bm, bx((cx, cy, cz + camber + t * 1.5), (width + 0.03, 0.14, 0.03)))
    for s in (-1, 1):
        merge(bm, bx((cx + s * (width / 2 + 0.012), cy, cz + camber - 0.03), (0.016, 0.02, 0.17)))
    return bm


def rounded(bm, width, segments=3, min_angle=25):
    """Bevel the sharp edges of a bmesh in place (heavy rounding for body panels)."""
    bm.normal_update()
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(min_angle)]
    bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=segments, profile=0.5, affect="EDGES",
                    clamp_overlap=True)
    return bm


def prism_y_profile(profile_yz, x0, x1):
    return prism(profile_yz, x0, x1)


def merge(dst, src):
    me = bpy.data.meshes.new("tmp_merge")
    src.to_mesh(me)
    src.free()
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)


def flat_text(body, size, extrude=0.002, spacing=1.0):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.resolution_u = 3
    cu.space_character = spacing
    cu.offset = size * 0.03
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return bm


def mk(name, pieces, parent=None, bevel=None, smooth_deg=35, uv=0.25, bevel_segments=2, finish=False):
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
    C.uv_box(obj, uv)
    if finish:
        C.finish(obj, bevel or 0.004, bevel_segments)
    elif bevel:
        C.bevel_modifier(obj, bevel, bevel_segments)
    if parent:
        obj.parent = parent
    return obj


def set_origin(obj, p):
    p = Vector(p)
    obj.data.transform(Matrix.Translation(-p))
    obj.location = p


root = bpy.data.objects.new("truck", None)
bpy.context.scene.collection.objects.link(root)
R = 0.522  # wheel radius
FY, RY1, RY2 = 3.0, -1.6, -2.95  # axle positions (y)

# ======================================================================
# Chassis: C-section ladder frame, cross members, guards, lamps, exhaust, air tanks
# ======================================================================
pieces = []
for sx in (-1, 1):
    # C-channel rail: web 260 mm, flanges 80 mm, 8 mm steel; open side faces inward
    xo = sx * 0.49
    xi = sx * 0.41
    w = 0.008
    c_prof = [(xo, 0.92), (xi, 0.92), (xi, 0.92 + w), (xo - sx * w, 0.92 + w), (xo - sx * w, 1.18 - w), (xi, 1.18 - w),
              (xi, 1.18), (xo, 1.18)]
    pieces.append((prism_y(c_prof, -4.05, 4.0), FRAME))
for y in (3.75, 2.25, 0.75, -0.5, -2.27, -3.9):
    pieces.append((cyl((0, y, 1.05), 0.045, 0.84, axis="X", seg=20), FRAME))  # tubular cross members
    for sx in (-1, 1):
        pieces.append((bx((sx * 0.37, y, 1.05), (0.06, 0.16, 0.2)), FRAME))  # gussets
# rear mudguards (curved sheet over each axle pair) + mudflaps
for sx in (-1, 1):
    arc = []
    for k in range(25):
        a = math.radians(-8 + 196 * k / 24)
        arc.append((-2.27 + 1.55 * math.cos(a) * 1.0, 0.52 + 0.62 * math.sin(a)))
    arc_top = [(y, max(z, 0.9)) for y, z in arc]
    sheet = [(y, z) for y, z in arc_top]
    inner = [(y * 0.999 + (-2.27) * 0.001, z - 0.006) for y, z in reversed(sheet)]
    pieces.append((prism(sheet + inner, sx * 0.56, sx * 1.22) if sx > 0 else prism(sheet + inner, sx * 1.22, sx * 0.56), TRIM))
    pieces.append((bx((sx * 0.89, -3.62, 0.62), (0.62, 0.012, 0.6)), RUBBER_FLAP))
    pieces.append((bx((sx * 0.89, 2.25, 0.66), (0.42, 0.012, 0.5)), RUBBER_FLAP))  # front flaps behind front wheels
    # side under-run guard rails between front and rear wheels
    for z in (0.62, 0.86):
        pieces.append((bx((sx * 1.12, 0.35, z), (0.03, 2.6, 0.06)), STEELG))
    for y in (-0.8, 0.35, 1.5):
        pieces.append((bx((sx * 1.0, y, 0.8), (0.24, 0.04, 0.04)), STEELG))
    # rear lamp cluster: red tail, amber indicator, reflector
    pieces.append((bx((sx * 0.98, -4.08, 0.98), (0.34, 0.05, 0.14)), TRIM))
    pieces.append((bx((sx * 0.9, -4.11, 0.98), (0.12, 0.02, 0.1)), RED))
    pieces.append((bx((sx * 1.06, -4.11, 0.98), (0.1, 0.02, 0.1)), AMBER))
pieces.append((bx((0, -4.12, 0.62), (2.3, 0.1, 0.12)), STEELG))  # rear under-run bar
for sx in (-1, 1):
    pieces.append((bx((sx * 0.8, -4.08, 0.8), (0.06, 0.06, 0.34)), STEELG))
pieces.append((bx((0.0, -4.13, 0.86), (0.5, 0.015, 0.16)), PLATE))  # blank rear plate
# exhaust: muffler under the frame + vertical stack behind the cab with a heat shield
pieces.append((lathe_at([(0.0005, -0.4), (0.13, -0.39), (0.14, -0.35), (0.14, 0.35), (0.13, 0.39), (0.0005, 0.4)], (0.72, 1.9, 0.82), "Y", 32), STEELG))
pieces.append((tube([(0.72, 1.5, 0.82), (0.72, 1.35, 0.95), (0.85, 1.95, 1.3), (0.85, 1.95, 3.25)], 0.055, 18), STEELG))
pieces.append((lathe_at([(0.075, 2.0), (0.075, 2.9)], (0.85, 1.95, 0.0), "Z", 24), CHROME_T))
# air tanks (domed ends) on the right rail
for y in (-0.35, 0.35):
    pieces.append((lathe_at([(0.0005, -0.36), (0.07, -0.35), (0.11, -0.3), (0.12, -0.24), (0.12, 0.24), (0.11, 0.3), (0.07, 0.35), (0.0005, 0.36)],
                            (0.62, y - 0.5, 0.78), "Y", 28), STEELG))
# tipper ram (closed), in front of the body
pieces.append((cyl((0.0, 1.78, 1.55), 0.1, 0.7, axis="Z", seg=32), CHROME_T))
pieces.append((cyl((0.0, 1.78, 1.18), 0.13, 0.12, axis="Z", seg=32), FRAME))
chassis = mk("chassis", pieces, parent=root, bevel=0.004, finish=True)

# ======================================================================
# Axles with leaf springs
# ======================================================================
pieces = []
beam = [(-0.82, R + 0.06), (-0.55, R + 0.06), (-0.4, R - 0.05), (0.4, R - 0.05), (0.55, R + 0.06), (0.82, R + 0.06),
        (0.82, R - 0.06), (0.55, R - 0.06), (0.4, R - 0.15), (-0.4, R - 0.15), (-0.55, R - 0.06), (-0.82, R - 0.06)]
pieces.append((prism_y([(x, z) for x, z in beam], FY - 0.05, FY + 0.05), FRAME))  # dropped I-beam
for sx in (-1, 1):
    pieces.append((cyl((sx * 0.86, FY, R), 0.06, 0.12, axis="Z", seg=20), FRAME))  # kingpin
    pieces.append((cyl((sx * 0.78, FY, R), 0.19, 0.16, axis="X", seg=40), FRAME))  # brake drum
    pieces.append((leaf_spring(sx * 0.45, FY, R + 0.12, 1.45, n=6), STEELG))
    for y in (FY - 0.72, FY + 0.72):
        pieces.append((bx((sx * 0.45, y, 0.98), (0.09, 0.08, 0.2)), FRAME))  # hangers
pieces.append((tube([(-0.7, FY - 0.2, R), (0.0, FY - 0.28, R - 0.02), (0.7, FY - 0.2, R)], 0.022, 12), STEELG))  # tie rod
front_axle = mk("front_axle", pieces, parent=root, bevel=0.003, finish=True)

pieces = []
for y in (RY1, RY2):
    pieces.append((lathe_at([(0.06, -0.85), (0.075, -0.7), (0.09, -0.3), (0.0, -0.3)], (0, y, R), "X", 24), FRAME))
    pieces.append((lathe_at([(0.0, 0.3), (0.09, 0.3), (0.075, 0.7), (0.06, 0.85)], (0, y, R), "X", 24), FRAME))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.24,
                              matrix=Matrix.Translation((0, y, R)) @ Matrix.Diagonal((1.25, 0.95, 1.0, 1.0)))
    pieces.append((bm, FRAME))  # banjo housing
    pieces.append((cyl((0, y + 0.23, R), 0.12, 0.08, axis="Y", seg=32), STEELG))  # diff cover
    pieces.append((cyl((0, y + 0.34, R), 0.06, 0.2, axis="Y", seg=20), STEELG))  # pinion
    for sx in (-1, 1):
        pieces.append((cyl((sx * 0.74, y, R), 0.2, 0.16, axis="X", seg=40), FRAME))  # brake drums
for sx in (-1, 1):
    pieces.append((leaf_spring(sx * 0.45, (RY1 + RY2) / 2, R + 0.14, 1.75, n=8, camber=-0.03), STEELG))  # bogie
    pieces.append((cyl((sx * 0.45, (RY1 + RY2) / 2, R + 0.1), 0.07, 0.2, axis="X", seg=24), FRAME))  # trunnion
pieces.append((tube([(0, -0.5, 0.86), (0, (RY1) + 0.4, R + 0.02)], 0.045, 16), STEELG))  # prop shafts
pieces.append((tube([(0, RY1 - 0.4, R + 0.02), (0, RY2 + 0.4, R + 0.02)], 0.04, 16), STEELG))
rear_axles = mk("rear_axles", pieces, parent=root, bevel=0.003, finish=True)

# ======================================================================
# Fuel tank (left) with straps, battery box (right)
# ======================================================================
tank_prof = [(1.2 - 0.55 + 0.0, 0.62), (1.2 + 0.55, 0.62), (1.2 + 0.55, 1.08), (1.2 - 0.55, 1.08)]
tank = rounded(prism([(y, z) for y, z in tank_prof], -1.05, -0.56), 0.09, 6)
pieces = [(tank, ALU)]
for y in (0.9, 1.5):
    pieces.append((bx((-0.8, y, 0.85), (0.51, 0.04, 0.5)), FRAME))  # straps
pieces.append((cyl((-0.92, 1.45, 1.1), 0.05, 0.04, axis="Z", seg=24), CHROME_T))  # filler cap
fuel = mk("fuel_tank", pieces, parent=root, bevel=0.004, bevel_segments=2)

pieces = [(bx((0.8, 1.2, 0.84), (0.44, 0.78, 0.44)), TRIM), (bx((0.8, 1.2, 1.075), (0.46, 0.8, 0.025)), CHEQUER)]
for y in (0.95, 1.45):
    pieces.append((bx((1.025, y, 0.84), (0.01, 0.05, 0.46)), FRAME))
battery = mk("battery_box", pieces, parent=root, bevel=0.012, finish=True)

# ======================================================================
# Cab: extruded side profile (raked windscreen), heavy bevels = rounded panels
# ======================================================================
CY0, CY1, CW = 2.2, 4.22, 1.2
side = [(CY0, 1.06), (CY1, 1.06), (CY1 + 0.02, 1.5), (CY1, 2.12), (CY1 - 0.24, 3.16), (CY1 - 0.34, 3.3), (CY0 + 0.04, 3.3),
        (CY0, 3.22)]
shell = rounded(prism(side, -CW, CW), 0.07, 5)
pieces = [(shell, CAB)]
# windscreen: rubber gasket + glass on the raked plane
p0, p1 = Vector((0, CY1, 2.12)), Vector((0, CY1 - 0.24, 3.16))
up = (p1 - p0).normalized()
nrm = Vector((0, up.z, -up.y))  # outward normal of the windscreen plane
mid = (p0 + p1) / 2
ws_rot = Matrix.Rotation(math.atan2(-up.y, up.z), 4, "X")
pieces.append((bx(mid + nrm * 0.006, (2 * CW - 0.12, 0.02, (p1 - p0).length - 0.06), rot=ws_rot), SEAL))
glass_ws = bx(mid + nrm * 0.014, (2 * CW - 0.2, 0.012, (p1 - p0).length - 0.14), rot=ws_rot)
pieces.append((glass_ws, GLASS))
# centre pillar between the two screens
pieces.append((bx(mid + nrm * 0.02, (0.05, 0.01, (p1 - p0).length - 0.12), rot=ws_rot), SEAL))
# wipers (parked at the bottom of the screen)
for sx in (-0.55, 0.45):
    base = p0 + nrm * 0.03 + up * 0.06
    pieces.append((tube([(sx, base.y, base.z), (sx + 0.55, base.y - up.y * 0.08, base.z + up.z * 0.08)], 0.008, 8), SEAL))
# front panel: grille surround, slats, lamps, bumper
pieces.append((bx((0, CY1 + 0.025, 1.73), (1.5, 0.03, 0.56)), TRIM))  # grille recess frame
for i in range(6):
    pieces.append((bx((0, CY1 + 0.045, 1.51 + i * 0.088), (1.38, 0.035, 0.04)), CHROME_T if i % 2 == 0 else TRIM))
pieces.append((bx((0, CY1 + 0.03, 2.07), (2 * CW - 0.1, 0.03, 0.06)), GREEN))  # green line under the screen
# bumper: steel profile, wraps the corners, with fog lamps and a blank plate
bump_prof = [(CY1 - 0.05, 0.98), (CY1 + 0.2, 0.98), (CY1 + 0.26, 1.06), (CY1 + 0.26, 1.3), (CY1 + 0.2, 1.38), (CY1 - 0.05, 1.38)]
pieces.append((prism(bump_prof, -CW - 0.06, CW + 0.06), TRIM))
pieces.append((bx((0, CY1 + 0.265, 1.18), (0.52, 0.012, 0.13)), PLATE))
pieces.append((bx((0, CY1 + 0.27, 1.06), (2 * CW, 0.01, 0.02)), CHROME_T))  # bumper strip
pieces.append((bx((0, CY1 + 0.01, 0.98), (1.2, 0.2, 0.06)), FRAME))  # tow hook plate
# roof: sun visor + amber marker lamps + air horns
pieces.append((bx((0, CY1 - 0.28, 3.37), (2 * CW - 0.06, 0.32, 0.03)), CAB))
for i in range(5):
    pieces.append((cyl((-0.6 + i * 0.3, CY1 - 0.15, 3.385), 0.035, 0.03, axis="Z", seg=20, r2=0.02), AMBER))
for sx in (-0.3, 0.3):
    pieces.append((lathe_at([(0.015, 0.0), (0.02, 0.3), (0.06, 0.42), (0.065, 0.43)], (sx, CY1 - 0.9, 3.36), "Y", 20), CHROME_T))
# rear quarter windows, back window
for sx in (-1, 1):
    pieces.append((bx((sx * (CW + 0.004), 2.58, 2.72), (0.01, 0.5, 0.52)), SEAL))
    pieces.append((bx((sx * (CW + 0.008), 2.58, 2.72), (0.008, 0.44, 0.46)), GLASS))
pieces.append((bx((0, CY0 - 0.004, 2.75), (0.9, 0.01, 0.4)), SEAL))
pieces.append((bx((0, CY0 - 0.008, 2.75), (0.84, 0.008, 0.34)), GLASS))
# grab handles beside the doors, steps (two treads) with chequer plate
for sx in (-1, 1):
    x = sx * (CW + 0.04)
    pieces.append((tube([(x - sx * 0.04, 4.1, 1.5), (x, 4.1, 1.55), (x, 4.1, 2.4), (x - sx * 0.04, 4.1, 2.45)], 0.016, 12), CHROME_T))
    pieces.append((tube([(x - sx * 0.04, 2.85, 1.6), (x, 2.85, 1.65), (x, 2.85, 2.5), (x - sx * 0.04, 2.85, 2.55)], 0.016, 12), CHROME_T))
    for z, d in ((0.58, 0.28), (0.86, 0.2)):
        pieces.append((bx((sx * (CW - 0.1), 3.5, z), (d, 0.62, 0.025)), CHEQUER))
        pieces.append((bx((sx * (CW - 0.1 + d / 2), 3.5, z - 0.05), (0.015, 0.62, 0.1)), FRAME))
    pieces.append((bx((sx * 1.04, 3.0, 1.1), (0.36, 1.25, 0.03)), TRIM))  # front wheel arch lip
    pieces.append((bx((sx * (CW + 0.003), 2.62, 1.86), (0.012, 0.75, 0.1)), GREEN))  # side stripe behind door
# dashboard + steering wheel inside the cab (seen in the see-through view)
pieces.append((bx((0, 3.95, 2.05), (2.25, 0.4, 0.32)), TRIM))
pieces.append((lathe_at([(0.19, -0.015), (0.2, 0.0), (0.19, 0.015), (0.18, 0.0)], (-0.55, 3.72, 2.32), "Y", 40), SEAL))
cab = mk("cab", pieces, parent=root, bevel=0.004, bevel_segments=2, smooth_deg=40)

# Headlamps: chrome bezel, parabolic reflectors, bulbs, clear lens (glass with transmission)
lamp_pieces = []
for sx in (-1, 1):
    for k, xo in enumerate((0.86, 1.04)):
        c = Vector((sx * xo, CY1 + 0.03, 1.62))
        lamp_pieces.append((lathe_at([(0.0005, -0.06), (0.03, -0.055), (0.06, -0.035), (0.08, 0.0), (0.085, 0.02), (0.075, 0.02),
                                      (0.068, 0.002), (0.05, -0.03), (0.02, -0.045), (0.0005, -0.05)], c, "Y", 40), REFLECTOR))
        lamp_pieces.append((lathe_at([(0.0005, 0.03), (0.04, 0.028), (0.075, 0.02), (0.088, 0.014), (0.088, 0.02), (0.0005, 0.036)], c, "Y", 40), LENS))
        lamp_pieces.append((cyl(c + Vector((0, -0.01, 0)), 0.012, 0.02, axis="Y", seg=16), HEAD))
        lamp_pieces.append((lathe_at([(0.088, 0.012), (0.1, 0.014), (0.1, 0.03), (0.088, 0.03)], c, "Y", 40), CHROME_T))
    # indicator + fog lamp
    lamp_pieces.append((bx((sx * 1.1, CY1 + 0.04, 1.86), (0.16, 0.04, 0.07)), AMBER))
    lamp_pieces.append((lathe_at([(0.0005, 0.0), (0.05, 0.0), (0.055, 0.02), (0.0005, 0.028)], (sx * 0.85, CY1 + 0.262, 1.2), "Y", 32), LENS))
    lamp_pieces.append((cyl((sx * 0.85, CY1 + 0.255, 1.2), 0.056, 0.02, axis="Y", seg=32), CHROME_T))
lamps = mk("cab_lamps_tmp", lamp_pieces, smooth_deg=60)
# mirrors: tubular arms + rounded housings + glass
mirror_pieces = []
for sx in (-1, 1):
    x0 = sx * CW
    mirror_pieces.append((tube([(x0, CY1 - 0.1, 2.25), (x0 + sx * 0.2, CY1 - 0.05, 2.3), (x0 + sx * 0.3, CY1 - 0.02, 2.45),
                                (x0 + sx * 0.3, CY1 - 0.02, 3.0), (x0 + sx * 0.05, CY1 - 0.2, 3.1)], 0.017, 12), CHROME_T))
    mirror_pieces.append((bx((x0 + sx * 0.33, CY1 - 0.06, 2.72), (0.06, 0.24, 0.46)), SEAL))
    mirror_pieces.append((bx((x0 + sx * 0.33, CY1 - 0.18, 2.72), (0.05, 0.012, 0.42)), GLASS))
    mirror_pieces.append((bx((x0 + sx * 0.34, CY1 - 0.04, 2.38), (0.05, 0.16, 0.16)), SEAL))  # wide-angle mirror
mirrors = mk("cab_mirrors_tmp", mirror_pieces, bevel=0.012, bevel_segments=3)
for o in (lamps, mirrors):
    o.select_set(False)
bpy.ops.object.select_all(action="DESELECT")
for o in (lamps, mirrors, cab):
    o.select_set(True)
bpy.context.view_layer.objects.active = cab
bpy.ops.object.join()
cab = bpy.data.objects["cab"]

# ---------- Doors (origin on the hinge at the front edge), with seal outline and window ----------
DY0, DY1 = 2.98, 4.02
for side_name, sx in (("left", -1), ("right", 1)):
    x = sx * (CW + 0.018)
    door_prof = [(DY0, 1.12), (DY1, 1.12), (DY1, 2.15), (DY1 - 0.18, 3.08), (DY0, 3.08)]
    pieces = [(rounded(prism(door_prof, x - 0.018, x + 0.018), 0.014, 3), CAB)]
    seal_prof = [(DY0 - 0.012, 1.108), (DY1 + 0.012, 1.108), (DY1 + 0.012, 2.15), (DY1 - 0.17, 3.092), (DY0 - 0.012, 3.092)]
    pieces.append((prism(seal_prof, x - sx * 0.012 - 0.006, x - sx * 0.012 + 0.006), SEAL))
    win = [(DY0 + 0.07, 2.32), (DY1 - 0.07, 2.32), (DY1 - 0.07, 2.2), (DY1 - 0.22, 3.0), (DY0 + 0.07, 3.0)]
    win = [(DY0 + 0.07, 2.3), (DY1 - 0.06, 2.3), (DY1 - 0.21, 3.0), (DY0 + 0.07, 3.0)]
    pieces.append((prism(win, x + sx * 0.019 - 0.004, x + sx * 0.019 + 0.004), SEAL))
    win_g = [(y + (0.02 if i in (0, 3) else -0.02), z + (0.02 if i < 2 else -0.02)) for i, (y, z) in enumerate(win)]
    pieces.append((prism(win_g, x + sx * 0.024 - 0.003, x + sx * 0.024 + 0.003), GLASS))
    pieces.append((bx((x + sx * 0.02, (DY0 + DY1) / 2, 1.86), (0.008, DY1 - DY0 - 0.02, 0.1)), GREEN))
    pieces.append((bx((x + sx * 0.03, DY0 + 0.16, 2.18), (0.025, 0.2, 0.045)), CHROME_T))  # handle
    pieces.append((bx((x + sx * 0.026, DY0 + 0.16, 2.12), (0.01, 0.04, 0.03)), SEAL))  # key lock
    for z in (1.5, 2.6):
        pieces.append((cyl((x + sx * 0.005, DY1 + 0.02, z), 0.016, 0.12, axis="Z", seg=16), FRAME))  # hinges
    door = mk(f"door_{side_name}", pieces, bevel=0.003, bevel_segments=2, smooth_deg=40)
    set_origin(door, (x, DY1 + 0.02, 2.1))
    door.parent = cab

# ======================================================================
# Tipper body (origin on the rear hinge)
# ======================================================================
TY0, TY1, TW, FZ, WZ = -4.1, 1.9, 1.25, 1.38, 2.6
pieces = [
    (bx((0, (TY0 + TY1) / 2, FZ), (2 * TW, TY1 - TY0, 0.1)), WHITE),  # floor
    (bx((0, TY1 - 0.04, (FZ + WZ + 0.35) / 2), (2 * TW, 0.08, WZ + 0.35 - FZ)), WHITE),  # headboard
]
# canopy over the cab, raked
pieces.append((prism([(TY1 - 0.06, WZ + 0.3), (TY1 + 0.55, WZ + 0.36), (TY1 + 0.55, WZ + 0.4), (TY1 - 0.06, WZ + 0.36)], -TW, TW), WHITE))
for k in range(5):  # headboard vertical stiffeners
    pieces.append((bx((-0.9 + k * 0.45, TY1 + 0.02, (FZ + WZ) / 2 + 0.1), (0.08, 0.05, WZ - FZ + 0.1)), WHITE))
# tailgate (top-hinged) with horizontal ribs and the classic painted sign
pieces.append((bx((0, TY0 + 0.04, (FZ + WZ) / 2), (2 * TW, 0.07, WZ - FZ)), WHITE))
for z in (1.7, 2.1, 2.5):
    pieces.append((bx((0, TY0 - 0.005, z), (2 * TW - 0.1, 0.05, 0.07)), WHITE))
for sx in (-1, 1):
    pieces.append((cyl((sx * (TW - 0.15), TY0 - 0.02, WZ + 0.02), 0.03, 0.18, axis="X", seg=16), FRAME))  # gate hinges
    pieces.append((bx((sx * (TW - 0.05), TY0 - 0.03, 1.55), (0.06, 0.06, 0.16)), FRAME))  # latches
sign = flat_text("HORN OK PLEASE", 0.15, extrude=0.003, spacing=1.1)
# text x -> world +X (reads left to right from behind), text y -> up, text normal -> -Y (faces backwards)
sign.transform(Matrix(((1, 0, 0, 0), (0, 0, -1, TY0 - 0.036), (0, 1, 0, 1.9), (0, 0, 0, 1))))
pieces.append((sign, SIGN))
for sx in (-1, 1):
    pieces.append((bx((sx * 0.45, (TY0 + TY1) / 2, FZ - 0.1), (0.12, TY1 - TY0 - 0.1, 0.12)), FRAME))  # subframe
    pieces.append((bx((sx * (TW - 0.03), (TY0 + TY1) / 2, (FZ + WZ) / 2), (0.06, TY1 - TY0, WZ - FZ)), WHITE))  # side walls
    pieces.append((bx((sx * (TW + 0.006), (TY0 + TY1) / 2, 2.27), (0.02, TY1 - TY0 - 0.25, 0.16)), GREEN))
    pieces.append((bx((sx * (TW + 0.006), (TY0 + TY1) / 2, 2.07), (0.02, TY1 - TY0 - 0.25, 0.05)), GREEN))
    pieces.append((tube([(sx * (TW + 0.02), TY0, WZ), (sx * (TW + 0.02), TY1, WZ)], 0.045, 16), WHITE))  # top rail
    pieces.append((bx((sx * (TW + 0.02), (TY0 + TY1) / 2, FZ + 0.02), (0.07, TY1 - TY0, 0.12)), WHITE))  # bottom rail
    for i in range(9):  # tapered hat-section ribs
        y = TY0 + 0.35 + i * (TY1 - TY0 - 0.7) / 8
        rib = [(y - 0.06, FZ), (y + 0.06, FZ), (y + 0.035, WZ), (y - 0.035, WZ)]
        pieces.append((prism(rib, sx * TW, sx * (TW + 0.05)) if sx > 0 else prism(rib, sx * (TW + 0.05), sx * TW), WHITE))
    pieces.append((cyl((sx * 0.45, TY0 + 0.05, FZ - 0.12), 0.05, 0.16, axis="X", seg=20), STEELG))  # rear hinge pins
# gravel load
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=40, y_segments=80, size=1.0)
for v in bm.verts:
    u, w = v.co.x, v.co.y
    h = 0.34 * (1 - u * u) * (1 - 0.55 * w * w) + 0.035 * math.sin(11 * u + 7 * w) + 0.025 * math.cos(17 * w + 3 * u) \
        + 0.012 * math.sin(41 * u * w)
    v.co = Vector((u * (TW - 0.07), (TY0 + TY1) / 2 + w * ((TY1 - TY0) / 2 - 0.1), 2.05 + h))
pieces.append((bm, GRAVEL))
tipper = mk("tipper_body", pieces, parent=root, bevel=0.006, bevel_segments=2, smooth_deg=35)
set_origin(tipper, (0, TY0, FZ - 0.08))

# ======================================================================
# EcoStream in-cab unit: sealed generic box on the dashboard (rides with the cab)
# ======================================================================
U = Vector((0.42, 3.92, 2.25))
unit = mk("in_cab_unit", [(bx(U, (0.2, 0.12, 0.06)), UNIT), (bx(U + Vector((0, 0.03, -0.045)), (0.12, 0.06, 0.03)), TRIM)],
          parent=cab, bevel=0.012, bevel_segments=3)
mk("in_cab_unit_band", [(bx(U, (0.205, 0.016, 0.062)), BAND)], parent=unit)
mk("in_cab_unit_led", [(cyl(U + Vector((0.07, -0.061, 0.012)), 0.006, 0.004, axis="Y", seg=20), LED)], parent=unit)

# ======================================================================
# Wheels: one master wheel, shared mesh data for all 10
# ======================================================================
master = bpy.data.objects.new("wheel_master", None)
bpy.context.scene.collection.objects.link(master)
wheel_parts.build(64, master)


def apply_mods(o):
    """Bake modifiers so all 10 wheels can share one mesh (the exporter instances shared meshes)."""
    if o.type == "MESH" and o.modifiers:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    for ch in o.children:
        apply_mods(ch)


apply_mods(master)


def copy_tree(src, parent, prefix):
    o = src.copy()  # shares mesh data (instanced in the glTF)
    o.name = f"{prefix}_{src.name}"
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    for ch in src.children:
        copy_tree(ch, o, prefix)
    return o


WHEELS = [
    ("wheel_fl", -1.03, FY), ("wheel_fr", 1.03, FY),
    ("wheel_r1lo", -1.03, RY1), ("wheel_r1li", -0.72, RY1), ("wheel_r1ri", 0.72, RY1), ("wheel_r1ro", 1.03, RY1),
    ("wheel_r2lo", -1.03, RY2), ("wheel_r2li", -0.72, RY2), ("wheel_r2ri", 0.72, RY2), ("wheel_r2ro", 1.03, RY2),
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

# ======================================================================
# Metadata
# ======================================================================
L = [-1, 0, 0]
Rt = [1, 0, 0]
SENSOR_TXT = ("Sealed EcoStream sensor inside each of the 10 tyres. Reads tyre pressure and temperature and "
              "radios them to the in-cab unit.")
parts = [
    dict(id="chassis", label="Chassis frame", group="truck", order=1, explode=[0, 0, 0], distance=0.0,
         description="C-section steel ladder frame with cross members, guards, lamps, exhaust, air tanks and the tipper ram."),
    dict(id="front_axle", label="Front axle", group="truck", order=2, explode=[0, -1, 0], distance=0.45,
         description="Dropped I-beam steering axle on multi-leaf springs, with brake drums and tie rod."),
    dict(id="rear_axles", label="Rear tandem axles", group="truck", order=2, explode=[0, -1, 0], distance=0.45,
         description="Two driven axles with differentials and brake drums, on a shared spring bogie."),
    dict(id="wheel_fl", label="Front wheels (2)", group="wheel", order=3, explode=L, distance=1.0,
         description="Single front tyres. Each one carries an EcoStream tyre sensor.", hotspot=C.to_gltf((-1.2, FY, 0.9))),
    dict(id="wheel_fr", label="Front wheels (2)", group="wheel", order=3, explode=Rt, distance=1.0, partOf="wheel_fl",
         description=""),
]
first_rear = True
for wid, x, y in WHEELS[2:]:
    inner = wid.endswith("i")
    p = dict(id=wid, label="Rear wheels (8)", group="wheel", order=3, explode=L if x < 0 else Rt,
             distance=0.75 if inner else 1.2, description="Twin tyres on both rear axles. Each tyre has its own EcoStream sensor.")
    if first_rear:
        p["hotspot"] = C.to_gltf((-1.2, (RY1 + RY2) / 2, 0.9))
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
         description="Aluminium diesel tank on straps on the left frame rail."),
    dict(id="battery_box", label="Battery box", group="truck", order=4, explode=Rt, distance=0.9,
         description="Two 12 V batteries under a chequer-plate lid; the in-cab unit runs from these."),
    dict(id="cab", label="Cab", group="truck", order=5, explode=[0, 0.55, -0.83], distance=1.6,
         description="Cab-over steel cab with raked windscreen, twin headlamps, mirrors and steps. No badges: a generic truck."),
    dict(id="door_left", label="Left door", group="truck", order=6, explode=L, distance=0.6,
         description="Hinged at the front edge."),
    dict(id="door_right", label="Right door", group="truck", order=6, explode=Rt, distance=0.6,
         description="Hinged at the front edge."),
    dict(id="tipper_body", label="Tipper body", group="truck", order=7, explode=[0, 1, 0], distance=1.8,
         description="Ribbed steel tipper body with a top-hinged tailgate, hinged at the back and raised by the ram."),
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
        "camera": {"position": [7.5, 3.0, -8.5], "target": [0, 1.4, 0], "minDistance": 3.0, "maxDistance": 26.0},
        "ghost": ["cab"],
        "ghostLabel": "See-through cab",
        "focus": {"part": "in_cab_unit", "label": "Show in-cab unit", "led": "in_cab_unit_led", "ghost": True,
                  "direction": [1, 0.55, -0.35], "distance": 1.4},
        "ground": 0,
        "shadowScale": 16,
    },
)
C.export_glb("truck")
