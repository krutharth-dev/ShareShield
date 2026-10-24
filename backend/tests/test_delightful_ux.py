"""UI delight, safety-copy and progressive-disclosure regressions.

These checks inspect the source to complement React lint/build. They do not
replace visual/browser interaction testing.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend" / "src"


def test_friendly_guide_responds_to_real_workflow_states():
    source = (UI / "PlayfulGuide.tsx").read_text()
    app = (UI / "App.tsx").read_text()
    assert "Hey, I'm Shieldy!" in source
    assert "guide-progress" in source
    assert "blocked" in source and "Export is blocked" in source
    assert "not" in source.lower() and "complete privacy" not in source.lower()
    for cue in ("guideStage", "pagesComplete && acknowledged",
                "report?.status === 'FLAG'", "phase !== 'ready'",
                "setToast(", "setDrawMode"):
        assert cue in app, cue


def test_quick_settings_keep_advanced_controls_and_security_review():
    source = (UI / "App.tsx").read_text()
    for marker in (
        "privacy-presets", "All categories", "Clear selection",
        "advanced-settings", "checked={allOccurrences}",
        "mask-style-details", "mask-style-details",
        "I have visually checked page", "download-guide",
        "report?.status === 'FLAG'", "acknowledged",
        "disabled={!result || !acknowledged || !pagesComplete",
    ):
        assert marker in source, marker
    assert "manual_regions:" in source
    assert "redaction_mode:" in source


def test_privacy_disclosure_does_not_claim_perfect_detection_or_remote_on_device():
    source = (UI / "PrivacyPanel.tsx").read_text()
    notice = (ROOT / "docs" / "PRIVACY_NOTICE.md").read_text()
    for phrase in (
        "127.0.0.1", "host", "browser", "OCR", "review", "prototype",
        "not", "download",
    ):
        assert phrase.lower() in (source + notice).lower(), phrase
    assert "does not" in notice
    assert "not a legally" in notice
    assert "does not" in source
    assert "shareshield-appearance" in notice
    assert "perfect protection" not in source.lower()


def test_fun_effects_are_accessible_and_respect_reduced_motion():
    app = (UI / "App.tsx").read_text()
    css = (UI / "App.css").read_text()
    assert "aria-live" in app and "aria-pressed" in app
    for marker in (
        ".delight-toast", ".playful-guide", ".privacy-panel",
        ".comparison-label", "prefers-reduced-motion",
        ".download-guide", ".preset-chip", ".advanced-settings",
    ):
        assert marker in css, marker
    assert "animation:none !important" in css
