import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from app.models import (
    Variant, Sop, StationState, ChangeoverSession, DigitalPassport,
    PocTrial, Truck, TyreState, TyreReading, Alert
)

def utc_now_str() -> str:
    return datetime.now(timezone.utc).isoformat()

class DataStore:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.version = 1
        self.listeners: List[asyncio.Queue] = []
        
        self.variants: Dict[str, Variant] = {}
        self.sops: Dict[str, List[Sop]] = {}
        self.station_state: StationState = None # type: ignore
        self.changeovers: Dict[str, ChangeoverSession] = {}
        self.passports: Dict[str, DigitalPassport] = {}
        self.poc_trials: List[PocTrial] = []
        self.trucks: Dict[str, Truck] = {}
        self.alerts: List[Alert] = []
        self.device_events: List[Dict[str, Any]] = []

        self.reset_to_seed()

    def reset_to_seed(self):
        now = utc_now_str()
        self.version += 1

        # 1. Variants
        self.variants = {
            "motor_a": Variant(
                id="motor_a",
                name="EcoStream High-Torque Motor A",
                code="MTR-A-STD",
                fixture_tag="TAG-A-01",
                tray_tag="TRAY-A-01",
                fasteners="M4x10 Zinc Plated (4x)",
                tool_preset_id="preset_1",
                tool_preset_name="Preset 1 (8.0 Nm)",
                target_torque_nm=8.0,
                sop_id="SOP-MTR-A-01",
                approved_sop_version="v1.4"
            ),
            "motor_b": Variant(
                id="motor_b",
                name="EcoStream High-Torque Motor B",
                code="MTR-B-PRO",
                fixture_tag="TAG-B-02",
                tray_tag="TRAY-B-02",
                fasteners="M5x16 Black Oxide (6x)",
                tool_preset_id="preset_2",
                tool_preset_name="Preset 2 (12.5 Nm)",
                target_torque_nm=12.5,
                sop_id="SOP-MTR-B-01",
                approved_sop_version="v2.1"
            )
        }

        # 2. SOP Catalog
        self.sops = {
            "SOP-MTR-A-01": [
                Sop(
                    id="SOP-MTR-A-01",
                    variant_id="motor_a",
                    title="Workstation Standard Operating Procedure - Motor A Assembly",
                    version="v1.4",
                    status="approved",
                    approved_at="2026-08-15T08:00:00Z",
                    change_notes="Standard production baseline with calibrated 8.0 Nm fasteners."
                )
            ],
            "SOP-MTR-B-01": [
                Sop(
                    id="SOP-MTR-B-01",
                    variant_id="motor_b",
                    title="Workstation Standard Operating Procedure - Motor B Assembly",
                    version="v2.0",
                    status="superseded",
                    approved_at="2026-01-10T10:00:00Z",
                    change_notes="Superseded by v2.1 due to upgraded fastener grade and mandatory dielectric pre-check."
                ),
                Sop(
                    id="SOP-MTR-B-01",
                    variant_id="motor_b",
                    title="Workstation Standard Operating Procedure - Motor B Assembly",
                    version="v2.1",
                    status="approved",
                    approved_at="2026-09-01T09:30:00Z",
                    change_notes="Mandates M5x16 Black Oxide fasteners at 12.5 Nm and 2-point dielectric resistance check."
                )
            ]
        }

        # 3. Workstation physical state (simulated initial: Motor A mounted, superseded SOP loaded)
        self.station_state = StationState(
            station_id="WS-MOTOR-01",
            current_variant_id="motor_a",
            mounted_fixture_tag="TAG-A-01",
            tray_tag="TRAY-A-01",
            tool_preset_id="preset_1",
            tool_preset_name="Preset 1 (8.0 Nm)",
            tool_torque_nm=8.0,
            loaded_sop_id="SOP-MTR-B-01",
            loaded_sop_version="v2.0",  # Deliberately seeded as superseded for realistic demo detection!
            camera_online=True,
            esp32_online=True,
            last_camera_heartbeat=now,
            last_esp32_heartbeat=now
        )

        # 4. Changeovers and Passports
        self.changeovers = {}
        self.passports = {}

        # 5. POC Trials (Pre-seeded with realistic trial data for demonstration)
        self.poc_trials = [
            PocTrial(
                id="TRIAL-001",
                method="paper",
                variant="Motor B",
                changeover_time_seconds=1240,
                errors_by_type={"wrong_fixture": 1, "wrong_tool_preset": 1, "skipped_inspection": 0},
                where_caught={"at_step": 0, "first_piece": 1, "later": 1},
                skipped_steps_count=1,
                rework_required=True,
                record_complete=False,
                operator="Operator A",
                timestamp="2026-11-10T09:15:00Z",
                notes="Paper checklist skipped tool torque verification; caught at first piece inspection."
            ),
            PocTrial(
                id="TRIAL-002",
                method="paper",
                variant="Motor B",
                changeover_time_seconds=1380,
                errors_by_type={"wrong_fixture": 0, "wrong_tool_preset": 1, "skipped_inspection": 1},
                where_caught={"at_step": 0, "first_piece": 0, "later": 2},
                skipped_steps_count=2,
                rework_required=True,
                record_complete=False,
                operator="Operator B",
                timestamp="2026-11-11T14:20:00Z",
                notes="Wrong fasteners mounted; discovered during downstream station audit."
            ),
            PocTrial(
                id="TRIAL-003",
                method="paper",
                variant="Motor B",
                changeover_time_seconds=1150,
                errors_by_type={"wrong_fixture": 1, "wrong_tool_preset": 0, "skipped_inspection": 0},
                where_caught={"at_step": 0, "first_piece": 1, "later": 0},
                skipped_steps_count=0,
                rework_required=True,
                record_complete=True,
                operator="Operator C",
                timestamp="2026-11-12T11:05:00Z",
                notes="Fixture A remained clamped; stator rubbed inside fixture."
            ),
            PocTrial(
                id="TRIAL-004",
                method="setwise",
                variant="Motor B",
                changeover_time_seconds=465,
                errors_by_type={"wrong_fixture": 1, "wrong_tool_preset": 0, "skipped_inspection": 0},
                where_caught={"at_step": 1, "first_piece": 0, "later": 0},
                skipped_steps_count=0,
                rework_required=False,
                record_complete=True,
                operator="Operator Jane Doe",
                timestamp="2026-11-14T10:10:00Z",
                notes="Overhead camera caught Fixture A immediately at Step 1; corrected in 30s. Digital passport logged."
            ),
            PocTrial(
                id="TRIAL-005",
                method="setwise",
                variant="Motor B",
                changeover_time_seconds=420,
                errors_by_type={"wrong_fixture": 0, "wrong_tool_preset": 1, "skipped_inspection": 0},
                where_caught={"at_step": 1, "first_piece": 0, "later": 0},
                skipped_steps_count=0,
                rework_required=False,
                record_complete=True,
                operator="Operator John Doe",
                timestamp="2026-11-15T16:45:00Z",
                notes="Tool preset caught by ESP32 stream before fastener engagement. Zero downstream rework."
            )
        ]

        # 6. Fleet Trucks (12 Chennai demo trucks)
        self.trucks = {}
        chennai_routes = [
            "Chennai Port <-> Sriperumbudur Industrial Corridor",
            "Ennore Port <-> Oragadam Auto Cluster",
            "Ambattur <-> Guindy Industrial Estate",
            "Manali Logistics Hub <-> Mahindra World City",
            "Madhavaram Freight Terminal <-> Maraimalai Nagar",
            "Poonamallee <-> Kanchipuram Highway Route",
            "Tiruvallur <-> Sriperumbudur Assembly Zone",
            "Red Hills <-> Chennai Central Freight Depot",
            "Thirumazhisai <-> Vallam Vadagal SIPCOT",
            "Minjur Container Depot <-> Chengalpattu",
            "Gummidipoondi Industrial Complex <-> Koyambedu Market",
            "Irungattukottai SIPCOT <-> Ennore Port Express"
        ]

        positions = ["FL", "FR", "RLO", "RLI", "RRO", "RRI"]
        for i in range(1, 13):
            tid = f"TRK-{i:02d}"
            name = f"Chennai Freightliner #{i:02d}"
            route = chennai_routes[i-1]
            
            tyre_dict: Dict[str, TyreState] = {}
            readings_dict: Dict[str, List[TyreReading]] = {}

            # Seed realistic tyre readings
            for pos in positions:
                # Add minor baseline variance per truck/position
                base_psi = 109.5 + (i % 3) * 0.5 - 0.2
                base_temp = 42.0 + (i % 4) * 1.5

                # Truck 4 RLO is pre-seeded with mild slow leak for instant demo interest
                scenario = None
                if tid == "TRK-04" and pos == "RLO":
                    scenario = "slow_leak"
                    base_psi = 101.8

                tyre_dict[pos] = TyreState(
                    position=pos,
                    current_pressure=round(base_psi, 1),
                    current_temp=round(base_temp, 1),
                    nominal_pressure=110.0,
                    warning_threshold=104.5,
                    critical_threshold=93.5,
                    slope_psi_per_hour=-1.8 if scenario == "slow_leak" else 0.0,
                    predicted_hours_to_min=round((base_psi - 93.5) / 1.8, 1) if scenario == "slow_leak" else None,
                    predicted_text=f"Tyre 4 likely to reach minimum in about 4 h 35 min" if scenario == "slow_leak" else "Stable",
                    status="warning" if scenario == "slow_leak" else "nominal",
                    scenario=scenario
                )

                # 15 historical readings
                readings: List[TyreReading] = []
                for step in range(15):
                    hist_time = datetime.now(timezone.utc).isoformat()
                    # Slightly sloping if slow leak
                    p = base_psi - (14 - step) * 0.08 if scenario == "slow_leak" else base_psi + (step % 3 - 1) * 0.1
                    readings.append(TyreReading(
                        timestamp=hist_time,
                        pressure_psi=round(p, 1),
                        temperature_c=round(base_temp + (step % 2) * 0.3, 1)
                    ))
                readings_dict[pos] = readings

            self.trucks[tid] = Truck(
                id=tid,
                name=name,
                status="warning" if tid == "TRK-04" else "healthy",
                last_updated=now,
                route=route,
                tyres=tyre_dict,
                recent_readings=readings_dict
            )

        # 7. Pre-seeded Alert for TRK-04
        self.alerts = [
            Alert(
                id="ALT-1001",
                truck_id="TRK-04",
                tyre_position="RLO",
                severity="warning",
                message="Predictive threshold warning: RLO tyre pressure degrading at -1.8 PSI/h on Sriperumbudur route.",
                timestamp=now,
                acknowledged=False,
                resolved=False
            )
        ]

        # 8. Device events log
        self.device_events = [
            {"device": "CAM-OVERHEAD-01", "type": "april_tag", "tag_id": "TAG-A-01", "timestamp": now, "status": "active"},
            {"device": "ESP32-TOOL-01", "type": "tool_preset", "preset_id": "preset_1", "torque_nm": 8.0, "timestamp": now, "status": "active"}
        ]

    async def broadcast(self, event_type: str, data: Any):
        self.version += 1
        payload = {"event": event_type, "version": self.version, "data": data, "timestamp": utc_now_str()}
        for queue in list(self.listeners):
            try:
                queue.put_nowait(payload)
            except Exception:
                pass

store = DataStore()
