from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

class Variant(BaseModel):
    id: str
    name: str
    code: str
    fixture_tag: str
    tray_tag: str
    fasteners: str
    tool_preset_id: str
    tool_preset_name: str
    target_torque_nm: float
    sop_id: str
    approved_sop_version: str

class Sop(BaseModel):
    id: str
    variant_id: str
    title: str
    version: str
    status: str  # "approved" | "superseded"
    approved_at: Optional[str] = None
    change_notes: str

class StationState(BaseModel):
    station_id: str = "WS-MOTOR-01"
    current_variant_id: str
    mounted_fixture_tag: str
    tray_tag: str
    tool_preset_id: str
    tool_preset_name: str
    tool_torque_nm: float
    loaded_sop_id: str
    loaded_sop_version: str
    camera_online: bool = True
    esp32_online: bool = True
    last_camera_heartbeat: str
    last_esp32_heartbeat: str

class SimStationUpdate(BaseModel):
    mounted_fixture_tag: Optional[str] = None
    tray_tag: Optional[str] = None
    tool_preset_id: Optional[str] = None
    tool_preset_name: Optional[str] = None
    tool_torque_nm: Optional[float] = None
    loaded_sop_id: Optional[str] = None
    loaded_sop_version: Optional[str] = None
    current_variant_id: Optional[str] = None
    camera_online: Optional[bool] = None
    esp32_online: Optional[bool] = None

class TagDetectionPayload(BaseModel):
    tag_id: str
    device_id: str = "CAM-OVERHEAD-01"
    tag_type: str = "fixture"  # "fixture" or "tray"
    confidence: float = 0.99
    timestamp: Optional[str] = None

class ToolPresetPayload(BaseModel):
    preset_id: str
    preset_name: str
    torque_nm: float
    device_id: str = "ESP32-TOOL-01"
    timestamp: Optional[str] = None

class StepVerificationType(str):
    CAMERA = "camera"
    ESP32 = "esp32"
    OPERATOR = "operator"

class Deviation(BaseModel):
    id: str
    step_id: str
    step_title: str
    expected: str
    actual: str
    rule_violation: str
    explanation: str
    suggested_fix: str
    timestamp: str
    corrected: bool = False
    corrected_at: Optional[str] = None

class ChangeoverStep(BaseModel):
    step_id: str
    order: int
    title: str
    description: str
    sop_ref: str
    verification_type: str  # "camera" | "esp32" | "operator"
    expected_value: str
    diff_reason: str
    status: str = "pending"  # "pending" | "active" | "passed" | "failed"
    actual_value: Optional[str] = None
    last_checked_at: Optional[str] = None
    error_message: Optional[str] = None

class StartChangeoverRequest(BaseModel):
    to_variant: str
    operator: str = "Operator Jane Doe"

class ChangeoverSession(BaseModel):
    id: str
    station_id: str = "WS-MOTOR-01"
    from_variant: str
    to_variant: str
    operator: str
    status: str  # "in_progress" | "sop_version_mismatch" | "pending_approval" | "approved" | "rejected" | "completed"
    sop_id: str
    sop_version: str
    current_step_index: int = 0
    steps: List[ChangeoverStep]
    deviations: List[Deviation] = []
    supervisor_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: str
    updated_at: str
    passport_id: Optional[str] = None

class ApproveRequest(BaseModel):
    pin: str
    supervisor: str = "Supervisor Dave"
    notes: Optional[str] = "All changeover parameters verified against SOP."

class RejectRequest(BaseModel):
    reason: str
    supervisor: str = "Supervisor Dave"

class DigitalPassport(BaseModel):
    id: str
    changeover_id: str
    station_id: str
    from_variant: str
    to_variant: str
    operator: str
    supervisor: str
    approved_at: str
    sop_id: str
    sop_version: str
    steps_summary: List[Dict[str, Any]]
    deviations_count: int
    deviations: List[Deviation]
    integrity_hash: str
    canonical_string: str
    status: str = "VALID (DEMO INTEGRITY CHECK)"

class PocTrial(BaseModel):
    id: str
    method: str  # "paper" | "setwise"
    variant: str = "Motor B"
    changeover_time_seconds: int
    errors_by_type: Dict[str, int]
    where_caught: Dict[str, int]  # "at_step", "first_piece", "later"
    skipped_steps_count: int
    rework_required: bool
    record_complete: bool
    operator: str
    timestamp: str
    notes: str = ""

# Fleet Predictive Maintenance Models
class TyreReading(BaseModel):
    timestamp: str
    pressure_psi: float
    temperature_c: float

class TyreState(BaseModel):
    position: str  # FL, FR, RLO, RLI, RRO, RRI
    current_pressure: float
    current_temp: float
    nominal_pressure: float = 110.0
    warning_threshold: float = 104.5  # 95% of 110
    critical_threshold: float = 93.5  # 85% of 110
    slope_psi_per_hour: float = 0.0
    predicted_hours_to_min: Optional[float] = None
    predicted_text: str = "Stable"
    status: str = "nominal"  # "nominal" | "warning" | "critical"
    scenario: Optional[str] = None

class Truck(BaseModel):
    id: str
    name: str
    status: str  # "healthy" | "warning" | "critical"
    last_updated: str
    route: str
    tyres: Dict[str, TyreState]
    recent_readings: Dict[str, List[TyreReading]] = Field(default_factory=dict)

class Alert(BaseModel):
    id: str
    truck_id: str
    tyre_position: str
    severity: str  # "warning" | "critical"
    message: str
    timestamp: str
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[str] = None

class DiagnoseRequest(BaseModel):
    truck_id: str
    tyre: str
    question: Optional[str] = None

class DiagnoseResponse(BaseModel):
    truck_id: str
    tyre: str
    diagnosis: str
    checklist: List[str]
    suggested_action: str

class InjectScenarioRequest(BaseModel):
    truck_id: str
    tyre: str
    scenario: str  # "slow_leak" | "sudden_drop" | "overheat" | "clear"

class ExplainRequest(BaseModel):
    fault_type: str
    step_id: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None

class ExplainResponse(BaseModel):
    fault_type: str
    summary: str
    explanation: str
    safety_quality_impact: str
    recommended_action: str
