"""
Browser test for end-to-end encryption v2 messaging (Double Ratchet + Sender Keys).

Checks: the first browser of each account sets up v2 by itself; text, replies, photos, edits and a
group chat go through v2; the server only stores the "e2e2:" marker (no text, no file names) and
deletes each packet once its device acknowledges it; a reload shows the history from the browser's
encrypted local database.

Resets the QA users qa_alice and qa_bob (v1 and v2 keys) first. Needs the API, `npm start`, a worker,
and the dev database at PAPYRIS_DB.

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/v2_messaging_e2e.py [screenshot_dir]
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


def sql(query, *args):
    with psycopg2.connect(DB) as conn, conn.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchall() if cur.description else None


def reset(user_ids):
    ids = tuple(str(u) for u in user_ids)
    for table, column in [("e2e_envelopes", "recipient_user_id"), ("e2e_envelopes", "sender_user_id"), ("e2e_device_lists", "user_id"),
                          ("e2e_one_time_prekeys", "user_id"), ("e2e_signed_prekeys", "user_id"), ("e2e_link_requests", "user_id"),
                          ("e2e_devices", "user_id"), ("e2e_backups", "user_id"), ("previous_user_keys", "user_id"), ("user_keys", "user_id")]:
        sql(f"delete from {table} where {column}::text in %s", ids)


def login(page, username):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill(username)
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    expect(page.get_by_role("heading", name="Chats")).to_be_visible(timeout=20000)


def wait_v2(user_id):
    for _ in range(60):
        if sql("select 1 from e2e_device_lists where user_id = %s", user_id):
            return
        time.sleep(0.5)
    raise AssertionError("v2 wasn't set up")


def bubble(page, text):
    return page.locator("[data-message-id]", has_text=text).last


def main():
    alice, bob = (sql("select id from users where username = %s", u)[0][0] for u in ("qa_alice", "qa_bob"))
    reset([alice, bob])
    tok = httpx.post(f"{API}/auth/login", json={"identifier": "qa_alice", "password": PASSWORD}).json()["data"]["access_token"]
    auth = {"Authorization": f"Bearer {tok}"}
    dm = httpx.post(f"{API}/conversations", headers=auth, json={"kind": "dm", "participant_ids": [str(bob)]}).json()["data"]["id"]
    group = httpx.post(f"{API}/conversations", headers=auth, json={"kind": "group", "title": f"E2E V2 {int(time.time()) % 100000}", "participant_ids": [str(bob)]}).json()["data"]["id"]
    photo = SHOTS / "v2-photo.jpg"
    Image.new("RGB", (900, 600), (200, 80, 40)).save(photo, "JPEG")
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(name):
            page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
            page.on("pageerror", lambda e: problems.append(f"{name}: {e}"))
            return page

        a = new_page("alice")
        login(a, "qa_alice")
        wait_v2(alice)
        b = new_page("bob")
        login(b, "qa_bob")
        wait_v2(bob)

        # ---- direct chat: text both ways, a reply
        a.goto(f"{WEB}/chat/{dm}")
        b.goto(f"{WEB}/chat/{dm}")
        a.wait_for_timeout(1500)
        a.get_by_label("Message", exact=True).fill("hello over the ratchet")
        a.get_by_label("Send", exact=True).click()
        expect(bubble(b, "hello over the ratchet")).to_be_visible(timeout=15000)
        b.get_by_label("Message", exact=True).fill("ratchet reply")
        b.get_by_label("Send", exact=True).click()
        expect(bubble(a, "ratchet reply")).to_be_visible(timeout=15000)

        rows = sql("select text, has_link from messages where conversation_id = %s order by created_at desc limit 2", dm)
        if any(r[0] != "e2e2:" for r in rows):
            problems.append(f"server stored more than the marker: {rows}")

        # ---- photo
        a.get_by_label("Attach").click()
        with a.expect_file_chooser() as chooser:
            a.get_by_role("menuitem", name=re.compile("Photos & videos")).click()
        chooser.value.set_files(str(photo))
        a.get_by_label("Send", exact=True).click()
        img = b.locator("img[alt='v2-photo.jpg']").last
        expect(img).to_be_visible(timeout=20000)
        if not (img.get_attribute("src") or "").startswith("blob:"):
            problems.append("photo not decrypted locally")
        row = sql("select media_url, media_filename, text from messages where conversation_id = %s and media_url is not null order by created_at desc limit 1", dm)
        if not row or not row[0][0].endswith(".enc") or row[0][1] is not None or row[0][2] != "e2e2:":
            problems.append(f"photo row leaks details: {row}")

        # ---- edit
        bubble(a, "hello over the ratchet").hover()
        a.get_by_role("button", name="Edit").last.click()
        a.get_by_label("Message", exact=True).fill("hello, edited")
        a.get_by_label("Message", exact=True).press("Enter")
        expect(bubble(b, "hello, edited")).to_be_visible(timeout=15000)
        b.screenshot(path=SHOTS / "v2-1-dm.png")

        # ---- group (sender keys)
        a.goto(f"{WEB}/chat/{group}")
        b.goto(f"{WEB}/chat/{group}")
        a.wait_for_timeout(1500)
        a.get_by_label("Message", exact=True).fill("group hello")
        a.get_by_label("Send", exact=True).click()
        expect(bubble(b, "group hello")).to_be_visible(timeout=15000)
        b.get_by_label("Message", exact=True).fill("group answer")
        b.get_by_label("Send", exact=True).click()
        expect(bubble(a, "group answer")).to_be_visible(timeout=15000)

        # ---- packets are gone from the server once read; history comes from the local database
        time.sleep(1)
        left = sql("select count(*) from e2e_envelopes where recipient_user_id::text in %s", (str(alice), str(bob)))[0][0]
        if left:
            problems.append(f"{left} packets still waiting on the server after being read")
        b.goto(f"{WEB}/chat/{dm}")
        expect(bubble(b, "hello, edited")).to_be_visible(timeout=15000)
        expect(b.locator("img[alt='v2-photo.jpg']").last).to_be_visible(timeout=20000)
        b.goto(f"{WEB}/chat")
        expect(b.get_by_text("group answer").first).to_be_visible(timeout=15000)  # chat list preview from local copy
        b.screenshot(path=SHOTS / "v2-2-list.png")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for x in problems:
            print(" -", x)
        sys.exit(1)
    print("v2 messaging e2e: all checks passed")


if __name__ == "__main__":
    main()
