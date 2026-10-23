"""Integration-level checks that cover server delivery and local demo safeguards."""
import re
from pathlib import Path

from fastapi.testclient import TestClient
from backend.app import app, FRONTEND_DIST

client = TestClient(app)


def test_local_host_and_security_headers():
    good = client.get("/health")
    assert good.status_code == 200
    assert good.headers["cache-control"] == "no-store"
    assert good.headers["x-content-type-options"] == "nosniff"
    assert good.headers["x-frame-options"] == "DENY"
    assert client.get("/", headers={"host": "bad.example"}).status_code == 400


def test_cross_origin_mutation_blocked():
    sent = client.post("/analyze",
                       files={"file": ("sample.txt", b"demo@example.org")},
                       headers={"Origin": "https://malicious.example"})
    assert sent.status_code == 403
    sent = client.post("/analyze",
                       files={"file": ("sample.txt", b"demo@example.org")},
                       headers={"Sec-Fetch-Site": "cross-site"})
    assert sent.status_code == 403


def test_single_origin_bundle_if_built():
    html = client.get("/")
    assert html.status_code == 200
    if (FRONTEND_DIST / "index.html").is_file():
        assert '<div id="root"></div>' in html.text
        assert "Content-Security-Policy" in html.headers
        js = re.search(r'src="(/assets/[^"]+\.js)"', html.text)
        css = re.search(r'href="(/assets/[^"]+\.css)"', html.text)
        assert js and css
        assert client.get(js.group(1)).status_code == 200
        assert client.get(css.group(1)).status_code == 200
        assert client.get("/favicon.svg").status_code == 200
    else:
        assert "Drop a file here" in html.text
