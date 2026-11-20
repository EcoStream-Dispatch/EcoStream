import pytest
from app.store import store
from app.models import Variant
from app.engine import compute_changeover_steps

def test_full_diff_motor_a_to_motor_b():
    store.reset_to_seed()
    motor_a = store.variants["motor_a"]
    motor_b = store.variants["motor_b"]

    steps = compute_changeover_steps(motor_a, motor_b)
    step_ids = [s.step_id for s in steps]

    assert step_ids == [
        "step_fixture",
        "step_tray",
        "step_fasteners",
        "step_tool_preset",
        "step_inspection",
        "step_readiness"
    ]

    # Verify diff reasons are populated
    for s in steps:
        assert len(s.diff_reason) > 5

    # Check verification types
    assert steps[0].verification_type == "camera"
    assert steps[1].verification_type == "camera"
    assert steps[2].verification_type == "operator"
    assert steps[3].verification_type == "esp32"
    assert steps[4].verification_type == "operator"
    assert steps[5].verification_type == "operator"

def test_partial_diff_only_tool_changes():
    # If two variants share fixture, tray, and fasteners but have different tool torque
    var1 = Variant(
        id="var1",
        name="Variant 1",
        code="V1",
        fixture_tag="TAG-COMMON",
        tray_tag="TRAY-COMMON",
        fasteners="M4x10",
        tool_preset_id="preset_1",
        tool_preset_name="Preset 1",
        target_torque_nm=8.0,
        sop_id="SOP-1",
        approved_sop_version="v1.0"
    )
    var2 = Variant(
        id="var2",
        name="Variant 2",
        code="V2",
        fixture_tag="TAG-COMMON",
        tray_tag="TRAY-COMMON",
        fasteners="M4x10",
        tool_preset_id="preset_2",
        tool_preset_name="Preset 2",
        target_torque_nm=12.0,
        sop_id="SOP-1",
        approved_sop_version="v1.0"
    )

    steps = compute_changeover_steps(var1, var2)
    step_ids = [s.step_id for s in steps]

    # Only tool preset + 2 mandatory quality/readiness steps
    assert step_ids == ["step_tool_preset", "step_inspection", "step_readiness"]
    assert steps[0].expected_value == "preset_2"
