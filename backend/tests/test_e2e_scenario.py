import pytest
import httpx
import time

BASE_URL = "http://127.0.0.1:8780"
FRONTEND_URL = "http://127.0.0.1:5173"

@pytest.mark.anyio
async def test_full_e2e_motor_changeover_and_fleet():
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 0. Check Frontend server is serving index.html
        f_resp = await client.get(FRONTEND_URL)
        assert f_resp.status_code == 200
        assert "<title>EcoStream Dispatch" in f_resp.text

        # 1. Reset Demo to Seed State
        res = await client.post(f"{BASE_URL}/api/sim/reset")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # Check Initial Station State
        st_res = await client.get(f"{BASE_URL}/api/station")
        assert st_res.status_code == 200
        station = st_res.json()
        assert station["current_variant_id"] == "motor_a"
        assert station["mounted_fixture_tag"] == "TAG-A-01"
        assert station["loaded_sop_version"] == "v2.0"  # Superseded

        # 2. Start Changeover to Motor B
        start_res = await client.post(
            f"{BASE_URL}/api/changeovers",
            json={"to_variant": "motor_b", "operator": "Operator Jane Doe"}
        )
        assert start_res.status_code == 200
        session = start_res.json()
        session_id = session["id"]
        # Rule 7: SOP is superseded, so status is sop_version_mismatch
        assert session["status"] == "sop_version_mismatch"
        assert len(session["deviations"]) == 1
        assert session["deviations"][0]["rule_violation"] == "SOP_VERSION_SUPERSEDED"

        # 3. Reload Approved SOP (v2.1)
        reload_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/reload-sop")
        assert reload_res.status_code == 200
        session = reload_res.json()
        assert session["status"] == "in_progress"
        assert session["sop_version"] == "v2.1"
        assert session["deviations"][0]["corrected"] is True
        assert session["steps"][0]["status"] == "active"

        # 4. Inject Fault: "Fixture A still mounted"
        sim_res = await client.post(
            f"{BASE_URL}/api/sim/station",
            json={"mounted_fixture_tag": "TAG-A-01"}
        )
        assert sim_res.status_code == 200
        assert sim_res.json()["mounted_fixture_tag"] == "TAG-A-01"

        # 5. Verify Step 1 (step_fixture) -> Must FAIL with deviation
        v1_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/steps/step_fixture/verify")
        assert v1_res.status_code == 200
        v1_data = v1_res.json()
        assert v1_data["passed"] is False
        assert "Incorrect assembly fixture" in v1_data["message"] or "mismatch" in v1_data["message"].lower()
        assert v1_data["deviation"]["rule_violation"] == "FIXTURE_MISMATCH"
        assert v1_data["deviation"]["actual"] == "TAG-A-01"
        assert v1_data["deviation"]["expected"] == "TAG-B-02"

        # Rule 3: Attempting to skip ahead to step_fasteners must return 409
        skip_res = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/steps/step_fasteners/confirm",
            json={"notes": "Trying to skip ahead"}
        )
        assert skip_res.status_code == 409
        assert "Workflow sequence violation" in skip_res.json()["detail"]

        # Rule 2: Attempting to confirm sensor step manually must return 400
        manual_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/steps/step_fixture/confirm")
        assert manual_res.status_code == 400
        assert "cannot be manually confirmed" in manual_res.json()["detail"]

        # 6. Fix It: Camera detects Fixture B (TAG-B-02)
        cam_res = await client.post(
            f"{BASE_URL}/api/device/tag-detections",
            json={"tag_id": "TAG-B-02", "tag_type": "fixture"}
        )
        assert cam_res.status_code == 200

        # Re-verify Step 1 -> Must PASS and mark deviation corrected
        v1_pass_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/steps/step_fixture/verify")
        assert v1_pass_res.status_code == 200
        assert v1_pass_res.json()["passed"] is True
        session = v1_pass_res.json()["session"]
        fixture_dev = [d for d in session["deviations"] if d["step_id"] == "step_fixture"][0]
        assert fixture_dev["corrected"] is True
        assert fixture_dev["corrected_at"] is not None
        assert session["steps"][1]["status"] == "active"

        # 7. Step 2: Component Tray B
        # Camera detects Tray B (TRAY-B-02)
        await client.post(
            f"{BASE_URL}/api/device/tag-detections",
            json={"tag_id": "TRAY-B-02", "tag_type": "tray"}
        )
        v2_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/steps/step_tray/verify")
        assert v2_res.status_code == 200
        assert v2_res.json()["passed"] is True

        # 8. Step 3: Fasteners (Operator Confirmation)
        conf_fasteners = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/steps/step_fasteners/confirm",
            json={"notes": "M5x16 Black Oxide staged in bins."}
        )
        assert conf_fasteners.status_code == 200
        assert conf_fasteners.json()["passed"] is True

        # 9. Step 4: Tool Preset via ESP32 Telemetry
        esp_res = await client.post(
            f"{BASE_URL}/api/device/tool-preset",
            json={"preset_id": "preset_2", "preset_name": "Preset 2 (12.5 Nm)", "torque_nm": 12.5}
        )
        assert esp_res.status_code == 200
        v_tool_res = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/steps/step_tool_preset/verify")
        assert v_tool_res.status_code == 200
        assert v_tool_res.json()["passed"] is True

        # Rule 5 / Rule 3: Cannot confirm readiness before inspection passes
        readiness_early = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/steps/step_readiness/confirm"
        )
        assert readiness_early.status_code == 409
        assert "Workflow sequence violation" in readiness_early.json()["detail"] or "prior setup and inspection" in readiness_early.json()["detail"]

        # 10. Step 5: First-Piece Inspection (Operator Confirmation)
        conf_insp = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/steps/step_inspection/confirm",
            json={"notes": "Pilot unit dielectric resistance and axial play verified."}
        )
        assert conf_insp.status_code == 200

        # 11. Step 6: Confirm Station Readiness
        conf_ready = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/steps/step_readiness/confirm"
        )
        assert conf_ready.status_code == 200
        session = conf_ready.json()["session"]
        assert session["status"] == "pending_approval"

        # 12. Request Approval
        req_app = await client.post(f"{BASE_URL}/api/changeovers/{session_id}/request-approval")
        assert req_app.status_code == 200

        # Rule 6: Wrong PIN must be rejected with 403
        wrong_pin_res = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/approve",
            json={"pin": "9999", "supervisor": "Supervisor Dave"}
        )
        assert wrong_pin_res.status_code == 403

        # Rule 6 & 8: Correct PIN 1234 approves changeover and seals Digital Passport
        approve_res = await client.post(
            f"{BASE_URL}/api/changeovers/{session_id}/approve",
            json={"pin": "1234", "supervisor": "Supervisor Dave Miller", "notes": "Approved against SOP-MTR-B-01 v2.1."}
        )
        assert approve_res.status_code == 200
        passport = approve_res.json()
        assert passport["changeover_id"] == session_id
        assert len(passport["integrity_hash"]) == 64
        assert passport["status"] == "VALID (DEMO INTEGRITY CHECK)"
        assert passport["deviations_count"] >= 1

        # Check passport retrieval
        psp_res = await client.get(f"{BASE_URL}/api/passports/{passport['id']}")
        assert psp_res.status_code == 200
        assert psp_res.json()["integrity_hash"] == passport["integrity_hash"]

        # 13. Verify Module 2 Fleet Predictive Maintenance
        # Inject slow leak on TRK-04
        inject_res = await client.post(
            f"{BASE_URL}/api/sim/inject",
            json={"truck_id": "TRK-04", "tyre": "RLO", "scenario": "slow_leak"}
        )
        assert inject_res.status_code == 200

        # Fetch TRK-04 detail
        trk_res = await client.get(f"{BASE_URL}/api/fleet/TRK-04")
        assert trk_res.status_code == 200
        trk = trk_res.json()
        assert trk["tyres"]["RLO"]["scenario"] == "slow_leak"

        # Ask-EcoStream rule-based diagnosis
        diag_res = await client.post(
            f"{BASE_URL}/api/diagnose",
            json={"truck_id": "TRK-04", "tyre": "RLO", "question": "What is the diagnosis?"}
        )
        assert diag_res.status_code == 200
        diag_data = diag_res.json()
        assert len(diag_data["checklist"]) >= 3
        assert "punct" in diag_data["diagnosis"].lower() or "degrad" in diag_data["diagnosis"].lower()

        # Check alerts
        alerts_res = await client.get(f"{BASE_URL}/api/alerts")
        assert alerts_res.status_code == 200
        alerts = alerts_res.json()
        trk4_alert = [a for a in alerts if a["truck_id"] == "TRK-04"][0]

        # Acknowledge alert
        ack_res = await client.post(f"{BASE_URL}/api/alerts/{trk4_alert['id']}/ack")
        assert ack_res.status_code == 200
        assert ack_res.json()["alert"]["acknowledged"] is True

        # Resolve alert
        res_alert = await client.post(f"{BASE_URL}/api/alerts/{trk4_alert['id']}/resolve")
        assert res_alert.status_code == 200
        assert res_alert.json()["alert"]["resolved"] is True

        # 14. Check Devices endpoint
        dev_res = await client.get(f"{BASE_URL}/api/devices")
        assert dev_res.status_code == 200
        dev_data = dev_res.json()
        assert len(dev_data["devices"]) == 2
        assert len(dev_data["events"]) > 0

        # 15. Check POC Trials endpoint
        trials_res = await client.get(f"{BASE_URL}/api/poc/trials")
        assert trials_res.status_code == 200
        # Passport approval auto-created a SetWise trial
        assert any(t["method"] == "setwise" for t in trials_res.json())
