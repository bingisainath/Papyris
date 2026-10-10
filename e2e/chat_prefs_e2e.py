"""
Browser test for mute, archive and message search (Playwright + Chromium).

Checks:
- A word in an end-to-end encrypted chat is found from the chat list search (searched in the browser's
  own encrypted database) and opens the chat at that message.
- Search inside a chat works the same way.
- Muting shows a "Muted" bell and stops the chat counting in the tab title.
- Archiving moves the chat to Archived and back.

Resets the encryption keys of the QA users qa_alice and qa_bob first (test accounts).

    PAPYRIS_API=http://localhost:8001 PAPYRIS_WEB=http://localhost:3001 python e2e/chat_prefs_e2e.py [screenshot_dir]
"""

import os
import sys
from pathlib import Path

import httpx
import psycopg2
from playwright.sync_api import expect, sync_playwright

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
DB = os.environ.get("PAPYRIS_DB", "postgresql://papyris:papyris@localhost:5432/papyris")
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
    page.locator("input[name=loginPassword]").fill("Passw0rd!23")
    page.locator("input[name=loginPassword]").press("Enter")
    expect(page.get_by_role("heading", name="Chats")).to_be_visible(timeout=20000)


def main():
    users = {u: str(sql("select id from users where username = %s", u)[0][0]) for u in ("qa_alice", "qa_bob")}
    ids = tuple(users.values())
    for table in KEY_TABLES:
        column = "recipient_user_id" if table == "e2e_envelopes" else "user_id"
        sql(f"delete from {table} where {column}::text in %s", ids)
    token = httpx.post(f"{API}/auth/login", json={"identifier": "qa_alice", "password": "Passw0rd!23"}).json()["data"]["access_token"]
    dm = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {token}"},
                    json={"kind": "dm", "participant_ids": [users["qa_bob"]]}).json()["data"]["id"]
    sql("delete from messages where conversation_id = %s", dm)
    sql("update conversation_members set muted_until = null, archived_at = null, pinned_at = null where conversation_id = %s", dm)
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        alice = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        bob = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
        for page in (alice, bob):
            page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        login(alice, "qa_alice")
        login(bob, "qa_bob")

        # ---- an encrypted conversation with enough messages to need paging
        alice.goto(f"{WEB}/chat/{dm}")
        expect(alice.get_by_label("End-to-end encrypted")).to_be_visible(timeout=15000)
        box = alice.get_by_label("Message", exact=True)
        box.fill("Pizza on Friday at Luigi's?")
        alice.get_by_label("Send", exact=True).click()
        for i in range(60):
            box.fill(f"filler {i}")
            alice.get_by_label("Send", exact=True).click()
        expect(alice.locator("[data-message-id]", has_text="filler 59").last).to_be_visible(timeout=20000)
        alice.wait_for_timeout(1500)

        # ---- search from the chat list: found in the browser's encrypted database, opens at the message
        alice.goto(f"{WEB}/chat")
        alice.get_by_placeholder("Search chats and messages...").fill("pizza")
        results = alice.get_by_role("region", name="Messages")
        expect(results.get_by_text("Pizza on Friday", exact=False)).to_be_visible(timeout=15000)
        expect(results.get_by_label("End-to-end encrypted").first).to_be_visible()
        alice.screenshot(path=SHOTS / "p1-search.png")
        results.get_by_role("button").first.click()
        target = alice.locator("[data-message-id]", has_text="Pizza on Friday").last
        expect(target).to_be_in_viewport(timeout=20000)
        alice.screenshot(path=SHOTS / "p2-jumped.png")

        # ---- search inside the chat
        alice.get_by_role("button", name="Search in this chat").click()
        alice.get_by_label("Search messages in this chat").fill("luigi")
        expect(alice.get_by_role("list", name="Search results").get_by_text("Luigi", exact=False)).to_be_visible(timeout=15000)
        alice.keyboard.press("Escape")

        # ---- mute: bell in the list, and bob's messages no longer count in the tab title
        alice.get_by_role("button", name="Contact info").click()
        alice.get_by_label("Mute notifications").select_option("8h")
        expect(alice.get_by_text("Muted until")).to_be_visible(timeout=10000)
        alice.get_by_label("Close").first.click() if alice.get_by_label("Close").count() else None
        alice.goto(f"{WEB}/groups")  # away from the chat, so new messages are unread
        bob.goto(f"{WEB}/chat/{dm}")
        bob.get_by_label("Message", exact=True).fill("are you coming?")
        bob.get_by_label("Send", exact=True).click()
        alice.goto(f"{WEB}/chat")
        expect(alice.get_by_label("Muted").first).to_be_visible(timeout=15000)
        alice.wait_for_timeout(1500)
        if alice.title().startswith("("):
            problems.append(f"a muted chat counted in the tab title: {alice.title()!r}")
        if sql("select muted_until is null from conversation_members where conversation_id = %s and user_id::text = %s", dm, users["qa_alice"])[0][0]:
            problems.append("mute wasn't saved")
        alice.screenshot(path=SHOTS / "p3-muted.png")

        # ---- archive and back
        row = alice.get_by_role("button", name="Archive chat").first
        alice.locator("text=qa_bob").first.hover()
        row.click()
        expect(alice.get_by_role("button", name="Archived")).to_be_visible(timeout=10000)
        alice.screenshot(path=SHOTS / "p4-archived.png")
        alice.get_by_role("button", name="Archived").click()
        expect(alice.get_by_text("Archived chats")).to_be_visible()
        alice.locator("text=qa_bob").first.hover()
        alice.get_by_role("button", name="Unarchive chat").first.click()
        alice.get_by_text("Archived chats").click()
        expect(alice.get_by_role("button", name="Archived")).to_have_count(0, timeout=10000)
        if sql("select archived_at is not null from conversation_members where conversation_id = %s and user_id::text = %s", dm, users["qa_alice"])[0][0]:
            problems.append("unarchive wasn't saved")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)
    print("chat prefs e2e: all checks passed")


if __name__ == "__main__":
    main()
