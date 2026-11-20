#!/usr/bin/env python3
"""
ESP32 Smart Tool Telemetry Simulator
Posts tool-preset and torque readings over HTTP to EcoStream Dispatch backend,
exactly as a real ESP32 firmware would.
"""
import sys
import time
import urllib.request
import json

def post_preset(base_url: str, preset_id: str, preset_name: str, torque_nm: float):
    url = f"{base_url.rstrip('/')}/api/device/tool-preset"
    payload = {
        "preset_id": preset_id,
        "preset_name": preset_name,
        "torque_nm": torque_nm,
        "device_id": "ESP32-TOOL-01"
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
        print(f"Error posting ESP32 telemetry: {e}", file=sys.stderr)

if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8780"
    preset = sys.argv[2] if len(sys.argv) > 2 else "preset_2"

    if preset == "preset_1":
        print(f"Streaming ESP32 telemetry: Preset 1 (8.0 Nm) to {base}")
        post_preset(base, "preset_1", "Preset 1 (8.0 Nm)", 8.0)
    else:
        print(f"Streaming ESP32 telemetry: Preset 2 (12.5 Nm) to {base}")
        post_preset(base, "preset_2", "Preset 2 (12.5 Nm)", 12.5)
