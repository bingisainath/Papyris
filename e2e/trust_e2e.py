"""
Browser test for security codes and key changes (encryption v2, phase 6; Playwright + Chromium).

Checks: two people see the same 60-digit security code (from their account keys); "Mark as verified"
shows a badge; when the verified contact starts fresh on a new browser, the other side gets a
"security code changed" banner, sending to them waits (the message fails), and after "Accept" it
goes through and is read on the new browser; for an unverified contact the banner is just a notice
that "OK" dismisses.

Resets the encryption keys of the QA users qa_alice and qa_bob first (test accounts).

    PAPYRIS_API=http://localhost:8001 PAPYRIS_WEB=http://localhost:3001 python e2e/trust_e2e.py [screenshot_dir]
"""

import os
import re
import sys
from pathlib import Path

import httpx
import psycopg2
from playwright.sync_api import expect, sync_playwright

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
DB = os.environ.get("PAPYRIS_DB", "postgresql://papyris:papyris@localhost:5432/papyris")
PASSWORD = "Passw0rd!23"
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)
KEY_TABLES = ("previous_user_keys", "user_keys", "e2e_envelopes", "e2e_link_requests", "e2e_one_time_prekeys",
              "e2e_signed_prekeys", "e2e_device_lists", "e2e_devices", "e2e_backups")


def sql(query, *args):
    with psycopg2.connect(DB) as conn, conn.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchall() if cur.description else None


def login(page, username):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill(username)
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    page.wait_for_url(lambda url: "/login" not in url)


def chats_ready(page):
    expect(page.get_by_role("heading", name="Chats")).to_be_visible(timeout=20000)


def send(page, text):
    page.get_by_label("Message", exact=True).fill(text)
    page.get_by_label("Send", exact=True).click()


def security_code(page):
    page.get_by_role("button", name="Contact info").click()
    page.get_by_role("button", name="Verify security code").click()
    code = page.get_by_test_id("security-code").inner_text()
    return code


def main():
    users = {u: str(sql("select id from users where username = %s", u)[0][0]) for u in ("qa_alice", "qa_bob")}
    ids = tuple(users.values())
    for table in KEY_TABLES:
        column = "recipient_user_id" if table == "e2e_envelopes" else "user_id"
        sql(f"delete from {table} where {column}::text in %s", ids)
    token = httpx.post(f"{API}/auth/login", json={"identifier": "qa_alice", "password": PASSWORD}).json()["data"]["access_token"]
    dm = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {token}"},
                    json={"kind": "dm", "participant_ids": [users["qa_bob"]]}).json()["data"]["id"]
    sql("delete from messages where conversation_id = %s", dm)
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(name):
            page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
            page.on("pageerror", lambda e: problems.append(f"{name} page error: {e}"))
            return page

        alice, bob = new_page("alice"), new_page("bob")
        login(alice, "qa_alice")
        chats_ready(alice)
        login(bob, "qa_bob")
        chats_ready(bob)
        alice.goto(f"{WEB}/chat/{dm}")
        send(alice, "hello bob")
        bob.goto(f"{WEB}/chat/{dm}")
        expect(bob.locator("[data-message-id]", has_text="hello bob").last).to_be_visible(timeout=15000)

        # ---- the same code on both sides; marking as verified
        code_a, code_b = security_code(alice), security_code(bob)
        if code_a != code_b or not re.fullmatch(r"(\d{5} ){11}\d{5}", code_a):
            problems.append(f"security codes differ or look wrong: {code_a!r} / {code_b!r}")
        alice.get_by_role("button", name="Mark as verified").click()
        expect(alice.get_by_text("You verified qa_bob")).to_be_visible(timeout=10000)
        alice.screenshot(path=SHOTS / "t1-verified.png")

        # ---- bob loses his browser and starts fresh on a new one
        bob.goto(f"{WEB}/settings")
        bob.get_by_role("button", name="Log out").last.click()
        bob.get_by_role("button", name="Log out anyway").click()
        bob.wait_for_url(lambda url: "/login" in url)
        bob2 = new_page("bob-new")
        login(bob2, "qa_bob")
        expect(bob2.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        bob2.get_by_role("button", name="Don't have your other device?").click()
        bob2.get_by_role("button", name="Start fresh").click()
        chats_ready(bob2)
        bob2.goto(f"{WEB}/chat/{dm}")

        # ---- alice: banner; sending waits until she accepts
        alice.goto(f"{WEB}/chat/{dm}")
        banner = alice.get_by_role("status").filter(has_text="security code changed")
        expect(banner).to_be_visible(timeout=20000)
        expect(banner).to_contain_text("You'd verified them")
        alice.screenshot(path=SHOTS / "t2-changed-verified.png")
        send(alice, "are you really bob?")
        expect(alice.get_by_text("Their security code changed").first).to_be_visible(timeout=15000)  # the error toast
        banner.get_by_role("button", name="Accept").click()
        expect(banner).to_have_count(0, timeout=10000)
        send(alice, "after accepting")
        expect(bob2.locator("[data-message-id]", has_text="after accepting").last).to_be_visible(timeout=20000)
        if alice.get_by_text("You verified qa_bob").count():
            problems.append("still shown as verified after the key changed")

        # ---- an unverified contact changing keys: just a notice, dismissed with OK
        bob2.goto(f"{WEB}/settings")
        bob2.get_by_role("button", name="Log out").last.click()
        bob2.get_by_role("button", name="Log out anyway").click()
        bob2.wait_for_url(lambda url: "/login" in url)
        bob3 = new_page("bob-third")
        login(bob3, "qa_bob")
        bob3.get_by_role("button", name="Don't have your other device?").click()
        bob3.get_by_role("button", name="Start fresh").click()
        chats_ready(bob3)
        alice.reload()
        banner = alice.get_by_role("status").filter(has_text="security code changed")
        expect(banner).to_be_visible(timeout=20000)
        expect(banner).to_contain_text("probably because they started fresh")
        send(alice, "no need to accept")
        bob3.goto(f"{WEB}/chat/{dm}")
        expect(bob3.locator("[data-message-id]", has_text="no need to accept").last).to_be_visible(timeout=20000)
        banner.get_by_role("button", name="OK").click()
        expect(banner).to_have_count(0, timeout=10000)
        alice.reload()
        alice.wait_for_timeout(3000)
        if alice.get_by_role("status").filter(has_text="security code changed").count():
            problems.append("the notice came back after OK")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)
    print("trust e2e: all checks passed")


if __name__ == "__main__":
    main()
