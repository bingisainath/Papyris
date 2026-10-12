"""
Browser test for message ticks (Playwright + Chromium), like WhatsApp:
- one tick: the server has it, but it hasn't reached the other person's devices
- two ticks: it reached one of their devices (their app loaded the chat list, or got it live)
- read ticks: they opened the chat

    PAPYRIS_API=http://localhost:8001 PAPYRIS_WEB=http://localhost:3001 python e2e/ticks_e2e.py
"""

import os
import sys

import httpx
from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from encryption_gate import pass_encryption_gate  # noqa: E402

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
PASSWORD = "Passw0rd!23"


def token(username):
    return httpx.post(f"{API}/auth/login", json={"identifier": username, "password": PASSWORD}).json()["data"]["access_token"]


def login(page, username):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill(username)
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    pass_encryption_gate(page)


def main():
    alice_token = token("qa_alice")
    bob_id = httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token('qa_bob')}"}).json()["data"]["id"]
    dm = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {alice_token}"},
                    json={"kind": "dm", "participant_ids": [bob_id]}).json()["data"]["id"]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        alice = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        login(alice, "qa_alice")
        alice.goto(f"{WEB}/chat/{dm}")
        text = f"tick check {os.getpid()}"
        alice.get_by_label("Message", exact=True).fill(text)
        alice.get_by_label("Send", exact=True).click()
        mine = alice.locator("[data-message-id]", has_text=text).last
        # Bob isn't signed in anywhere in this test yet: one tick
        expect(mine.get_by_role("img", name="Sent")).to_be_visible(timeout=15000)
        print("one tick while Bob's devices don't have it")

        bob = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        login(bob, "qa_bob")  # loads his chat list: the message reached his browser
        expect(mine.get_by_role("img", name="Delivered")).to_be_visible(timeout=15000)
        print("two ticks once it reached Bob's browser")

        bob.goto(f"{WEB}/chat/{dm}")
        expect(mine.get_by_role("img", name="Read")).to_be_visible(timeout=15000)
        print("read ticks once Bob opened the chat")
        browser.close()
    print("ticks e2e: all checks passed")


if __name__ == "__main__":
    main()
