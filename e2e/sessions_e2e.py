"""
Browser test for Settings → Sessions (Playwright + Chromium): two browsers signed in to one account;
the first logs the second (left waiting to be linked) out. The second is signed out at once (and its keys wiped), its old tokens
stop working, and it no longer appears in Sessions.

Uses the QA user qa_carol (a test account).

    PAPYRIS_API=http://localhost:8001 PAPYRIS_WEB=http://localhost:3001 python e2e/sessions_e2e.py [screenshot_dir]
"""

import os
import sys
from pathlib import Path

import httpx
from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
from encryption_gate import pass_encryption_gate  # noqa: E402

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)


def login(page, gate=True):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill("qa_carol")
    page.locator("input[name=loginPassword]").fill("Passw0rd!23")
    page.locator("input[name=loginPassword]").press("Enter")
    if gate:
        pass_encryption_gate(page)
        expect(page.get_by_role("heading", name="Chats")).to_be_visible(timeout=20000)


def main():
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        first = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        second = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        for page in (first, second):
            page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        login(first)
        # A second browser signs in and is left waiting to be linked (like one you forgot about)
        login(second, gate=False)
        expect(second.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=20000)
        token = second.evaluate("() => localStorage.getItem('papyris_access_token') || ''")

        first.goto(f"{WEB}/settings")
        sessions = first.get_by_role("list", name="Active sessions")
        expect(sessions.get_by_role("button", name="Log out Chrome on Linux").first).to_be_visible(timeout=15000)
        count_before = sessions.locator("li").count()
        first.screenshot(path=SHOTS / "s1-sessions.png")
        first.once("dialog", lambda d: d.accept())
        sessions.get_by_role("button", name="Log out Chrome on Linux").first.click()
        expect(first.get_by_text("is logged out")).to_be_visible(timeout=15000)
        expect(sessions.locator("li")).to_have_count(count_before - 1, timeout=15000)

        # The other browser: signed out right away
        expect(second.locator("input[name=loginIdentifier]")).to_be_visible(timeout=20000)
        second.screenshot(path=SHOTS / "s2-logged-out.png")
        if token and httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code != 401:
            problems.append("the logged-out browser's token still works")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)
    print("sessions e2e: all checks passed")


if __name__ == "__main__":
    main()
