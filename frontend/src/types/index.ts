export interface Variant {
  id: string;
  name: string;
  code: string;
  fixture_tag: string;
  tray_tag: string;
  fasteners: string;
  tool_preset_id: string;
  tool_preset_name: string;
  target_torque_nm: number;
  sop_id: string;
  approved_sop_version: string;
}

export interface Sop {
  id: string;
  variant_id: string;
  title: string;
  version: string;
  status: 'approved' | 'superseded';
  approved_at?: string;
  change_notes: string;
}

export interface StationState {
  station_id: string;
  current_variant_id: string;
  mounted_fixture_tag: string;
  tray_tag: string;
  tool_preset_id: string;
  tool_preset_name: string;
  tool_torque_nm: number;
  loaded_sop_id: string;
  loaded_sop_version: string;
  camera_online: boolean;
  esp32_online: boolean;
  last_camera_heartbeat: string;
  last_esp32_heartbeat: string;
}

export interface ChangeoverStep {
  step_id: string;
  order: number;
  title: string;
  description: string;
  sop_ref: string;
  verification_type: 'camera' | 'esp32' | 'operator';
  expected_value: string;
  diff_reason: string;
  status: 'pending' | 'active' | 'passed' | 'failed';
  actual_value?: string;
  last_checked_at?: string;
  error_message?: string;
}

export interface Deviation {
  id: string;
  step_id: string;
  step_title: string;
  expected: string;
  actual: string;
  rule_violation: string;
  explanation: string;
  suggested_fix: string;
  timestamp: string;
  corrected: boolean;
  corrected_at?: string;
}

export interface ChangeoverSession {
  id: string;
  station_id: string;
  from_variant: string;
  to_variant: string;
  operator: string;
  status: 'in_progress' | 'sop_version_mismatch' | 'pending_approval' | 'approved' | 'rejected' | 'completed';
  sop_id: string;
  sop_version: string;
  current_step_index: number;
  steps: ChangeoverStep[];
  deviations: Deviation[];
  supervisor_notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  passport_id?: string;
}

export interface DigitalPassport {
  id: string;
  changeover_id: string;
  station_id: string;
  from_variant: string;
  to_variant: string;
  operator: string;
  supervisor: string;
  approved_at: string;
  sop_id: string;
  sop_version: string;
  steps_summary: {
    step_id: string;
    order: number;
    title: string;
    verification_type: string;
    expected_value: string;
    actual_value?: string;
    status: string;
    diff_reason: string;
  }[];
  deviations_count: number;
  deviations: Deviation[];
  integrity_hash: string;
  canonical_string: string;
  status: string;
}

export interface PocTrial {
  id: string;
  method: 'paper' | 'setwise';
  variant: string;
  changeover_time_seconds: number;
  errors_by_type: Record<string, number>;
  where_caught: Record<string, number>;
  skipped_steps_count: number;
  rework_required: boolean;
  record_complete: boolean;
  operator: string;
  timestamp: string;
  notes: string;
}

export interface TyreReading {
  timestamp: string;
  pressure_psi: number;
  temperature_c: number;
}

export interface TyreState {
  position: 'FL' | 'FR' | 'RLO' | 'RLI' | 'RRO' | 'RRI';
  current_pressure: number;
  current_temp: number;
  nominal_pressure: number;
  warning_threshold: number;
  critical_threshold: number;
  slope_psi_per_hour: number;
  predicted_hours_to_min?: number;
  predicted_text: string;
  status: 'nominal' | 'warning' | 'critical';
  scenario?: 'slow_leak' | 'sudden_drop' | 'overheat' | null;
}

export interface Truck {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  last_updated: string;
  route: string;
  tyres: Record<string, TyreState>;
  recent_readings: Record<string, TyreReading[]>;
}

export interface Alert {
  id: string;
  truck_id: string;
  tyre_position: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface DiagnoseResponse {
  truck_id: string;
  tyre: string;
  diagnosis: string;
  checklist: string[];
  suggested_action: string;
}

export interface ExplainResponse {
  fault_type: string;
  summary: string;
  explanation: string;
  safety_quality_impact: string;
  recommended_action: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'camera' | 'esp32';
  location: string;
  online: boolean;
  last_heartbeat: string;
  current_readings: Record<string, any>;
}

export interface DeviceEvent {
  device: string;
  type: string;
  tag_id?: string;
  preset_id?: string;
  torque_nm?: number;
  confidence?: number;
  timestamp: string;
  status: string;
}
