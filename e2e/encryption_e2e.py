"""
Browser test for end-to-end encryption (Playwright + Chromium).

Checks: keys are created silently on the first browser; a second browser is linked by typing its
code on the first one and then reads the history; encrypted text, a photo, an edit and a link
between two people; the server and database only ever hold envelopes and opaque files; keys
survive a reload; "start fresh" gives new keys (older messages become unreadable); a chat with
someone who hasn't set up encryption stays unencrypted and says so; chat list previews, the Links
tab and the security code work; logging out forgets the keys.

It resets the encryption keys of the QA users qa_alice, qa_bob and qa_carol first (they're test
accounts), and creates an "E2E Crypto …" group; delete it afterwards if you like.

Needs the API, `npm start` and a worker running, and the dev database at DATABASE_URL.

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/encryption_e2e.py [screenshot_dir]
"""

import os
import re
import sys
import time
from pathlib import Path

import httpx
import psycopg2
from PIL import Image
from playwright.sync_api import expect, sync_playwright


API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
DB = os.environ.get("PAPYRIS_DB", "postgresql://papyris:papyris@localhost:5432/papyris")
PASSWORD = "Passw0rd!23"
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)


def token(username):
    r = httpx.post(f"{API}/auth/login", json={"identifier": username, "password": PASSWORD})
    r.raise_for_status()
    return r.json()["data"]["access_token"]


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


def latest(conversation_id, n=1):
    return sql("select text, media_url, media_filename, has_link, message_type from messages "
               "where conversation_id = %s order by created_at desc limit %s", conversation_id, n)


def wait_db(conversation_id, predicate, seconds=20):
    deadline = time.time() + seconds
    while time.time() < deadline:
        rows = [r for r in latest(conversation_id, 20) if predicate(r)]
        if rows:
            return rows[0]
        time.sleep(0.5)
    return None


def main():
    users = {u: sql("select id from users where username = %s", u)[0][0] for u in ("qa_alice", "qa_bob", "qa_carol")}
    ids = tuple(str(v) for v in users.values())
    sql("delete from previous_user_keys where user_id::text in %s", ids)
    sql("delete from user_keys where user_id::text in %s", ids)
    for table in ("e2e_envelopes", "e2e_link_requests", "e2e_one_time_prekeys", "e2e_signed_prekeys", "e2e_device_lists", "e2e_devices", "e2e_backups"):
        column = "recipient_user_id" if table == "e2e_envelopes" else "user_id"
        sql(f"delete from {table} where {column}::text in %s", ids)

    alice_tok = token("qa_alice")
    auth = {"Authorization": f"Bearer {alice_tok}"}
    dm = httpx.post(f"{API}/conversations", headers=auth, json={"kind": "dm", "participant_ids": [str(users["qa_bob"])]}).json()["data"]["id"]
    sql("delete from messages where conversation_id = %s", dm)  # the QA users' DM is reused: start it empty
    group = httpx.post(f"{API}/conversations", headers=auth, json={
        "kind": "group", "title": f"E2E Crypto {int(time.time()) % 100000}",
        "participant_ids": [str(users["qa_bob"]), str(users["qa_carol"])],
    }).json()["data"]["id"]
    photo = SHOTS / "secret-photo.jpg"
    Image.new("RGB", (1200, 800), (40, 120, 200)).save(photo, "JPEG")
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(name):
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()
            page.on("pageerror", lambda e: problems.append(f"{name} page error: {e}"))
            page.on("console", lambda m: print(f"[{name} console] {m.text}") if m.type in ("warning", "error") and "Download the React DevTools" not in m.text else None)
            return context, page

        # ---- first browser of each: keys are created without asking anything
        alice_ctx, alice = new_page("alice")
        login(alice, "qa_alice")
        chats_ready(alice)
        bob_ctx, bob = new_page("bob")
        login(bob, "qa_bob")
        chats_ready(bob)

        # ---- encrypted text with a link
        alice.goto(f"{WEB}/chat/{dm}")
        expect(alice.get_by_label("End-to-end encrypted")).to_be_visible(timeout=15000)
        secret = "secret hello https://example.com/x"
        alice.get_by_label("Message", exact=True).fill(secret)
        alice.get_by_label("Send", exact=True).click()
        row = wait_db(dm, lambda r: r[0].startswith(("e2e1:", "e2e2:")))
        if not row or "secret" in row[0] or not row[3]:
            problems.append(f"text not stored as an envelope with the link flag: {row and row[0][:60]}, has_link={row and row[3]}")

        bob.goto(f"{WEB}/chat/{dm}")
        expect(bob.locator("[data-message-id]", has_text=secret).last).to_be_visible(timeout=15000)

        # ---- encrypted photo
        alice.get_by_label("Attach").click()
        with alice.expect_file_chooser() as chooser:
            alice.get_by_role("menuitem", name=re.compile("Photos & videos")).click()
        chooser.value.set_files(str(photo))
        alice.get_by_label("Send", exact=True).click()
        row = wait_db(dm, lambda r: r[4].lower() == "image")  # (stored as the enum name, IMAGE)
        if not row or not row[1].endswith(".enc") or row[2] is not None:
            problems.append(f"photo not stored encrypted: {row}")
        else:
            # The API serves the stored bytes; they mustn't be a JPEG
            served = httpx.get(f"{API}/conversations/{dm}/messages", headers={"Authorization": f"Bearer {token('qa_bob')}"}).json()["data"]
            url = next(m["media_url"] for m in served if m["media_type"] == "image")
            data = httpx.get(os.environ.get("PAPYRIS_API", "http://localhost:8000") + url).content
            if data[:3] == b"\xff\xd8\xff":
                problems.append("the server can see the photo (JPEG bytes)")
        img = bob.locator("img[alt='secret-photo.jpg']").last
        expect(img).to_be_visible(timeout=20000)
        if not (img.get_attribute("src") or "").startswith("blob:"):
            problems.append("bob's photo isn't a decrypted blob")
        bob.screenshot(path=SHOTS / "c2-bob-chat.png")

        # ---- edit
        bubble = alice.locator("[data-message-id]", has_text=secret).last
        bubble.hover()
        alice.get_by_role("button", name="Edit").last.click()
        alice.get_by_label("Message", exact=True).fill("secret edited https://example.com/x")
        alice.get_by_label("Message", exact=True).press("Enter")
        expect(bob.locator("[data-message-id]", has_text="secret edited").last).to_be_visible(timeout=15000)
        if wait_db(dm, lambda r: "secret" in r[0]):
            problems.append("an edit reached the database readable")

        # ---- reload keeps the keys
        bob.reload()
        expect(bob.locator("[data-message-id]", has_text="secret edited").last).to_be_visible(timeout=15000)

        # ---- a second browser is linked from the first by typing its code, then reads the history
        second_ctx, second = new_page("bob-second-browser")
        login(second, "qa_bob")
        expect(second.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        code = second.get_by_test_id("link-code").inner_text()
        second.screenshot(path=SHOTS / "c3-link-qr.png")
        bob.goto(f"{WEB}/settings")
        bob.get_by_role("button", name="Link a device").click()
        bob.get_by_label("Link code").fill("WRONGCODEWRONGCO")
        bob.get_by_role("button", name="Continue").click()
        expect(bob.get_by_text("No device is waiting with that code")).to_be_visible(timeout=15000)
        bob.get_by_label("Link code").fill(code.lower())
        bob.get_by_role("button", name="Continue").click()
        expect(bob.get_by_text(re.compile("^Link Chrome"))).to_be_visible(timeout=15000)
        bob.screenshot(path=SHOTS / "c3-link-confirm.png")
        bob.get_by_role("button", name="Link device").click()
        chats_ready(second)
        second.goto(f"{WEB}/chat/{dm}")
        expect(second.locator("[data-message-id]", has_text="secret edited").last).to_be_visible(timeout=15000)
        expect(second.locator("img[alt='secret-photo.jpg']").last).to_be_visible(timeout=20000)

        second_ctx.close()

        # ---- chat list preview is decrypted
        alice.goto(f"{WEB}/chat")
        expect(alice.get_by_text("Photo").first).to_be_visible(timeout=15000)
        if "e2e1:" in alice.content():
            problems.append("an envelope is visible in the page")

        # ---- links tab and security code
        alice.goto(f"{WEB}/chat/{dm}")
        alice.get_by_role("button", name="Contact info").click()
        alice.get_by_role("button", name="Verify security code").click()
        code_a = alice.locator("p.font-mono").inner_text()
        alice.get_by_text("Media, links and docs").click()
        alice.get_by_role("tab", name="Links").click()
        expect(alice.get_by_role("link").filter(has_text="https://example.com/x").first).to_be_visible(timeout=15000)
        alice.screenshot(path=SHOTS / "c4-links.png")
        bob.goto(f"{WEB}/chat/{dm}")
        bob.get_by_role("button", name="Contact info").click()
        bob.get_by_role("button", name="Verify security code").click()
        code_b = bob.locator("p.font-mono").inner_text()
        if code_a != code_b or len(code_a.replace(" ", "")) != 60:
            problems.append(f"security codes differ: {code_a} / {code_b}")

        # ---- carol has no keys: the group stays unencrypted and says so
        alice.goto(f"{WEB}/chat/{group}")
        expect(alice.get_by_text(re.compile("Not end-to-end encrypted yet: 1 member hasn't"))).to_be_visible(timeout=15000)
        alice.get_by_label("Message", exact=True).fill("plain group hello")
        alice.get_by_label("Send", exact=True).click()
        if not wait_db(group, lambda r: r[0] == "plain group hello"):
            problems.append("message to the unencrypted group wasn't sent as plain text")
        alice.screenshot(path=SHOTS / "c5-not-encrypted.png")

        # ---- logging out forgets the keys: signing in again asks to link; "start fresh" gives new keys
        alice.goto(f"{WEB}/settings")
        alice.get_by_role("button", name="Log out").last.click()
        alice.get_by_role("button", name="Log out anyway").click()  # her only device: the app warns first
        alice.wait_for_url(lambda url: "/login" in url)  # logout finishes wiping this browser's keys first
        login(alice, "qa_alice")
        expect(alice.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        old_sign = sql("select sign_public from user_keys where user_id::text = %s", str(users["qa_alice"]))[0][0]
        alice.get_by_role("button", name="Don't have your other device?").click()
        alice.get_by_role("button", name="Start fresh").click()
        chats_ready(alice)
        alice.goto(f"{WEB}/chat/{dm}")
        expect(alice.get_by_text("This message can't be decrypted on this device").first).to_be_visible(timeout=15000)
        if sql("select count(*) from previous_user_keys where sign_public = %s", old_sign)[0][0] != 1:
            problems.append("the replaced key wasn't kept for checking older signatures")
        alice.get_by_label("Message", exact=True).fill("after the fresh start")
        alice.get_by_label("Send", exact=True).click()
        expect(bob.locator("[data-message-id]", has_text="after the fresh start").last).to_be_visible(timeout=15000)

        alice_ctx.close()
        bob_ctx.close()
        browser.close()

    if problems:
        print("PROBLEMS:")
        for problem in problems:
            print(" -", problem)
        sys.exit(1)
    print("encryption e2e: all checks passed")


if __name__ == "__main__":
    main()
