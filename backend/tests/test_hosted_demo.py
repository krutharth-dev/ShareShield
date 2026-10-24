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


def test_railway_protected_demo_uses_exact_service_host(monkeypatch):
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "synthetic-project")
    monkeypatch.setenv("RAILWAY_PUBLIC_DOMAIN", "shareshield-demo.up.railway.app")
    try:
        m = load_api(monkeypatch, "protected-demo", user="demo",
                     password="fictional-long-demo-password-2026")
        client = TestClient(m.app)
        host = "shareshield-demo.up.railway.app"
        auth = "Basic " + base64.b64encode(
            b"demo:fictional-long-demo-password-2026").decode()
        assert client.get("/health", headers={"host": "healthcheck.railway.app"}).status_code == 200
        assert client.get("/", headers={"host": host}).status_code == 401
        assert client.get("/", headers={"host": host, "authorization": "Basic ???"}).status_code == 401
        assert client.get("/", headers={"host": host, "authorization": auth}).status_code == 200
        # Another Railway customer's Host must not be trusted.
        assert client.get("/", headers={"host": "someone-else.up.railway.app",
                                        "authorization": auth}).status_code == 400
        headers = {"host": host, "authorization": auth}
        assert client.post("/analyze", headers={**headers,
                   "origin": "https://unrelated.up.railway.app"}).status_code == 403
        assert client.post("/analyze", headers={**headers,
                   "origin": "http://shareshield-demo.up.railway.app"}).status_code == 403
        # A valid HTTPS same-origin request reaches file validation.
        assert client.post("/analyze", headers={**headers,
                   "origin": "https://shareshield-demo.up.railway.app"}).status_code == 422
    finally:
        monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
        monkeypatch.delenv("RAILWAY_PUBLIC_DOMAIN", raising=False)
        load_api(monkeypatch, "local")


def test_railway_rejects_malformed_domain(monkeypatch):
    monkeypatch.setenv("RAILWAY_PROJECT_ID", "synthetic-project")
    monkeypatch.setenv("RAILWAY_PUBLIC_DOMAIN", "evil.example.com")
    with pytest.raises(RuntimeError, match="Invalid RAILWAY_PUBLIC_DOMAIN"):
        load_api(monkeypatch, "protected-demo", user="demo",
                 password="fictional-long-demo-password-2026")
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("RAILWAY_PUBLIC_DOMAIN", raising=False)
    load_api(monkeypatch, "local")

def test_public_demo_requires_explicit_hostname_and_no_credentials(monkeypatch):
    monkeypatch.delenv("SHARESHIELD_PUBLIC_HOSTNAME", raising=False)
    with pytest.raises(RuntimeError, match="Public demo requires"):
        load_api(monkeypatch, "public-demo")
    load_api(monkeypatch, "local")


def test_public_render_demo_has_no_login_but_retains_origin_and_host_checks(monkeypatch):
    host = "shareshield-demo.onrender.com"
    monkeypatch.setenv("SHARESHIELD_PUBLIC_HOSTNAME", host)
    try:
        m = load_api(monkeypatch, "public-demo")
        client = TestClient(m.app)
        headers = {"host": host}
        homepage = client.get("/", headers=headers)
        assert homepage.status_code == 200
        assert "WWW-Authenticate" not in homepage.headers
        assert client.get("/health", headers=headers).status_code == 200
        assert client.get("/", headers={"host": "someone-else.onrender.com"}).status_code == 400
        assert client.post("/analyze", headers={**headers,
                   "origin": "https://evil.example.net"}).status_code == 403
        assert client.post("/analyze", headers={**headers,
                   "origin": "http://" + host}).status_code == 403
        assert client.post("/analyze", headers={**headers,
                   "origin": "https://" + host}).status_code == 422
    finally:
        monkeypatch.delenv("SHARESHIELD_PUBLIC_HOSTNAME", raising=False)
        load_api(monkeypatch, "local")
