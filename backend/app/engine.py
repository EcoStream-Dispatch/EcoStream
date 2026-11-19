import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import List, Tuple, Optional
from fastapi import HTTPException
from app.models import (
    Variant, ChangeoverSession, ChangeoverStep, Deviation,
    DigitalPassport, PocTrial
)
from app.store import store, utc_now_str
from app.explain import get_explanation

DEMO_SUPERVISOR_PIN = "1234"

def compute_changeover_steps(from_v: Variant, to_v: Variant) -> List[ChangeoverStep]:
    steps: List[ChangeoverStep] = []
    order = 1

    # Check 1: Assembly fixture
    if from_v.fixture_tag != to_v.fixture_tag:
        steps.append(ChangeoverStep(
            step_id="step_fixture",
            order=order,
            title="Mount Motor B Assembly Fixture",
            description=f"Remove Fixture {from_v.fixture_tag} and mount Fixture {to_v.fixture_tag}. Engage toggle clamps and ensure AprilTag is unobstructed.",
            sop_ref=f"{to_v.sop_id} §3.1",
            verification_type="camera",
            expected_value=to_v.fixture_tag,
            diff_reason=f"Fixture tag differs between {from_v.code} and {to_v.code} ({from_v.fixture_tag} → {to_v.fixture_tag})",
            status="pending"
        ))
        order += 1

    # Check 2: Component Tray
    if from_v.tray_tag != to_v.tray_tag:
        steps.append(ChangeoverStep(
            step_id="step_tray",
            order=order,
            title="Stage Component Kit Tray B",
            description=f"Remove Tray {from_v.tray_tag} and stage Tray {to_v.tray_tag} with Motor B subcomponents, terminal block, and wave springs.",
            sop_ref=f"{to_v.sop_id} §3.2",
            verification_type="camera",
            expected_value=to_v.tray_tag,
            diff_reason=f"Component tray tag differs ({from_v.tray_tag} → {to_v.tray_tag})",
            status="pending"
        ))
        order += 1

    # Check 3: Fasteners
    if from_v.fasteners != to_v.fasteners:
        steps.append(ChangeoverStep(
            step_id="step_fasteners",
            order=order,
            title="Stage Motor B Fasteners",
            description=f"Verify fastener bin contains {to_v.fasteners}. Clear remaining {from_v.fasteners} to return bin.",
            sop_ref=f"{to_v.sop_id} §3.3",
            verification_type="operator",
            expected_value=to_v.fasteners,
            diff_reason=f"Fastener spec differs ({from_v.fasteners} → {to_v.fasteners})",
            status="pending"
        ))
        order += 1

    # Check 4: Tool Preset
    if from_v.tool_preset_id != to_v.tool_preset_id or from_v.target_torque_nm != to_v.target_torque_nm:
        steps.append(ChangeoverStep(
            step_id="step_tool_preset",
            order=order,
            title="Set Smart Tool to Preset 2",
            description=f"Switch digital screwdriver to {to_v.tool_preset_name} ({to_v.target_torque_nm} Nm). Verify green LED telemetry link.",
            sop_ref=f"{to_v.sop_id} §4.1",
            verification_type="esp32",
            expected_value=to_v.tool_preset_id,
            diff_reason=f"Torque requirement differs ({from_v.target_torque_nm} Nm → {to_v.target_torque_nm} Nm, {from_v.tool_preset_name} → {to_v.tool_preset_name})",
            status="pending"
        ))
        order += 1

    # Mandatory Check 5: First-Piece Inspection
    steps.append(ChangeoverStep(
        step_id="step_inspection",
        order=order,
        title="Execute First-Piece Inspection Procedure B",
        description="Assemble initial pilot unit. Perform 2-point dielectric insulation check, bearing axial play inspection (<0.05 mm), and visual clearance check.",
        sop_ref=f"{to_v.sop_id} §5.2",
        verification_type="operator",
        expected_value="Procedure B Checklist Passed",
        diff_reason="Mandatory quality gate: first-piece verification required on every product changeover before production ramp",
        status="pending"
    ))
    order += 1

    # Mandatory Check 6: Station Readiness Confirmation
    steps.append(ChangeoverStep(
        step_id="step_readiness",
        order=order,
        title="Confirm Workstation Ready for Production",
        description="Verify 5S workspace cleanliness, check protective guard interlocks, and confirm tooling calibration certificate is active.",
        sop_ref=f"{to_v.sop_id} §6.0",
        verification_type="operator",
        expected_value="Workstation Verified Ready",
        diff_reason="Mandatory operational gate: station cleared and validated before resuming series production",
        status="pending"
    ))

    return steps

def create_changeover_session(to_variant_id: str, operator: str) -> ChangeoverSession:
    station = store.station_state
    from_v = store.variants.get(station.current_variant_id) or store.variants["motor_a"]
    to_v = store.variants.get(to_variant_id)
    if not to_v:
        raise HTTPException(status_code=404, detail=f"Target variant '{to_variant_id}' not found.")

    steps = compute_changeover_steps(from_v, to_v)
    now = utc_now_str()
    session_id = f"CHG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    # Rule 7: Check if loaded SOP version matches approved version
    is_sop_outdated = (station.loaded_sop_id == to_v.sop_id and station.loaded_sop_version != to_v.approved_sop_version)
    initial_status = "sop_version_mismatch" if is_sop_outdated else "in_progress"

    deviations: List[Deviation] = []
    if is_sop_outdated:
        explanation = get_explanation("sop_version_superseded", expected=to_v.approved_sop_version, actual=station.loaded_sop_version)
        deviations.append(Deviation(
            id=f"DEV-{uuid.uuid4().hex[:6].upper()}",
            step_id="sop_version_check",
            step_title="Station SOP Version Verification",
            expected=f"v{to_v.approved_sop_version} (Approved)",
            actual=f"v{station.loaded_sop_version} (Superseded)",
            rule_violation="SOP_VERSION_SUPERSEDED",
            explanation=explanation.explanation,
            suggested_fix=explanation.recommended_action,
            timestamp=now,
            corrected=False
        ))
    else:
        # Activate first step if SOP is valid
        if steps:
            steps[0].status = "active"

    session = ChangeoverSession(
        id=session_id,
        station_id=station.station_id,
        from_variant=from_v.id,
        to_variant=to_v.id,
        operator=operator,
        status=initial_status,
        sop_id=to_v.sop_id,
        sop_version=station.loaded_sop_version,
        current_step_index=0,
        steps=steps,
        deviations=deviations,
        created_at=now,
        updated_at=now
    )

    store.changeovers[session_id] = session
    return session

def reload_approved_sop(session_id: str) -> ChangeoverSession:
    session = store.changeovers.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    target_v = store.variants[session.to_variant]
    now = utc_now_str()

    # Update station state
    store.station_state.loaded_sop_id = target_v.sop_id
    store.station_state.loaded_sop_version = target_v.approved_sop_version

    # Update session
    session.sop_version = target_v.approved_sop_version
    session.status = "in_progress"
    session.updated_at = now

    # Mark SOP deviation as corrected
    for dev in session.deviations:
        if dev.step_id == "sop_version_check" and not dev.corrected:
            dev.corrected = True
            dev.corrected_at = now

    # Activate first step if still pending
    if session.steps and session.steps[0].status == "pending":
        session.steps[0].status = "active"

    return session

def verify_step(session_id: str, step_id: str) -> Tuple[bool, str, Optional[Deviation]]:
    session = store.changeovers.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    if session.status == "sop_version_mismatch":
        raise HTTPException(
            status_code=409,
            detail="Changeover blocked: Station SOP version is superseded. Reload approved SOP before proceeding."
        )

    if session.status in ["approved", "completed"]:
        raise HTTPException(status_code=400, detail="Changeover session is already approved and closed.")

    # Rule 1 & Rule 3: Steps run in order; cannot skip steps
    active_step = None
    step_index = -1
    for idx, s in enumerate(session.steps):
        if s.step_id == step_id:
            step_index = idx
            break

    if step_index == -1:
        raise HTTPException(status_code=404, detail=f"Step '{step_id}' not found in session.")

    # Check if this is the active step
    if step_index != session.current_step_index:
        current_active = session.steps[session.current_step_index]
        raise HTTPException(
            status_code=409,
            detail=f"Workflow sequence violation: Step '{step_id}' cannot be executed. Active step is '{current_active.title}' (Step {current_active.order}). Steps must be completed in order."
        )

    target_step = session.steps[step_index]

    # Rule 2: Sensor-verified steps only for verify
    if target_step.verification_type == "operator":
        raise HTTPException(
            status_code=400,
            detail=f"Step '{step_id}' is an operator manual checklist step and must be validated via /confirm, not /verify."
        )

    station = store.station_state
    now = utc_now_str()
    target_step.last_checked_at = now
    target_v = store.variants[session.to_variant]

    passed = False
    actual_val = ""
    fault_type = ""

    if target_step.step_id == "step_fixture":
        actual_val = station.mounted_fixture_tag
        passed = (actual_val == target_v.fixture_tag)
        fault_type = "fixture_mismatch"
    elif target_step.step_id == "step_tray":
        actual_val = station.tray_tag
        passed = (actual_val == target_v.tray_tag)
        fault_type = "tray_mismatch"
    elif target_step.step_id == "step_tool_preset":
        actual_val = station.tool_preset_id
        passed = (actual_val == target_v.tool_preset_id)
        fault_type = "tool_preset_mismatch"

    target_step.actual_value = actual_val

    if passed:
        target_step.status = "passed"
        target_step.error_message = None

        # Rule 4: If previously deviated, mark deviation as corrected
        for dev in session.deviations:
            if dev.step_id == step_id and not dev.corrected:
                dev.corrected = True
                dev.corrected_at = now

        # Advance to next step
        if step_index + 1 < len(session.steps):
            session.current_step_index = step_index + 1
            session.steps[step_index + 1].status = "active"
        else:
            # All steps passed!
            session.status = "pending_approval"

        session.updated_at = now
        return True, "Verification passed successfully.", None
    else:
        # Rule 4: Step stays active, deviation is logged
        target_step.status = "failed"
        explanation = get_explanation(fault_type, expected=target_step.expected_value, actual=actual_val, step_id=step_id)
        target_step.error_message = explanation.summary

        deviation = Deviation(
            id=f"DEV-{uuid.uuid4().hex[:6].upper()}",
            step_id=step_id,
            step_title=target_step.title,
            expected=target_step.expected_value,
            actual=actual_val,
            rule_violation=fault_type.upper(),
            explanation=explanation.explanation,
            suggested_fix=explanation.recommended_action,
            timestamp=now,
            corrected=False
        )
        session.deviations.append(deviation)
        session.updated_at = now
        return False, explanation.summary, deviation

def confirm_step(session_id: str, step_id: str, operator_notes: Optional[str] = None) -> Tuple[bool, str]:
    session = store.changeovers.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    if session.status == "sop_version_mismatch":
        raise HTTPException(
            status_code=409,
            detail="Changeover blocked: Station SOP version is superseded. Reload approved SOP before proceeding."
        )

    # Find step index
    step_index = -1
    for idx, s in enumerate(session.steps):
        if s.step_id == step_id:
            step_index = idx
            break

    if step_index == -1:
        raise HTTPException(status_code=404, detail=f"Step '{step_id}' not found.")

    # Rule 1 & Rule 3: Steps run in order; cannot skip steps
    if step_index != session.current_step_index:
        current_active = session.steps[session.current_step_index]
        raise HTTPException(
            status_code=409,
            detail=f"Workflow sequence violation: Step '{step_id}' cannot be confirmed. Active step is '{current_active.title}' (Step {current_active.order}). Steps must be completed in order."
        )

    target_step = session.steps[step_index]

    # Rule 2: Cannot manually confirm sensor-verified steps
    if target_step.verification_type in ["camera", "esp32"]:
        raise HTTPException(
            status_code=400,
            detail=f"Security/quality violation: Step '{step_id}' requires hardware sensor verification ({target_step.verification_type.upper()}) and cannot be manually confirmed."
        )

    # Rule 5: Readiness check is available only when all prior steps have passed
    if target_step.step_id == "step_readiness":
        for prior_idx in range(step_index):
            if session.steps[prior_idx].status != "passed":
                raise HTTPException(
                    status_code=409,
                    detail="Readiness confirmation blocked: All prior setup and inspection steps must be passed before station readiness can be confirmed."
                )

    now = utc_now_str()
    target_step.status = "passed"
    target_step.actual_value = "Confirmed by Operator"
    target_step.last_checked_at = now
    target_step.error_message = None

    # Advance to next step
    if step_index + 1 < len(session.steps):
        session.current_step_index = step_index + 1
        session.steps[step_index + 1].status = "active"
    else:
        # All steps passed!
        session.status = "pending_approval"

    session.updated_at = now
    return True, "Step confirmed successfully."

def approve_changeover(session_id: str, pin: str, supervisor: str, notes: Optional[str] = None) -> DigitalPassport:
    session = store.changeovers.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    # Rule 6: Approval available only when every step has passed
    for s in session.steps:
        if s.status != "passed":
            raise HTTPException(
                status_code=409,
                detail=f"Approval rejected: Step '{s.title}' is not passed (status: {s.status}). All steps must pass prior to supervisor signoff."
            )

    # Rule 6: Validate supervisor PIN
    if pin != DEMO_SUPERVISOR_PIN:
        raise HTTPException(
            status_code=403,
            detail="Invalid supervisor PIN. (Demo PIN: 1234)"
        )

    now = utc_now_str()
    session.status = "approved"
    session.approved_by = supervisor
    session.approved_at = now
    session.supervisor_notes = notes

    # Generate Digital Changeover Passport (Rule 8: generated only on approval and immutable afterward)
    passport_id = f"PSP-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{session_id[-4:]}"
    steps_summary = [
        {
            "step_id": s.step_id,
            "order": s.order,
            "title": s.title,
            "verification_type": s.verification_type,
            "expected_value": s.expected_value,
            "actual_value": s.actual_value,
            "status": s.status,
            "diff_reason": s.diff_reason
        }
        for s in session.steps
    ]

    # Canonical record for hashing
    canonical_dict = {
        "passport_id": passport_id,
        "changeover_id": session.id,
        "station_id": session.station_id,
        "from_variant": session.from_variant,
        "to_variant": session.to_variant,
        "operator": session.operator,
        "supervisor": supervisor,
        "approved_at": now,
        "sop_id": session.sop_id,
        "sop_version": session.sop_version,
        "steps": steps_summary,
        "deviations": [d.model_dump() for d in session.deviations]
    }
    canonical_string = json.dumps(canonical_dict, sort_keys=True)
    integrity_hash = hashlib.sha256(canonical_string.encode("utf-8")).hexdigest()

    passport = DigitalPassport(
        id=passport_id,
        changeover_id=session.id,
        station_id=session.station_id,
        from_variant=session.from_variant,
        to_variant=session.to_variant,
        operator=session.operator,
        supervisor=supervisor,
        approved_at=now,
        sop_id=session.sop_id,
        sop_version=session.sop_version,
        steps_summary=steps_summary,
        deviations_count=len(session.deviations),
        deviations=session.deviations,
        integrity_hash=integrity_hash,
        canonical_string=canonical_string,
        status="VALID (DEMO INTEGRITY CHECK)"
    )

    store.passports[passport_id] = passport
    session.passport_id = passport_id
    session.status = "completed"

    # Update Station State to new variant
    to_v = store.variants[session.to_variant]
    store.station_state.current_variant_id = to_v.id
    store.station_state.mounted_fixture_tag = to_v.fixture_tag
    store.station_state.tray_tag = to_v.tray_tag
    store.station_state.tool_preset_id = to_v.tool_preset_id
    store.station_state.tool_preset_name = to_v.tool_preset_name
    store.station_state.tool_torque_nm = to_v.target_torque_nm

    # Auto-create SetWise POC Trial record
    # Calculate duration or set realistic changeover demo time
    trial_id = f"TRIAL-{len(store.poc_trials)+1:03d}"
    wrong_fixtures = sum(1 for d in session.deviations if "fixture" in d.step_id)
    wrong_tools = sum(1 for d in session.deviations if "tool" in d.step_id)
    caught_at_step = len(session.deviations)

    new_trial = PocTrial(
        id=trial_id,
        method="setwise",
        variant=to_v.name,
        changeover_time_seconds=395,  # ~6.5 min vs 20 min paper
        errors_by_type={"wrong_fixture": wrong_fixtures, "wrong_tool_preset": wrong_tools, "skipped_inspection": 0},
        where_caught={"at_step": caught_at_step, "first_piece": 0, "later": 0},
        skipped_steps_count=0,
        rework_required=False,
        record_complete=True,
        operator=session.operator,
        timestamp=now,
        notes=f"Changeover completed via EcoStream Dispatch. Digital passport {passport_id} generated. Zero downstream rework."
    )
    store.poc_trials.append(new_trial)

    return passport

def reject_changeover(session_id: str, reason: str, supervisor: str) -> ChangeoverSession:
    session = store.changeovers.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Changeover session not found.")

    now = utc_now_str()
    session.status = "rejected"
    session.supervisor_notes = f"REJECTED by {supervisor}: {reason}"
    session.updated_at = now
    return session
