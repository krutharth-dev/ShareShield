"""Regression checks for the chosen Midnight Blue/Cyan theme and Railway setup.

These source checks supplement frontend lint/Vite builds and real API tests.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend"


def test_dark_and_light_modes_use_consistent_cyan_tokens():
    css = (UI / "src" / "App.css").read_text()
    begin = css.index("SHARESHIELD / MIDNIGHT CYAN")
    theme = css[begin:]
    for marker in (
        'html[data-theme="light"]',
        'html[data-theme="dark"]',
        "--sh-bg:#0B1426",
        "--sh-bg:#F1F6FD",
        "--sh-green:#43C9F5",
        "--sh-green:#086B9B",
        "--sh-ink:#EDF5FF",
        "--sh-success:#68D9B2",
        "--sh-warning:#F1C979",
        "--sh-error:#FFA2B4",
        ".welcome",
        ".shieldy-head",
        ".shieldy-launcher.robot-launcher",
        ".report-card.failed",
        ".report-card.passed",
        ".comparison-label.original-label",
        ".comparison-label.export-label",
    ):
        assert marker in theme, marker
    # Don't remove reduced motion controls when changing the brand.
    assert 'html[data-motion="off"] *' in css
    assert "prefers-reduced-motion" in css


def test_site_metadata_and_favicon_match_brand_without_claiming_on_device_cloud():
    html = (UI / "index.html").read_text()
    favicon = (UI / "public" / "favicon.svg").read_text()
    robot = (UI / "src" / "ShieldyRobot.tsx").read_text()
    assert 'content="#0B1426"' in html
    assert "configured ShareShield server" in html
    assert "on-device document review" not in html
    assert 'stroke="url(#cyan)"' in favicon
    assert "#43C9F5" in favicon
    assert "#D6F6FF" in robot and "#447EC9" in robot


def test_railway_docker_port_and_documented_security_configuration():
    docker = (ROOT / "Dockerfile").read_text()
    guide = (ROOT / "docs" / "RAILWAY_DEPLOYMENT.md").read_text()
    api = (ROOT / "backend" / "app.py").read_text()
    for token in ('PORT:-8000', "os.getenv('PORT','8000')", 'USER appuser'):
        assert token in docker
    assert "retired" in guide.lower()
    assert "no longer" in guide.lower()
    assert "DEPLOYMENT.md" in guide

    assert 'RAILWAY_PUBLIC_DOMAIN' in api
    assert 'healthcheck.railway.app' in api
    assert 'TrustedHostMiddleware' in api
    assert 'Cross-origin' in api or 'cross-origin' in api
    assert "HTTPException(409" in api
