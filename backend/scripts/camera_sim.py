#!/usr/bin/env python3
"""
Overhead AprilTag Camera Telemetry Simulator
Posts detected fixture or tray AprilTags over HTTP to EcoStream Dispatch backend,
simulating classical OpenCV / AprilTag detector outputs.
"""
import sys
import time
import urllib.request
import json

def post_tag(base_url: str, tag_id: str, tag_type: str = "fixture"):
    url = f"{base_url.rstrip('/')}/api/device/tag-detections"
    payload = {
        "tag_id": tag_id,
        "device_id": "CAM-OVERHEAD-01",
        "tag_type": tag_type,
        "confidence": 0.99
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8")
            print(f"[{time.strftime('%X')}] POST {url} -> {resp.status} {body}")
    except Exception as e:
        print(f"Error posting Camera tag detection: {e}", file=sys.stderr)

if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8780"
    tag = sys.argv[2] if len(sys.argv) > 2 else "TAG-B-02"
    ttype = sys.argv[3] if len(sys.argv) > 3 else "fixture"

    print(f"Simulating Overhead Camera AprilTag detection: {tag} ({ttype}) to {base}")
    post_tag(base, tag, ttype)
