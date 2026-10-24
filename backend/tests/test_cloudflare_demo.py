"""Original approved logo and protected Cloudflare Tunnel regression tests."""
import base64
import importlib
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
HOST = "fictional-shareshield-demo.trycloudflare.com"
PASSWORD = "long-fake-password-2026-please-change"


def test_approved_logo_is_a_real_binary_file_referenced_in_ui():
    path = ROOT / "frontend" / "public" / "shareshield-mark.webp"
    assert path.is_file() and path.stat().st_size > 1000
    assert path.read_bytes()[:4] == b"RIFF"
    app = (ROOT / "frontend" / "src" / "App.tsx").read_text()
    assert app.count('src="/shareshield-mark.webp"') >= 2
    assert "brand-wordmark" in app
    css = (ROOT / "frontend" / "src" / "App.css").read_text()
    assert ".brand-icon.brand-icon-approved" in css
    assert "html[data-theme=\"dark\"] .brand-wordmark" in css
    assert "html[data-theme=\"light\"]" in css
    backend = (ROOT / "backend" / "app.py").read_text()
    assert '@app.get("/shareshield-mark.webp"' in backend
    assert 'media_type="image/webp"' in backend


def test_cloudflare_public_hostname_is_exact(monkeypatch):
    from backend import app as backend_app
    monkeypatch.setenv("SHARESHIELD_DEPLOYMENT_MODE", "public-demo")
    monkeypatch.setenv("SHARESHIELD_DEMO_USER", "demo")
    monkeypatch.setenv("SHARESHIELD_DEMO_PASSWORD", PASSWORD)
    monkeypatch.setenv("SHARESHIELD_PUBLIC_HOSTNAME", HOST)
    monkeypatch.delenv("RAILWAY_PROJECT_ID", raising=False)
    monkeypatch.delenv("RAILWAY_PUBLIC_DOMAIN", raising=False)
    m = importlib.reload(backend_app)
    try:
        client = TestClient(m.app)
        headers = {"host": HOST}
        auth = "Basic " + base64.b64encode(("demo:" + PASSWORD).encode()).decode()
        assert client.get("/", headers=headers).status_code == 200
        authorized = {**headers, "authorization": auth}
        assert client.get("/", headers=authorized).status_code == 200
        # The image is served under the protected same-origin path too.
        img = client.get("/shareshield-mark.webp", headers=authorized)
        if (ROOT / "frontend" / "dist" / "shareshield-mark.webp").is_file():
            assert img.status_code == 200
            assert img.headers["content-type"].startswith("image/webp")
        else:
            assert img.status_code == 404
        assert client.get("/shareshield-mark.webp", headers=headers).status_code == img.status_code
        assert client.get("/", headers={"host": "some-other.trycloudflare.com",
                                       "authorization": auth}).status_code == 400
        assert client.get("/", headers={"host": "malicious.onrender.com",
                                       "authorization": auth}).status_code == 400
        assert client.post("/analyze", headers={**authorized,
                 "origin": "https://evil.trycloudflare.com"}).status_code == 403
        assert client.post("/analyze", headers={**authorized,
                 "origin": "http://" + HOST}).status_code == 403
        assert client.post("/analyze", headers={**authorized,
                 "origin": "https://" + HOST}).status_code == 422
    finally:
        monkeypatch.setenv("SHARESHIELD_DEPLOYMENT_MODE", "local")
        monkeypatch.delenv("SHARESHIELD_PUBLIC_HOSTNAME", raising=False)
        importlib.reload(backend_app)


def test_cloudflare_script_checks_hostname_and_password():
    script = (ROOT / "scripts" / "start-cloudflare-demo.sh").read_text()
    for word in ("trycloudflare.com", "read -r -s demo_password",
                 "SHARESHIELD_PUBLIC_HOSTNAME", "SHARESHIELD_DEMO_PASSWORD",
                 "protected-demo", "start-demo.sh"):
        assert word in script, word
    assert "unset demo_password" in script
    assert "echo $demo_password" not in script
