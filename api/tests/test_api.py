"""HTTP-level tests for index.py: status codes, auth headers, request validation."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import index
from fakes import DEVICE_ID, DEVICE_KEY, SALT, FakeStore
from security import hash_device_key


@pytest.fixture
def store():
    return FakeStore(hash_device_key(DEVICE_KEY, SALT))


@pytest.fixture
def client(store):
    index.app.dependency_overrides[index.get_ingest_store] = lambda: store
    index.app.dependency_overrides[index.get_device_key_salt] = lambda: SALT
    yield TestClient(index.app)
    index.app.dependency_overrides.clear()


def body(n=1, **reading):
    now = datetime.now(timezone.utc).isoformat()
    r = {"sensor_id": "1A0001", "ts": now, "pressure_kpa": 850.0, "temp_c": 35.0, **reading}
    return {"device_id": DEVICE_ID, "readings": [r] * n}


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_ingest_without_key_is_401(client):
    assert client.post("/api/ingest", json=body()).status_code == 401


def test_ingest_with_wrong_key_is_401(client):
    r = client.post("/api/ingest", json=body(), headers={"X-Device-Key": "wrong"})
    assert r.status_code == 401


def test_ingest_with_right_key_stores_readings(client, store):
    r = client.post("/api/ingest", json=body(), headers={"X-Device-Key": DEVICE_KEY})
    assert r.status_code == 200, r.text
    assert r.json() == {"accepted": 1, "rejected": [], "alerts_created": []}
    assert len(store.readings) == 1


def test_ingest_reports_rejected_readings(client):
    r = client.post("/api/ingest", json=body(pressure_kpa=2000), headers={"X-Device-Key": DEVICE_KEY})
    assert r.status_code == 200
    assert r.json()["accepted"] == 0
    assert "pressure_kpa" in r.json()["rejected"][0]["reason"]


def test_ingest_batch_too_big_is_422(client):
    r = client.post("/api/ingest", json=body(n=501), headers={"X-Device-Key": DEVICE_KEY})
    assert r.status_code == 422


def test_ingest_bad_device_id_is_422(client):
    b = body()
    b["device_id"] = "not-a-uuid"
    assert client.post("/api/ingest", json=b, headers={"X-Device-Key": DEVICE_KEY}).status_code == 422


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/api/trucks"),
        ("get", "/api/trucks/11111111-1111-4111-8111-000000000001/readings"),
        ("get", "/api/alerts?open=true"),
        ("post", "/api/alerts/11111111-1111-4111-8111-000000000009/ack"),
        ("get", "/api/garages/nearest?lat=12.9&lon=79.1"),
    ],
)
def test_owner_endpoints_need_login(client, method, path):
    assert getattr(client, method)(path).status_code == 401
    assert getattr(client, method)(path, headers={"Authorization": "Basic abc"}).status_code == 401
