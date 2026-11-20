import os
import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.models import (
    Variant, Sop, StationState, SimStationUpdate, TagDetectionPayload,
    ToolPresetPayload, ChangeoverSession, StartChangeoverRequest,
    ApproveRequest, RejectRequest, DigitalPassport, PocTrial,
    Truck, Alert, DiagnoseRequest, DiagnoseResponse,
    InjectScenarioRequest, ExplainRequest, ExplainResponse
)
from app.store import store, utc_now_str
from app.engine import (
    create_changeover_session, verify_step, confirm_step,
    approve_changeover, reject_changeover, reload_approved_sop
)
from app.explain import get_explanation
from app.simulator import run_simulator_loop

# Read ALLOWED_ORIGINS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
if "*" in origins:
    origins = ["*"]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background fleet simulator task
    sim_task = asyncio.create_task(run_simulator_loop())
    yield
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="EcoStream Dispatch API",
    description="Predictive maintenance and guided changeover operations platform for edge-stream industrial IoT.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True if origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Common Endpoints
# -------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "EcoStream Dispatch Backend",
        "version": "1.0.0",
        "state_version": store.version,
        "timestamp": utc_now_str()
    }

@app.get("/api/state/version")
async def get_state_version():
    return {"version": store.version, "timestamp": utc_now_str()}

@app.post("/api/sim/reset")
async def reset_simulation():
    store.reset_to_seed()
    await store.broadcast("system_reset", {"message": "State restored to seed."})
    return {"status": "ok", "message": "Simulation environment reset to baseline seed state."}

@app.get("/api/events")
async def sse_events(request: Request):
    """Server-Sent Events (SSE) stream for real-time frontend updates."""
    queue = asyncio.Queue()
    store.listeners.append(queue)

    async def event_generator():
        try:
            # Yield initial ping
            initial = json.dumps({"event": "connected", "version": store.version, "timestamp": utc_now_str()})
            yield f"data: {initial}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": keep-alive\n\n"
        finally:
            if queue in store.listeners:
                store.listeners.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# -------------------------------------------------------------
# Module 1: Station Changeover Guide Endpoints
# -------------------------------------------------------------
@app.get("/api/variants", response_model=List[Variant])
async def list_variants():
    return list(store.variants.values())

@app.get("/api/sops")
async def list_sops():
    # Flatten sops dict
    result = []
    for sop_list in store.sops.values():
        result.extend(sop_list)
    return result

@app.get("/api/station", response_model=StationState)
async def get_station():
    return store.station_state

@app.post("/api/sim/station", response_model=StationState)
async def update_sim_station(payload: SimStationUpdate):
    """Fault injection & physical state simulation endpoint."""
    state = store.station_state
    if payload.mounted_fixture_tag is not None:
        state.mounted_fixture_tag = payload.mounted_fixture_tag
    if payload.tray_tag is not None:
        state.tray_tag = payload.tray_tag
    if payload.tool_preset_id is not None:
        state.tool_preset_id = payload.tool_preset_id
    if payload.tool_preset_name is not None:
        state.tool_preset_name = payload.tool_preset_name
    if payload.tool_torque_nm is not None:
        state.tool_torque_nm = payload.tool_torque_nm
    if payload.loaded_sop_id is not None:
        state.loaded_sop_id = payload.loaded_sop_id
    if payload.loaded_sop_version is not None:
        state.loaded_sop_version = payload.loaded_sop_version
    if payload.current_variant_id is not None:
        state.current_variant_id = payload.current_variant_id
    if payload.camera_online is not None:
        state.camera_online = payload.camera_online
    if payload.esp32_online is not None:
        state.esp32_online = payload.esp32_online

    now = utc_now_str()
    state.last_camera_heartbeat = now
    state.last_esp32_heartbeat = now

    await store.broadcast("station_update", state.model_dump())
    return state

@app.post("/api/device/tag-detections")
async def receive_tag_detection(payload: TagDetectionPayload):
    """Endpoint called by overhead camera edge device."""
    now = utc_now_str()
    store.station_state.camera_online = True
    store.station_state.last_camera_heartbeat = now

    if payload.tag_type == "fixture":
        store.station_state.mounted_fixture_tag = payload.tag_id
    elif payload.tag_type == "tray":
        store.station_state.tray_tag = payload.tag_id

    # Append to device events log
    store.device_events.insert(0, {
        "device": payload.device_id,
        "type": f"april_tag_{payload.tag_type}",
        "tag_id": payload.tag_id,
        "confidence": payload.confidence,
        "timestamp": now,
        "status": "active"
    })
    if len(store.device_events) > 50:
        store.device_events.pop()

    await store.broadcast("device_event", {"type": "camera", "tag_id": payload.tag_id})
    return {"status": "received", "tag_id": payload.tag_id}

@app.post("/api/device/tool-preset")
async def receive_tool_preset(payload: ToolPresetPayload):
    """Endpoint called by ESP32 tool controller."""
    now = utc_now_str()
    store.station_state.esp32_online = True
    store.station_state.last_esp32_heartbeat = now
    store.station_state.tool_preset_id = payload.preset_id
    store.station_state.tool_preset_name = payload.preset_name
    store.station_state.tool_torque_nm = payload.torque_nm

    store.device_events.insert(0, {
        "device": payload.device_id,
        "type": "tool_preset_telemetry",
        "preset_id": payload.preset_id,
        "torque_nm": payload.torque_nm,
        "timestamp": now,
        "status": "active"
    })
    if len(store.device_events) > 50:
        store.device_events.pop()

    await store.broadcast("device_event", {"type": "esp32", "preset_id": payload.preset_id, "torque_nm": payload.torque_nm})
    return {"status": "received", "preset": payload.preset_id, "torque_nm": payload.torque_nm}

@app.post("/api/changeovers", response_model=ChangeoverSession)
async def start_changeover(payload: StartChangeoverRequest):
    session = create_changeover_session(payload.to_variant, payload.operator)
    await store.broadcast("changeover_created", session.model_dump())
    return session

@app.get("/api/changeovers", response_model=List[ChangeoverSession])
async def list_changeovers():
    return list(store.changeovers.values())

@app.get("/api/changeovers/{id}", response_model=ChangeoverSession)
async def get_changeover(id: str):
    session = store.changeovers.get(id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")
    return session

@app.post("/api/changeovers/{id}/reload-sop", response_model=ChangeoverSession)
async def reload_sop_endpoint(id: str):
    session = reload_approved_sop(id)
    await store.broadcast("changeover_updated", session.model_dump())
    return session

@app.post("/api/changeovers/{id}/steps/{step_id}/verify")
async def verify_changeover_step(id: str, step_id: str):
    passed, message, deviation = verify_step(id, step_id)
    session = store.changeovers[id]
    await store.broadcast("step_verified", {"session_id": id, "step_id": step_id, "passed": passed})
    return {
        "passed": passed,
        "message": message,
        "step_id": step_id,
        "deviation": deviation.model_dump() if deviation else None,
        "session": session
    }

@app.post("/api/changeovers/{id}/steps/{step_id}/confirm")
async def confirm_changeover_step(id: str, step_id: str, request: Request):
    notes = None
    try:
        body = await request.json()
        notes = body.get("notes")
    except Exception:
        pass

    passed, message = confirm_step(id, step_id, notes)
    session = store.changeovers[id]
    await store.broadcast("step_confirmed", {"session_id": id, "step_id": step_id, "passed": passed})
    return {"passed": passed, "message": message, "session": session}

@app.post("/api/changeovers/{id}/request-approval")
async def request_approval(id: str):
    session = store.changeovers.get(id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    for s in session.steps:
        if s.status != "passed":
            raise HTTPException(status_code=409, detail=f"Cannot request approval: Step '{s.title}' is not passed.")

    session.status = "pending_approval"
    session.updated_at = utc_now_str()
    await store.broadcast("approval_requested", {"session_id": id})
    return {"status": "pending_approval", "message": "Changeover submitted for supervisor signoff."}

@app.post("/api/changeovers/{id}/approve", response_model=DigitalPassport)
async def approve_changeover_endpoint(id: str, payload: ApproveRequest):
    passport = approve_changeover(id, payload.pin, payload.supervisor, payload.notes)
    await store.broadcast("changeover_approved", passport.model_dump())
    return passport

@app.post("/api/changeovers/{id}/reject", response_model=ChangeoverSession)
async def reject_changeover_endpoint(id: str, payload: RejectRequest):
    session = reject_changeover(id, payload.reason, payload.supervisor)
    await store.broadcast("changeover_rejected", session.model_dump())
    return session

@app.get("/api/passports", response_model=List[DigitalPassport])
async def list_passports():
    return list(store.passports.values())

@app.get("/api/passports/{id}", response_model=DigitalPassport)
async def get_passport(id: str):
    passport = store.passports.get(id)
    if not passport:
        raise HTTPException(status_code=404, detail="Digital Changeover Passport not found.")
    return passport

# POC Trials
@app.get("/api/poc/trials", response_model=List[PocTrial])
async def list_poc_trials():
    return store.poc_trials

@app.post("/api/poc/trials", response_model=PocTrial)
async def create_poc_trial(trial: PocTrial):
    store.poc_trials.append(trial)
    await store.broadcast("trial_created", trial.model_dump())
    return trial

@app.delete("/api/poc/trials")
async def clear_poc_trials():
    store.poc_trials.clear()
    await store.broadcast("trials_cleared", {})
    return {"status": "ok", "message": "Demo trial data cleared."}

@app.post("/api/explain", response_model=ExplainResponse)
async def explain_fault(payload: ExplainRequest):
    return get_explanation(
        fault_type=payload.fault_type,
        expected=payload.expected,
        actual=payload.actual,
        step_id=payload.step_id
    )

# -------------------------------------------------------------
# Module 2: Fleet Health Endpoints
# -------------------------------------------------------------
@app.get("/api/fleet", response_model=List[Truck])
async def list_fleet():
    return list(store.trucks.values())

@app.get("/api/fleet/{truck_id}", response_model=Truck)
async def get_truck(truck_id: str):
    truck = store.trucks.get(truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck '{truck_id}' not found.")
    return truck

@app.get("/api/alerts", response_model=List[Alert])
async def list_alerts():
    return store.alerts

@app.post("/api/alerts/{id}/ack")
async def acknowledge_alert(id: str):
    now = utc_now_str()
    for a in store.alerts:
        if a.id == id:
            a.acknowledged = True
            a.acknowledged_at = now
            await store.broadcast("alert_updated", a.model_dump())
            return {"status": "ok", "alert": a}
    raise HTTPException(status_code=404, detail="Alert not found.")

@app.post("/api/alerts/{id}/resolve")
async def resolve_alert(id: str):
    now = utc_now_str()
    for a in store.alerts:
        if a.id == id:
            a.resolved = True
            a.resolved_at = now
            # Reset corresponding tyre scenario to clear
            if a.truck_id in store.trucks and a.tyre_position in store.trucks[a.truck_id].tyres:
                tyre = store.trucks[a.truck_id].tyres[a.tyre_position]
                tyre.scenario = None
                tyre.current_pressure = 110.0
                tyre.current_temp = 42.0
                tyre.status = "nominal"
                tyre.predicted_text = "Stable"
            await store.broadcast("alert_updated", a.model_dump())
            return {"status": "ok", "alert": a}
    raise HTTPException(status_code=404, detail="Alert not found.")

@app.post("/api/sim/inject")
async def inject_fleet_scenario(payload: InjectScenarioRequest):
    truck = store.trucks.get(payload.truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")
    if payload.tyre not in truck.tyres:
        raise HTTPException(status_code=404, detail=f"Tyre position '{payload.tyre}' not found.")

    target_tyre = truck.tyres[payload.tyre]
    if payload.scenario == "clear":
        target_tyre.scenario = None
        target_tyre.current_pressure = 110.0
        target_tyre.current_temp = 42.0
        target_tyre.status = "nominal"
        target_tyre.predicted_text = "Stable"
        target_tyre.predicted_hours_to_min = None
    else:
        target_tyre.scenario = payload.scenario
        if payload.scenario == "sudden_drop":
            target_tyre.current_pressure = max(60.0, target_tyre.current_pressure - 15.0)

    await store.broadcast("scenario_injected", {
        "truck_id": payload.truck_id,
        "tyre": payload.tyre,
        "scenario": payload.scenario
    })
    return {"status": "ok", "truck_id": payload.truck_id, "tyre": payload.tyre, "scenario": payload.scenario}

@app.post("/api/diagnose", response_model=DiagnoseResponse)
async def diagnose_tyre(payload: DiagnoseRequest):
    truck = store.trucks.get(payload.truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found.")
    if payload.tyre not in truck.tyres:
        raise HTTPException(status_code=404, detail=f"Tyre '{payload.tyre}' not found on truck.")

    tyre = truck.tyres[payload.tyre]
    checklist = []
    action = ""

    if tyre.scenario == "slow_leak" or tyre.slope_psi_per_hour < -0.5:
        diagnosis = f"Linear Pneumatic Degradation ({tyre.slope_psi_per_hour} PSI/h). Probable puncture or valve core leakage."
        checklist = [
            "1. Visual tread inspection for metal shrapnel, screw, or road nail penetration.",
            "2. Soap-bubble leak check around Schrader valve stem and core seal.",
            "3. Rim bead seat soap test for bead seat corrosion or bead slip.",
            "4. Verify hub dual-tyre clearance and valve extension hose integrity.",
            "5. Re-inflate to calibrated cold placard pressure (110.0 PSI) with dry nitrogen/filtered air."
        ]
        action = f"Schedule pit stop before predicted threshold ({tyre.predicted_text})."
    elif tyre.scenario == "sudden_drop":
        diagnosis = "Acute Pneumatic Loss (>10 PSI sudden drop). Rapid deflation or valve stem fracture."
        checklist = [
            "1. Immediate vehicle stop on level asphalt shoulder with hazard lights engaged.",
            "2. Inspect sidewall for impact bulge, cut, or zipper rupture.",
            "3. Inspect inner wheel well for brake drum contact or structural rubbing.",
            "4. Mount spare wheel assembly according to 8-lug cross-torque sequence (450 Nm)."
        ]
        action = "Ground vehicle immediately. Do not attempt highway operation."
    elif tyre.scenario == "overheat":
        diagnosis = f"Thermal Overload Warning ({tyre.current_temp}°C). High blowout hazard."
        checklist = [
            "1. Inspect wheel bearing end-play and hub oil level sight glass.",
            "2. Check foundation S-cam brake drum for shoe dragging or brake chamber failure.",
            "3. Verify dual-tyre load balancing: confirm adjacent tyre is not flat.",
            "4. Allow natural ambient convective cooling (NEVER pour cold water on hot brake drum/tyre)."
        ]
        action = "Inspect brake hardware and wheel hub bearings."
    else:
        diagnosis = f"Nominal Tyre Telemetry ({tyre.current_pressure} PSI, {tyre.current_temp}°C). Operating within standard parameters."
        checklist = [
            "1. Routine pre-trip cold inflation check (110 PSI nominal).",
            "2. Check tread depth across major circumferential grooves (minimum 3.2 mm).",
            "3. Verify valve dust cap with internal rubber O-ring is hand-tight."
        ]
        action = "No corrective maintenance required. Maintain regular fleet route."

    return DiagnoseResponse(
        truck_id=payload.truck_id,
        tyre=payload.tyre,
        diagnosis=diagnosis,
        checklist=checklist,
        suggested_action=action
    )

# -------------------------------------------------------------
# Devices Endpoints
# -------------------------------------------------------------
@app.get("/api/devices")
async def get_devices_status():
    st = store.station_state
    return {
        "devices": [
            {
                "id": "CAM-OVERHEAD-01",
                "name": "Station Overhead AprilTag Camera",
                "type": "camera",
                "location": "Station WS-MOTOR-01 Ceiling Mount",
                "online": st.camera_online,
                "last_heartbeat": st.last_camera_heartbeat,
                "current_readings": {
                    "fixture_tag": st.mounted_fixture_tag,
                    "tray_tag": st.tray_tag
                }
            },
            {
                "id": "ESP32-TOOL-01",
                "name": "ESP32 Smart Screwdriver Controller",
                "type": "esp32",
                "location": "Tool Holster WS-MOTOR-01",
                "online": st.esp32_online,
                "last_heartbeat": st.last_esp32_heartbeat,
                "current_readings": {
                    "preset_id": st.tool_preset_id,
                    "preset_name": st.tool_preset_name,
                    "torque_nm": st.tool_torque_nm
                }
            }
        ],
        "events": store.device_events
    }
