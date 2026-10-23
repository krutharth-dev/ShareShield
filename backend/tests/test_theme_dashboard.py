"""Synthetic regressions for the premium UI shell and private theme controls."""
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import app, FRONTEND_DIST

ROOT = Path(__file__).resolve().parents[2]
client = TestClient(app)


def test_theme_bootstrap_precedes_application_and_never_uploads_files():
    index = (ROOT / "frontend" / "index.html").read_text()
    bootstrap = (ROOT / "frontend" / "public" / "theme-init.js").read_text()
    assert '<script src="/theme-init.js"></script>' in index
    assert index.index("/theme-init.js") < index.index("/src/main.tsx")
    assert "shareshield-appearance" in bootstrap
    assert "prefers-color-scheme: dark" in bootstrap
    assert "document.documentElement.dataset.theme" in bootstrap
    assert "localStorage.setItem" not in bootstrap
    assert "fetch(" not in bootstrap
    assert "XMLHttpRequest" not in bootstrap


def test_built_theme_bootstrap_obeys_csp_and_no_store():
    # A developer may run pytest before npm build. Source assertions still apply.
    if (FRONTEND_DIST / "theme-init.js").is_file():
        response = client.get("/theme-init.js")
        assert response.status_code == 200
        assert "javascript" in response.headers["content-type"]
        assert response.headers["cache-control"] == "no-store"
        assert b"shareshield-appearance" in response.content
        assert "script-src 'self'" in response.headers.get("content-security-policy", "")


def test_dashboard_has_functional_navigation_theme_and_safe_states():
    app_src = (ROOT / "frontend" / "src" / "App.tsx").read_text()
    css = (ROOT / "frontend" / "src" / "App.css").read_text()
    for required in (
        "sidebarCollapsed", "mobile-open", "viewMode", "theme-switcher",
        "setAppearance(value)", "localStorage.setItem('shareshield-appearance'",
        "aria-pressed", "aria-label", "workflowSteps", "supported formats",
        "What would you like to protect?", "Review workspace",
        "remaining_detected_count", "acknowledged", "reviewedPages",
        "Before / after comparison", "Draw mask",
    ):
        assert required.lower() in app_src.lower(), required
    for token in (
        "--sh-bg:", "--sh-surface:", "--sh-green:",
        'html[data-theme="dark"]', "@media (prefers-reduced-motion:reduce)",
        ".preview-pair.mode-original", ".sidebar.mobile-open",
    ):
        assert token in css, token
    # No real document data should be persisted by the frontend.
    assert "localStorage.setItem('shareshield-appearance', appearance)" in app_src
    assert "localStorage.setItem('file'" not in app_src
