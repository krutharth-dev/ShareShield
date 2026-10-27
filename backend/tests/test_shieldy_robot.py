"""Visible Shieldy robot rendering and animation safety regressions.

Source checks complement TypeScript/Vite build and real browser visual QA.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = ROOT / "frontend" / "src"


def test_robot_is_drawn_with_a_face_and_body_instead_of_shield_icon():
    robot = (UI / "ShieldyRobot.tsx").read_text()
    for feature in (
        "<svg", "viewBox=", "linearGradient", "bot-face",
        "bot-eye-left", "bot-eye-right", "bot-wave-arm", "bot-antenna",
        "bot-chest-led", "bot-legs", "bot-sparkles", "headOnly",
        "variant === 'head'", "fill={'url(#' + mint + ')'}",
    ):
        assert feature in robot, feature
    assert "fetch(" not in robot
    assert "src=" not in robot
    assert 'aria-hidden="true"' in robot
    assert "useId()" in robot  # unique gradient/filter IDs for repeat instances


def test_robot_visible_on_launcher_dashboard_and_inside_helper():
    helper = (UI / "ShieldyAssistant.tsx").read_text()
    guide = (UI / "PlayfulGuide.tsx").read_text()
    for marker in (
        "import ShieldyRobot from './ShieldyRobot'",
        'className="shieldy-avatar robot-avatar"',
        'className="shieldy-welcome-robot"',
        'className="shieldy-tour-symbol shieldy-tour-robot"',
        "className={'shieldy-launcher robot-launcher '",
        '<ShieldyRobot variant="head" size={76}',
    ):
        assert marker in helper, marker
    assert '<ShieldyRobot size={96}' in guide
    assert 'guide-mascot guide-robot' in guide
    assert "props.verificationStatus === 'FLAG' ? 'alert'" in helper
    assert "aria-label={open ? 'Close Shieldy helper' : 'Open Shieldy helper'}" in helper


def test_robot_motion_and_small_screens_stay_accessible():
    css = (UI / "App.css").read_text()
    for marker in (
        ".shieldy-launcher.robot-launcher",
        ".shieldy-welcome-robot",
        ".shieldy-tour-robot",
        ".guide-robot .shieldy-robot",
        "sh-bot-wave", "sh-bot-blink", "sh-bot-bob",
        "@media (max-width:720px)",
        "@media (prefers-reduced-motion:reduce)",
        "animation:none!important",
    ):
        assert marker in css, marker
    # The app-wide animation opt-out is already present.
    assert 'html[data-motion="off"] *' in css
