"""
Everything that talks to Supabase lives here. Two kinds of access:

  IngestRepo  - uses the SERVICE-ROLE key. Bypasses row-level security.
                Only for /api/ingest and for acknowledging alerts (after we've
                checked the owner can see the alert).

  OwnerRepo   - uses the ANON key + the logged-in owner's token.
                Row-level security applies, so an owner can only ever read their
                own trucks, tyres, readings and alerts - even if this code had a bug.

Tests replace IngestRepo with an in-memory fake (tests/fakes.py), so the
logic in ingest.py can be tested without a database.
"""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any, Callable, Optional, Protocol

from supabase import Client, ClientOptions, create_client

import settings

# Supabase returns at most 1000 rows per request, so bigger reads are fetched in pages.
PAGE_SIZE = 1000

READING_COLUMNS = "tyre_id,ts,pressure_kpa,temp_c,corrected_kpa"


def fetch_all(build_query: Callable[[], Any]) -> list[dict]:
    """Run a query page by page until all rows are fetched. build_query() must return a fresh query."""
    rows: list[dict] = []
    start = 0
    while True:
        page = build_query().range(start, start + PAGE_SIZE - 1).execute().data
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


@lru_cache(maxsize=1)
def service_client() -> Client:
    """One shared service-role client (created on first use)."""
    return create_client(settings.supabase_url(), settings.supabase_service_role_key())


def owner_client(token: str) -> Client:
    """A client that acts as the logged-in owner, so row-level security applies."""
    return create_client(
        settings.supabase_url(),
        settings.supabase_anon_key(),
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"}, persist_session=False),
    )


def owner_id_from_token(token: str) -> Optional[str]:
    """Ask Supabase Auth who this token belongs to. None if the token is invalid or expired."""
    try:
        response = service_client().auth.get_user(token)
    except Exception:  # invalid / expired token, or Auth unreachable
        return None
    return response.user.id if response and response.user else None


# ---------------------------------------------------------------------------
# Ingest (service role)
# ---------------------------------------------------------------------------


class IngestStore(Protocol):
    """What ingest.py needs from the database. IngestRepo and the test fake both provide it."""

    def find_device(self, device_id: str, key_hash: str) -> Optional[dict]: ...
    def tyres_for_truck(self, truck_id: str) -> list[dict]: ...
    def insert_readings(self, rows: list[dict]) -> None: ...
    def readings_since(self, tyre_id: str, since: datetime) -> list[dict]: ...
    def latest_readings(self, tyre_ids: list[str]) -> list[dict]: ...
    def alerts_since(self, truck_id: str, since: datetime) -> list[dict]: ...
    def insert_alerts(self, rows: list[dict]) -> list[dict]: ...
    def touch_device(self, device_id: str, ts: datetime) -> None: ...
    def acknowledge_alert(self, alert_id: str, ts: datetime) -> Optional[dict]: ...


class IngestRepo:
    def __init__(self, client: Optional[Client] = None):
        self.db = client or service_client()

    def find_device(self, device_id: str, key_hash: str) -> Optional[dict]:
        rows = (
            self.db.table("devices")
            .select("id,truck_id")
            .eq("id", device_id)
            .eq("device_key_hash", key_hash)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None

    def tyres_for_truck(self, truck_id: str) -> list[dict]:
        return self.db.table("tyres").select("*").eq("truck_id", truck_id).execute().data

    def insert_readings(self, rows: list[dict]) -> None:
        if rows:
            self.db.table("readings").insert(rows).execute()

    def readings_since(self, tyre_id: str, since: datetime) -> list[dict]:
        return fetch_all(
            lambda: self.db.table("readings")
            .select(READING_COLUMNS)
            .eq("tyre_id", tyre_id)
            .gte("ts", since.isoformat())
            .order("ts")
        )

    def latest_readings(self, tyre_ids: list[str]) -> list[dict]:
        if not tyre_ids:
            return []
        return self.db.table("tyre_latest_reading").select("*").in_("tyre_id", tyre_ids).execute().data

    def alerts_since(self, truck_id: str, since: datetime) -> list[dict]:
        return (
            self.db.table("alerts")
            .select("tyre_id,type,created_at")
            .eq("truck_id", truck_id)
            .gte("created_at", since.isoformat())
            .execute()
            .data
        )

    def insert_alerts(self, rows: list[dict]) -> list[dict]:
        if not rows:
            return []
        return self.db.table("alerts").insert(rows).execute().data

    def touch_device(self, device_id: str, ts: datetime) -> None:
        self.db.table("devices").update({"last_seen_at": ts.isoformat()}).eq("id", device_id).execute()

    def acknowledge_alert(self, alert_id: str, ts: datetime) -> Optional[dict]:
        """Set acknowledged_at if not already set. Call only after checking the owner can see the alert."""
        self.db.table("alerts").update({"acknowledged_at": ts.isoformat()}).eq("id", alert_id).is_(
            "acknowledged_at", "null"
        ).execute()
        rows = self.db.table("alerts").select("*").eq("id", alert_id).limit(1).execute().data
        return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Owner (row-level security applies)
# ---------------------------------------------------------------------------


class OwnerRepo:
    def __init__(self, token: str):
        self.db = owner_client(token)

    def trucks(self) -> list[dict]:
        return self.db.table("trucks").select("*").order("reg_no").execute().data

    def truck(self, truck_id: str) -> Optional[dict]:
        rows = self.db.table("trucks").select("id").eq("id", truck_id).limit(1).execute().data
        return rows[0] if rows else None

    def tyres(self, truck_ids: list[str]) -> list[dict]:
        if not truck_ids:
            return []
        return self.db.table("tyres").select("*").in_("truck_id", truck_ids).order("position").execute().data

    def latest_readings(self, truck_ids: list[str]) -> list[dict]:
        if not truck_ids:
            return []
        return self.db.table("tyre_latest_reading").select("*").in_("truck_id", truck_ids).execute().data

    def readings(self, tyre_ids: list[str], start: datetime, end: datetime) -> list[dict]:
        if not tyre_ids:
            return []
        return fetch_all(
            lambda: self.db.table("readings")
            .select("*")
            .in_("tyre_id", tyre_ids)
            .gte("ts", start.isoformat())
            .lte("ts", end.isoformat())
            .order("ts")
            .order("id")
        )

    def alerts(self, open_only: Optional[bool]) -> list[dict]:
        q = self.db.table("alerts").select("*")
        if open_only is True:
            q = q.is_("acknowledged_at", "null")
        elif open_only is False:
            q = q.not_.is_("acknowledged_at", "null")
        return q.order("created_at", desc=True).limit(200).execute().data

    def alert(self, alert_id: str) -> Optional[dict]:
        rows = self.db.table("alerts").select("*").eq("id", alert_id).limit(1).execute().data
        return rows[0] if rows else None

    def garages(self) -> list[dict]:
        return self.db.table("garages").select("*").execute().data
