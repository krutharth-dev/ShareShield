"""Shieldy assistant guardrails and integration regressions.

Source assertions complement React compilation and the real API tests. They
don't assert that an automated FAQ can understand arbitrary human language.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend" / "src"


def test_offline_helper_is_connected_to_true_review_state():
    app = (UI / "App.tsx").read_text()
    helper = (UI / "ShieldyAssistant.tsx").read_text()
    for text in (
        "hasFile={Boolean(file)}",
        "hasAnalysis={Boolean(analysis)}",
        "hasResult={Boolean(result)}",
        "reviewedPages={reviewedPages.length}",
        "pagesComplete={pagesComplete}",
        "verificationStatus={report?.status ?? null}",
        "onChooseFile={() =>",
        "onDemo={sample}",
    ):
        assert text in app, text
    assert "verificationStatus === 'FLAG'" in helper
    assert "props.onNavigate(" in helper
    assert "data-shieldy-focus" in helper
    assert "Skip tour" in helper
    assert "setTourActive(true)" in helper


def test_helper_never_redacts_or_claims_guaranteed_privacy():
    helper = (UI / "ShieldyAssistant.tsx").read_text()
    knowledge = (UI / "shieldyKnowledge.ts").read_text()
    assert "I never select findings, redact, acknowledge checks or download files for you" in helper
    assert "this is not proof of full sanitization" in helper
    assert "FLAG" in knowledge and "PASS_SCOPED" in knowledge and "UNVERIFIED" in knowledge
    assert "No question is sent to an external service" in knowledge
    assert "Please do not paste personal numbers" in knowledge
    assert "do not paste" not in helper.lower() or "private details" in helper.lower()
    for content in (helper, knowledge):
        assert "fetch(" not in content
        assert "localStorage" not in content
        assert "URL.createObjectURL" not in content
        assert "navigator.sendBeacon" not in content
    assert "maxLength={180}" in helper
    assert "Keep private details out of chat" in knowledge


def test_helper_is_keyboard_accessible_and_decorative_motion_respects_os():
    helper = (UI / "ShieldyAssistant.tsx").read_text()
    css = (UI / "App.css").read_text()
    assert 'role="dialog"' in helper
    assert 'aria-modal="false"' in helper
    assert "event.key === 'Escape'" in helper
    assert "launcher.current?.focus()" in helper
    assert "aria-live" in helper
    assert 'aria-controls="shieldy-panel"' in helper
    assert "prefers-reduced-motion" in css
    assert ".shieldy-panel" in css
    assert ".shieldy-container" in css
    assert '[data-shieldy-focus="true"]' in css
    assert "html[data-motion=\"off\"] *" in css


def test_local_faq_has_verification_and_supported_format_advice():
    knowledge = (UI / "shieldyKnowledge.ts").read_text()
    for phrase in (
        "up to 12 MiB", "blackout", "face", "manual", "PDF", "DOCX",
        "127.0.0.1", "No question is sent to an external service",
        "not proof of full sanitization", "download", "unverified",
    ):
        assert phrase.lower() in knowledge.lower(), phrase
