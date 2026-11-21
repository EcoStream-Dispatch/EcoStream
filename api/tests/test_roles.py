"""
Stage W2: owner endpoints only work for logins whose profile role is 'owner'.
Login (the token check) and the role lookup are replaced by fakes; the real
get_owner role check runs.
"""

import pytest
from fastapi.testclient import TestClient

import index
from fakes import DEVICE_KEY, OWNER_ID, SALT, FakeOwnerRepo, FakeStore
from security import hash_device_key

AUTH = {"Authorization": "Bearer test-token"}
OWNER_ENDPOINTS = ["/api/trucks", "/api/alerts", "/api/garages/nearest?lat=12.5&lon=78.2"]


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    """Real get_owner and get_owner_repo run; only the database class is a fake."""
    store = FakeStore(hash_device_key(DEVICE_KEY, SALT))
    monkeypatch.setattr(index.db, "OwnerRepo", lambda _token: FakeOwnerRepo(store))
    index.app.dependency_overrides[index.get_ingest_store] = lambda: store
    yield
    index.app.dependency_overrides.clear()


def make_client(role):
    index.app.dependency_overrides[index.get_user] = lambda: index.Owner(id=OWNER_ID, token="test-token")
    index.app.dependency_overrides[index.get_role_lookup] = lambda: (lambda _user_id: role)
    return TestClient(index.app)


@pytest.mark.parametrize("path", OWNER_ENDPOINTS)
def test_owner_role_can_use_owner_api(path):
    assert make_client("owner").get(path, headers=AUTH).status_code == 200


@pytest.mark.parametrize("role", ["driver", "shipper", None])
@pytest.mark.parametrize("path", OWNER_ENDPOINTS)
def test_other_roles_get_403(role, path):
    r = make_client(role).get(path, headers=AUTH)
    assert r.status_code == 403
    assert r.json()["detail"] == "This account is not an owner account."


@pytest.mark.parametrize("role", ["driver", "shipper"])
def test_other_roles_cannot_acknowledge_alerts(role):
    r = make_client(role).post("/api/alerts/00000000-0000-4000-8000-000000000099/ack", headers=AUTH)
    assert r.status_code == 403


def test_no_token_is_still_401_before_role_check():
    # No get_user override: the real token check runs and fails first.
    index.app.dependency_overrides[index.get_role_lookup] = lambda: (lambda _user_id: "owner")
    assert TestClient(index.app).get("/api/trucks").status_code == 401
