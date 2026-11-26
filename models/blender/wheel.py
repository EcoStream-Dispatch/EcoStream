"""
Wheel assembly: truck tyre (295/80 R22.5), steel disc rim, hub with lug nuts, valve stem and
the EcoStream tyre-pressure sensor (a sealed, generic valve-mounted housing inside the tyre: no internals, ever).

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

import wheel_parts  # noqa: E402

root = bpy.data.objects.new("wheel_assembly", None)
bpy.context.scene.collection.objects.link(root)
wheel_parts.build(96, root)

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
         description="Where air goes in. Inside the tyre it carries the EcoStream sensor, so it stays put when the wheel comes apart.",
         explode=[0, 0, 0], distance=0.0),
    dict(id="tpms_sensor", label="EcoStream tyre sensor", group="sensor", order=6, sealed=True,
         description="Sealed valve-mounted sensor inside the tyre, about 70 x 40 x 25 mm. Reads tyre pressure and temperature and radios them to the in-cab unit.",
         explode=[0, 0, 0], distance=0.0),
    dict(id="tpms_sensor_band", label="EcoStream tyre sensor", group="sensor", order=6, sealed=True, partOf="tpms_sensor",
         description="", explode=[0, 0, 0], distance=0.0),
    dict(id="tpms_sensor_led", label="EcoStream tyre sensor", group="sensor", order=6, sealed=True, partOf="tpms_sensor",
         description="", explode=[0, 0, 0], distance=0.0),
]
C.write_meta(
    "wheel",
    "Wheel and tyre sensor",
    "Truck wheel assembly with the EcoStream tyre-pressure sensor, sealed and mounted on the valve inside the tyre.",
    parts,
    extra={
        "root": "wheel_assembly",
        "animations": [
            {"id": "spin", "label": "Spin wheel", "node": "wheel_assembly", "type": "rotate", "axis": [1, 0, 0], "pivot": [0, 0, 0], "speed": 1.2}
        ],
        "camera": {"position": [1.6, 0.6, 1.6], "target": [0, 0, 0], "minDistance": 0.6, "maxDistance": 4.0},
        "ghost": ["tyre"],
        "ghostLabel": "See-through tyre",
        "focus": {"part": "tpms_sensor", "label": "Show sensor", "led": "tpms_sensor_led", "ghost": True, "distance": 0.55},
        "ground": -0.53,
        "shadowScale": 3,
    },
)
C.export_glb("wheel")
