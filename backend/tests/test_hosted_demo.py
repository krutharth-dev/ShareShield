"""Protected deployment mode checks; do not require access to hosting secrets."""
import base64
import importlib
import os
import sys

import pytest
from fastapi.testclient import TestClient


def load_api(monkeypatch, mode, user="", password=""):
    monkeypatch.setenv("SHARESHIELD_DEPLOYMENT_MODE", mode)
    if user:
        monkeypatch.setenv("SHARESHIELD_DEMO_USER", user)
    else:
        monkeypatch.delenv("SHARESHIELD_DEMO_USER", raising=False)
    if password:
        monkeypatch.setenv("SHARESHIELD_DEMO_PASSWORD", password)
    else:
        monkeypatch.delenv("SHARESHIELD_DEMO_PASSWORD", raising=False)
    from backend import app as app_module
    return importlib.reload(app_module)


def test_protected_demo_fails_closed_without_credentials(monkeypatch):
    with pytest.raises(RuntimeError, match="requires"):
        load_api(monkeypatch, "protected-demo")


def test_protected_demo_requires_basic_auth_and_health_stays_available(monkeypatch):
    password = "synthetic-demo-password-at-least-20"
    user = "reviewer"
    m = load_api(monkeypatch, "protected-demo", user=user, password=password)
    try:
        client = TestClient(m.app)
        assert client.get("/health", headers={"host": "shareshield-demo.onrender.com"}).status_code == 200
        unauth = client.get("/", headers={"host": "shareshield-demo.onrender.com"})
        assert unauth.status_code == 401
        assert "WWW-Authenticate" in unauth.headers
        basic = "Basic " + base64.b64encode((user + ":" + password).encode()).decode()
        ok = client.get("/", headers={"host": "shareshield-demo.onrender.com", "authorization": basic})
        assert ok.status_code == 200
        assert client.get("/", headers={"host": "evil.example.net", "authorization": basic}).status_code == 400
        invalid = "Basic " + base64.b64encode(b"reviewer:wrong").decode()
        assert client.get("/", headers={"host": "shareshield-demo.onrender.com", "authorization": invalid}).status_code == 401
        origin_headers = {"host": "shareshield-demo.onrender.com", "authorization": basic}
        cross = client.post("/analyze", headers={**origin_headers, "origin": "https://evil.example.net"})
        assert cross.status_code == 403
        insecure = client.post("/analyze", headers={**origin_headers, "origin": "http://shareshield-demo.onrender.com"})
        assert insecure.status_code == 403
    finally:
        load_api(monkeypatch, "local")


def test_local_deployment_remains_unchanged(monkeypatch):
    m = load_api(monkeypatch, "local")
    assert TestClient(m.app).get("/").status_code == 200
