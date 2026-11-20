from typing import Optional
from app.models import ExplainResponse

RULES = {
    "fixture_mismatch": {
        "summary": "Incorrect assembly fixture mounted on workstation.",
        "explanation": "Overhead vision camera detected AprilTag {actual}, but changeover specification requires Fixture B ({expected}). Fixture A geometry cannot correctly seat Motor B stator housing and locating dowels.",
        "safety_quality_impact": "Mounting stator in incorrect fixture causes concentricity deviation, rotor rub, and severe line stoppage.",
        "recommended_action": "1. Unclamp fixture {actual}. 2. Retrieve Fixture B ({expected}) from the tooling rack. 3. Lock into alignment pins. 4. Trigger re-verification."
    },
    "tray_mismatch": {
        "summary": "Component kit tray mismatch.",
        "explanation": "Overhead vision detected kit tray {actual}. Procedure requires Tray B ({expected}) containing designated Motor B subcomponents, terminal block, and wave springs.",
        "safety_quality_impact": "Using wrong component kit results in electrical winding failure and immediate inspection quarantine.",
        "recommended_action": "Remove tray {actual} from staging area and place Tray B ({expected}). Ensure AprilTag is clearly visible to overhead camera."
    },
    "tool_preset_mismatch": {
        "summary": "Digital torque tool preset mismatch.",
        "explanation": "ESP32 smart tool telemetry reports {actual}, but Motor B fastening specifications mandate {expected}.",
        "safety_quality_impact": "Fastener under-torquing causes assembly vibration loosening; over-torquing strips aluminum casing threads.",
        "recommended_action": "Toggle the digital wrench selector to {expected}. Confirm green telemetry LED and trigger re-check."
    },
    "sop_version_superseded": {
        "summary": "Outdated Standard Operating Procedure (SOP) loaded.",
        "explanation": "Station terminal has loaded SOP {actual}, which is superseded. Quality Engineering approved {expected} with updated torque tolerances and mandatory dielectric pre-checks.",
        "safety_quality_impact": "Executing changeovers on obsolete SOP versions violates ISO 9001 compliance and produces uncertified assemblies.",
        "recommended_action": "Click 'Reload Approved SOP' to immediately sync station work instructions to approved version {expected}."
    },
    "step_skipped": {
        "summary": "Workflow sequence violation: attempted step skip.",
        "explanation": "Deterministic workflow engine blocked progress. Step {step_id} is incomplete. EcoStream Dispatch quality gates strictly prohibit bypassing verification steps.",
        "safety_quality_impact": "Unverified steps carry latent defects into downstream manufacturing phases.",
        "recommended_action": "Follow instructions for the current active step and complete required verification before continuing."
    },
    "tyre_slow_leak": {
        "summary": "Linear pneumatic pressure degradation detected.",
        "explanation": "Least-squares trend analysis reveals steady negative pressure slope of {actual} PSI/hour under nominal operating temperatures.",
        "safety_quality_impact": "Continued driving will lead to sidewall flex overheat, increased rolling resistance, and catastrophic tread separation.",
        "recommended_action": "1. Inspect tread for puncture debris or valve stem leak. 2. Acknowledge alert. 3. Schedule pit maintenance within estimated window."
    },
    "tyre_sudden_drop": {
        "summary": "Acute pressure drop detected.",
        "explanation": "Telemetry indicates sudden drop exceeding 10 PSI within 60 seconds.",
        "safety_quality_impact": "High blowout risk, vehicle instability during braking or maneuvering.",
        "recommended_action": "Immediate driver notification to pull over safely. Visual tire integrity check required."
    },
    "tyre_overheat": {
        "summary": "Thermal overload threshold exceeded.",
        "explanation": "Tyre internal temperature elevated above 90°C with pressure elevation.",
        "safety_quality_impact": "Rubber vulcanization degradation and elevated blowout probability.",
        "recommended_action": "Inspect brake drum dragging, wheel bearing heat transfer, or chronic underinflation history."
    }
}

def get_explanation(fault_type: str, expected: Optional[str] = None, actual: Optional[str] = None, step_id: Optional[str] = None) -> ExplainResponse:
    template = RULES.get(fault_type, {
        "summary": "Operational deviation detected.",
        "explanation": "A telemetry parameter deviated from nominal engineering limits. Expected: {expected}, Actual: {actual}.",
        "safety_quality_impact": "Potential impact to production quality or operational safety.",
        "recommended_action": "Inspect station hardware or contact shift supervisor."
    })
    
    exp = template["explanation"].format(
        expected=expected or "nominal",
        actual=actual or "deviated",
        step_id=step_id or "current"
    )
    rec = template["recommended_action"].format(
        expected=expected or "nominal",
        actual=actual or "deviated",
        step_id=step_id or "current"
    )
    
    return ExplainResponse(
        fault_type=fault_type,
        summary=template["summary"],
        explanation=exp,
        safety_quality_impact=template["safety_quality_impact"],
        recommended_action=rec
    )
