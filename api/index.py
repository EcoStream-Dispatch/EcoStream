"""
EcoStream API (spec section 5).

Run locally (from the api folder):
    uvicorn index:app --reload --port 8000
    then open http://localhost:8000/docs for a page where you can try every endpoint.

On Vercel this file is the serverless function; all /api/* requests are sent here.

This file only handles HTTP (parsing, auth, status codes). The real work is in:
    ingest.py      - storing readings and raising alerts
    alert_logic.py - the alert rules
    fleet.py       - truck status and nearest garages
    db.py          - Supabase access
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from uuid import UUID

# Make sibling modules importable when Vercel runs this file from another folder.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

import db  # noqa: E402
import settings  # noqa: E402
from fleet import build_truck_summaries, nearest_open_garages  # noqa: E402
from ingest import IncomingReading, process_ingest  # noqa: E402
from security import bearer_token, hash_device_key  # noqa: E402

app = FastAPI(title="EcoStream API", version="0.1.0")


@app.exception_handler(settings.MissingSetting)
def missing_setting(_: Request, exc: settings.MissingSetting):
    """A clear message instead of a bare 500 when .env / Vercel settings are incomplete."""
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Dependencies (tests swap these out with app.dependency_overrides)
# ---------------------------------------------------------------------------


def get_ingest_store():
    return db.IngestRepo()


def get_device_key_salt() -> str:
    return settings.device_key_salt()


class Owner(BaseModel):
    id: str
    token: str


def get_owner(authorization: Annotated[Optional[str], Header()] = None) -> Owner:
    """Checks the 'Authorization: Bearer <Supabase access token>' header."""
    token = bearer_token(authorization)
    if not token:
        raise HTTPException(401, "Log in first (missing Authorization: Bearer token)")
    owner_id = db.owner_id_from_token(token)
    if not owner_id:
        raise HTTPException(401, "Login expired or invalid. Please log in again.")
    return Owner(id=owner_id, token=token)


def get_owner_repo(owner: Annotated[Owner, Depends(get_owner)]) -> db.OwnerRepo:
    return db.OwnerRepo(owner.token)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------------------------------------------------------------------------
# Ingest (device / simulator)
# ---------------------------------------------------------------------------


class IngestReadingIn(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=32)
    ts: datetime
    pressure_kpa: float
    temp_c: float
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    rssi: Optional[int] = None
    ambient_c: Optional[float] = None


class IngestBody(BaseModel):
    device_id: UUID
    readings: list[IngestReadingIn] = Field(min_length=1, max_length=500)


@app.post("/api/ingest")
def ingest(
    body: IngestBody,
    x_device_key: Annotated[Optional[str], Header()] = None,
    store=Depends(get_ingest_store),
    salt: str = Depends(get_device_key_salt),
):
    if not x_device_key:
        raise HTTPException(401, "Missing X-Device-Key header")
    device = store.find_device(str(body.device_id), hash_device_key(x_device_key, salt))
    if not device:
        raise HTTPException(401, "Unknown device or wrong device key")

    result = process_ingest(
        store,
        device,
        [IncomingReading(**r.model_dump()) for r in body.readings],
        now=utc_now(),
    )
    return {
        "accepted": result.accepted,
        "rejected": result.rejected,
        "alerts_created": [{"type": a["type"], "severity": a["severity"]} for a in result.alerts],
    }


# ---------------------------------------------------------------------------
# Owner endpoints (row-level security applies through OwnerRepo)
# ---------------------------------------------------------------------------


@app.get("/api/trucks")
def list_trucks(repo: Annotated[db.OwnerRepo, Depends(get_owner_repo)]):
    """The owner's trucks with latest tyre status (shape: TruckSummary in frontend/src/types.ts)."""
    trucks = repo.trucks()
    ids = [t["id"] for t in trucks]
    return build_truck_summaries(
        trucks,
        repo.tyres(ids),
        repo.latest_readings(ids),
        repo.alerts(open_only=True),
        utc_now(),
    )


@app.get("/api/trucks/{truck_id}/readings")
def truck_readings(
    truck_id: UUID,
    repo: Annotated[db.OwnerRepo, Depends(get_owner_repo)],
    from_: Annotated[Optional[datetime], Query(alias="from")] = None,
    to: Optional[datetime] = None,
):
    """Readings for charts. Default: last 2 hours. At most 24 hours per request."""
    end = to or utc_now()
    start = from_ or end - timedelta(hours=2)
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if start >= end:
        raise HTTPException(400, "'from' must be before 'to'")
    if end - start > timedelta(hours=24):
        raise HTTPException(400, "Ask for 24 hours or less at a time")
    if not repo.truck(str(truck_id)):
        raise HTTPException(404, "Truck not found")  # also when it belongs to someone else
    tyre_ids = [t["id"] for t in repo.tyres([str(truck_id)])]
    return repo.readings(tyre_ids, start, end)


@app.get("/api/alerts")
def list_alerts(
    repo: Annotated[db.OwnerRepo, Depends(get_owner_repo)],
    open: Optional[bool] = None,  # noqa: A002 - name comes from the spec (?open=true)
):
    """Newest first. ?open=true for open only, ?open=false for acknowledged only, nothing for all."""
    return repo.alerts(open_only=open)


@app.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(
    alert_id: UUID,
    repo: Annotated[db.OwnerRepo, Depends(get_owner_repo)],
):
    # Row-level security: if the owner can't see it, it isn't theirs.
    if not repo.alert(str(alert_id)):
        raise HTTPException(404, "Alert not found")
    # Owners can't write to the alerts table directly, so the API does it.
    return db.IngestRepo().acknowledge_alert(str(alert_id), utc_now())


@app.get("/api/garages/nearest")
def garages_nearest(
    repo: Annotated[db.OwnerRepo, Depends(get_owner_repo)],
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    service: str = "tyre",
):
    """3 nearest garages offering `service` that are open now (IST), with straight-line distance in km."""
    return nearest_open_garages(repo.garages(), lat, lon, service, utc_now())
