"""
Owner endpoints over HTTP, with login and the database replaced by fakes.
Checks the JSON shapes the frontend expects and the acknowledge flow.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import index
from fakes import DEVICE_ID, DEVICE_KEY, OWNER_ID, SALT, TRUCK_ID, FakeOwnerRepo, FakeStore
from security import hash_device_key

AUTH = {"Authorization": "Bearer test-token"}


@pytest.fixture
def store():
    return FakeStore(hash_device_key(DEVICE_KEY, SALT))


@pytest.fixture
def client(store):
    index.app.dependency_overrides[index.get_ingest_store] = lambda: store
    index.app.dependency_overrides[index.get_device_key_salt] = lambda: SALT
    index.app.dependency_overrides[index.get_owner] = lambda: index.Owner(id=OWNER_ID, token="test-token")
    index.app.dependency_overrides[index.get_owner_repo] = lambda: FakeOwnerRepo(store)
    yield TestClient(index.app)
    index.app.dependency_overrides.clear()


def send(client, readings):
    r = client.post("/api/ingest", json={"device_id": DEVICE_ID, "readings": readings},
                    headers={"X-Device-Key": DEVICE_KEY})
    assert r.status_code == 200, r.text
    return r.json()


def reading(sensor, pressure=900.0, temp=40.0, minutes_ago=0.0):
    ts = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    return {"sensor_id": sensor, "ts": ts.isoformat(), "pressure_kpa": pressure, "temp_c": temp,
            "lat": 12.9165, "lon": 79.1325}


def test_trucks_shape(client):
    send(client, [reading(f"1A000{i}") for i in range(1, 7)])
    [truck] = client.get("/api/trucks", headers=AUTH).json()
    assert truck["id"] == TRUCK_ID
    assert truck["status"] == "ok"
    assert truck["open_alerts"] == 0
    assert truck["last_seen_at"] is not None
    assert (truck["lat"], truck["lon"]) == (12.9165, 79.1325)
    assert len(truck["tyres"]) == 6
    t = truck["tyres"][0]
    assert t["status"] == "ok"
    assert set(t["latest"]) == {"ts", "pressure_kpa", "corrected_kpa", "temp_c"}


def test_critical_alert_shows_on_truck_and_can_be_acknowledged(client):
    # 600 kPa at 20 °C = 72% of 830: critical
    out = send(client, [reading("1A0003", pressure=600, temp=20)])
    assert out["alerts_created"] == [{"type": "critical_pressure", "severity": "critical"}]

    [truck] = client.get("/api/trucks", headers=AUTH).json()
    assert truck["status"] == "critical"
    assert next(t for t in truck["tyres"] if t["position"] == "RL-O")["status"] == "critical"

    [alert] = client.get("/api/alerts?open=true", headers=AUTH).json()
    r = client.post(f"/api/alerts/{alert['id']}/ack", headers=AUTH)
    assert r.status_code == 200
    assert r.json()["acknowledged_at"] is not None

    assert client.get("/api/alerts?open=true", headers=AUTH).json() == []
    assert len(client.get("/api/alerts?open=false", headers=AUTH).json()) == 1
    assert client.get("/api/trucks", headers=AUTH).json()[0]["status"] == "ok"


def test_resolve_marks_resolved_and_acknowledged(client):
    send(client, [reading("1A0003", pressure=600, temp=20)])
    [alert] = client.get("/api/alerts?open=true", headers=AUTH).json()
    r = client.post(f"/api/alerts/{alert['id']}/resolve", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["resolved_at"] is not None
    assert body["acknowledged_at"] is not None  # resolving also acknowledges
    assert client.get("/api/alerts?open=true", headers=AUTH).json() == []
    assert client.get("/api/trucks", headers=AUTH).json()[0]["status"] == "ok"


def test_resolve_after_ack_keeps_first_ack_time(client):
    send(client, [reading("1A0003", pressure=600, temp=20)])
    [alert] = client.get("/api/alerts?open=true", headers=AUTH).json()
    acked = client.post(f"/api/alerts/{alert['id']}/ack", headers=AUTH).json()
    resolved = client.post(f"/api/alerts/{alert['id']}/resolve", headers=AUTH).json()
    assert resolved["acknowledged_at"] == acked["acknowledged_at"]
    assert resolved["resolved_at"] is not None


def test_resolve_unknown_alert_is_404(client):
    r = client.post("/api/alerts/11111111-1111-4111-8111-999999999999/resolve", headers=AUTH)
    assert r.status_code == 404


def test_ack_unknown_alert_is_404(client):
    r = client.post("/api/alerts/11111111-1111-4111-8111-999999999999/ack", headers=AUTH)
    assert r.status_code == 404


def test_readings_default_last_2_hours(client):
    send(client, [reading("1A0001", minutes_ago=m) for m in (180, 60, 1)])
    rows = client.get(f"/api/trucks/{TRUCK_ID}/readings", headers=AUTH).json()
    assert len(rows) == 2
    assert {"id", "tyre_id", "ts", "pressure_kpa", "corrected_kpa", "temp_c"} <= set(rows[0])


def test_readings_other_truck_is_404(client):
    r = client.get("/api/trucks/11111111-1111-4111-8111-000000000099/readings", headers=AUTH)
    assert r.status_code == 404


def test_readings_window_limits(client):
    now = datetime.now(timezone.utc)
    q = lambda a, b: f"/api/trucks/{TRUCK_ID}/readings?from={a.isoformat()}&to={b.isoformat()}".replace("+", "%2B")
    assert client.get(q(now, now - timedelta(hours=1)), headers=AUTH).status_code == 400
    assert client.get(q(now - timedelta(hours=25), now), headers=AUTH).status_code == 400


def test_nearest_garages(client):
    rows = client.get("/api/garages/nearest?lat=12.9165&lon=79.1325", headers=AUTH).json()
    assert len(rows) == 3
    assert rows[0]["name"] == "Sample Tyre Works 5"  # in Vellore itself
    assert "Sample Tyre Works 11" not in [g["name"] for g in rows]  # Salem is the farthest
    assert [g["distance_km"] for g in rows] == sorted(g["distance_km"] for g in rows)
    assert all(g["open_now"] and "distance_km" in g for g in rows)
