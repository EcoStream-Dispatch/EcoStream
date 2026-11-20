import pytest
from fastapi import HTTPException
from app.store import store
from app.models import SimStationUpdate
from app.engine import (
    create_changeover_session, verify_step, confirm_step,
    approve_changeover, reject_changeover, reload_approved_sop
)

@pytest.fixture(autouse=True)
def reset_store():
    store.reset_to_seed()

def test_rule_7_sop_version_mismatch_blocks_changeover():
    """Rule 7: If loaded SOP is not approved version, session is blocked until reload-sop is called."""
    # Seed starts with station.loaded_sop_version = "v2.0" (Superseded)
    session = create_changeover_session(to_variant_id="motor_b", operator="Jane Doe")
    assert session.status == "sop_version_mismatch"
    assert len(session.deviations) == 1
    assert session.deviations[0].rule_violation == "SOP_VERSION_SUPERSEDED"
    assert not session.deviations[0].corrected

    # Trying to verify any step should fail with 409
    with pytest.raises(HTTPException) as exc_info:
        verify_step(session.id, "step_fixture")
    assert exc_info.value.status_code == 409

    # Now call reload_approved_sop
    updated_session = reload_approved_sop(session.id)
    assert updated_session.status == "in_progress"
    assert updated_session.sop_version == "v2.1"
    assert updated_session.deviations[0].corrected is True
    assert updated_session.steps[0].status == "active"

def test_rule_1_and_3_strict_order_and_no_skip():
    """Rule 1 & 3: Steps run in order; later steps cannot be verified or skipped."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    # Step 0 is active (step_fixture). Trying to verify step_tray should return 409.
    with pytest.raises(HTTPException) as exc_info:
        verify_step(session.id, "step_tray")
    assert exc_info.value.status_code == 409
    assert "Workflow sequence violation" in exc_info.value.detail

    # Trying to confirm a later step should also return 409
    with pytest.raises(HTTPException) as exc_info:
        confirm_step(session.id, "step_fasteners")
    assert exc_info.value.status_code == 409

def test_rule_2_sensor_step_cannot_be_completed_manually():
    """Rule 2: A sensor-verified step (camera/esp32) cannot be confirmed manually."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    # Active step is step_fixture (verification_type='camera')
    with pytest.raises(HTTPException) as exc_info:
        confirm_step(session.id, "step_fixture")
    assert exc_info.value.status_code == 400
    assert "cannot be manually confirmed" in exc_info.value.detail

def test_rule_4_failure_keeps_step_active_logs_deviation_and_correction():
    """Rule 4: Fail means step stays active, deviation logged; next passing verify marks it corrected."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    # Current station has fixture TAG-A-01 mounted. Motor B needs TAG-B-02.
    passed, msg, dev = verify_step(session.id, "step_fixture")
    assert passed is False
    assert dev is not None
    assert dev.rule_violation == "FIXTURE_MISMATCH"
    assert session.steps[0].status == "failed"
    assert session.current_step_index == 0  # Stays on step 0

    # Simulate fixing the physical station
    store.station_state.mounted_fixture_tag = "TAG-B-02"

    # Re-verify step
    passed2, msg2, dev2 = verify_step(session.id, "step_fixture")
    assert passed2 is True
    assert dev2 is None
    assert session.steps[0].status == "passed"
    # Verify deviation is marked corrected
    fixture_dev = [d for d in session.deviations if d.step_id == "step_fixture"][0]
    assert fixture_dev.corrected is True
    assert fixture_dev.corrected_at is not None
    # Next step is now active
    assert session.current_step_index == 1
    assert session.steps[1].status == "active"

def test_rule_5_readiness_gated_by_all_prior_steps():
    """Rule 5: Readiness check is available only when all prior steps have passed."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    # Force station to target values
    store.station_state.mounted_fixture_tag = "TAG-B-02"
    store.station_state.tray_tag = "TRAY-B-02"
    store.station_state.tool_preset_id = "preset_2"

    # Verify step 1 (fixture)
    verify_step(session.id, "step_fixture")
    # Verify step 2 (tray)
    verify_step(session.id, "step_tray")
    # Confirm step 3 (fasteners)
    confirm_step(session.id, "step_fasteners")
    # Verify step 4 (tool)
    verify_step(session.id, "step_tool_preset")

    # Now step 5 is inspection. Step 6 is readiness.
    # Trying to jump to readiness should fail with 409
    with pytest.raises(HTTPException) as exc_info:
        confirm_step(session.id, "step_readiness")
    assert exc_info.value.status_code == 409

    # Confirm inspection
    confirm_step(session.id, "step_inspection")

    # Now readiness can be confirmed
    passed, msg = confirm_step(session.id, "step_readiness")
    assert passed is True
    assert session.status == "pending_approval"

def test_rule_6_approval_requires_all_passed_and_correct_pin():
    """Rule 6: Approval available only when every step has passed and PIN is correct."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    # Incomplete changeover cannot be approved
    with pytest.raises(HTTPException) as exc_info:
        approve_changeover(session.id, pin="1234", supervisor="Dave")
    assert exc_info.value.status_code == 409

    # Complete all steps
    store.station_state.mounted_fixture_tag = "TAG-B-02"
    store.station_state.tray_tag = "TRAY-B-02"
    store.station_state.tool_preset_id = "preset_2"
    verify_step(session.id, "step_fixture")
    verify_step(session.id, "step_tray")
    confirm_step(session.id, "step_fasteners")
    verify_step(session.id, "step_tool_preset")
    confirm_step(session.id, "step_inspection")
    confirm_step(session.id, "step_readiness")

    # Wrong PIN fails with 403
    with pytest.raises(HTTPException) as exc_info:
        approve_changeover(session.id, pin="9999", supervisor="Dave")
    assert exc_info.value.status_code == 403

    # Correct PIN succeeds
    passport = approve_changeover(session.id, pin="1234", supervisor="Dave")
    assert passport is not None
    assert passport.changeover_id == session.id

def test_rule_8_passport_integrity_and_immutability():
    """Rule 8: Passport generated only on approval and is immutable with SHA-256 hash."""
    session = create_changeover_session("motor_b", "Jane Doe")
    reload_approved_sop(session.id)

    store.station_state.mounted_fixture_tag = "TAG-B-02"
    store.station_state.tray_tag = "TRAY-B-02"
    store.station_state.tool_preset_id = "preset_2"

    verify_step(session.id, "step_fixture")
    verify_step(session.id, "step_tray")
    confirm_step(session.id, "step_fasteners")
    verify_step(session.id, "step_tool_preset")
    confirm_step(session.id, "step_inspection")
    confirm_step(session.id, "step_readiness")

    passport = approve_changeover(session.id, pin="1234", supervisor="Dave")
    assert passport.integrity_hash is not None
    assert len(passport.integrity_hash) == 64  # SHA-256 hex length
    assert session.status == "completed"

    # Once completed, no more verification allowed
    with pytest.raises(HTTPException) as exc_info:
        verify_step(session.id, "step_fixture")
    assert exc_info.value.status_code == 400
