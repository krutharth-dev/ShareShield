"""Aurora visual edition: regression coverage without external UI dependencies.

Source checks supplement (not replace) React build, actual keyboard testing
and the existing PDF/PII redaction integration suite.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend" / "src"


def test_privacy_command_palette_executes_real_navigation_and_is_keyboard_accessible():
    app = (UI / "App.tsx").read_text()
    menu = (UI / "CommandPalette.tsx").read_text()
    assert "event.metaKey || event.ctrlKey" in app
    assert "event.key.toLowerCase() === 'k'" in app
    assert "setCommandOpen" in app
    assert "<CommandPalette open={commandOpen}" in app
    assert 'role="dialog"' in menu and 'aria-modal="true"' in menu
    assert "action.run()" in menu and "onClose()" in menu
    assert "ArrowDown" in menu and "ArrowUp" in menu and "Enter" in menu
    assert "disabled={action.disabled}" in menu
    assert "fetch(" not in menu and "localStorage" not in menu


def test_illustrative_document_exposes_no_real_file_or_fake_privacy_score():
    showcase = (UI / "HeroVisual.tsx").read_text()
    app = (UI / "App.tsx").read_text()
    assert "Illustrative example" in showcase
    assert "busy" in showcase and "showcase-scanbeam" in showcase
    assert "You're in charge" in showcase
    assert "Your file is secure" not in showcase
    assert "100% safe" not in showcase
    assert "file.name" not in showcase and "URL.createObjectURL" not in showcase
    assert "hasAnalysis={Boolean(analysis)}" in app
    assert "findings={analysis?.findings.length ?? 0}" in app


def test_animation_opt_out_and_reduced_motion_do_not_skip_privacy_checks():
    app = (UI / "App.tsx").read_text()
    css = (UI / "App.css").read_text()
    assert "document.documentElement.dataset.motion" in app
    assert "setMotionEnabled" in app
    assert "aria-pressed={motionEnabled}" in app
    assert "motion-settings" in app
    assert 'html[data-motion="off"] *' in css
    assert "@media (prefers-reduced-motion: reduce)" in css
    assert ".showcase-scanbeam" in css
    assert "disabled={!result || !acknowledged || !pagesComplete" in app
    assert "report?.status === 'FLAG'" in app


def test_advanced_layout_has_light_dark_and_small_screen_breakpoints():
    css = (UI / "App.css").read_text()
    for marker in (
        ".hero-showcase", ".showcase-document", ".command-overlay",
        ".command-trigger", ".topbar", ".privacy-option",
        "@media (max-width:720px)", ".showcase-float-top",
        "html[data-theme=\"light\"]", "html[data-theme=\"dark\"]",
    ):
        assert marker in css, marker
