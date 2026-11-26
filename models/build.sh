#!/usr/bin/env bash
# Rebuild every 3D model: Blender (headless) -> GLB + metadata -> meshopt GLB + low LOD -> manifest.
#   ./models/build.sh            (all models)
#   ./models/build.sh wheel      (one model)
# Needs Blender (BLENDER=/path/to/blender, default: the macOS app) and Node (npx).
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
GT="npx -y @gltf-transform/cli@4.1.1"
MODELS=("${@:-wheel truck cab_unit}")
mkdir -p models/build frontend/public/models
for m in ${MODELS[@]}; do
  echo "== $m"
  "$BLENDER" --background --python "models/blender/$m.py" 2>&1 | grep -E "EXPORTED|Error|Traceback" || true
  $GT meshopt "models/build/$m.glb" "frontend/public/models/$m.glb"
  $GT simplify "models/build/$m.glb" "models/build/$m-low-raw.glb" --ratio 0.35 --error 0.002
  $GT meshopt "models/build/$m-low-raw.glb" "frontend/public/models/$m-low.glb"
  cp "models/build/$m.meta.json" "frontend/public/models/$m.meta.json"
  rm -f "models/build/$m-low-raw.glb"
done
node models/manifest.mjs
