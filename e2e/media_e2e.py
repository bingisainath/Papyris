"""
Browser test for photos, videos, voice notes and files (Playwright + Chromium with a fake microphone).

Checks: several photos at once become an album, photos are shrunk and lose their location,
"Document" keeps full size, voice notes record and play, failed uploads can be retried,
uploads can be cancelled, messages can be forwarded and downloaded, and chat info lists
media, docs and links.

Each run creates two "E2E Media/Forward …" groups; delete them afterwards if you like.

Needs the API, `npm start` and a worker (`python -m app.worker`) running, plus the QA users
qa_alice / qa_bob (password Passw0rd!23).

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/media_e2e.py [screenshot_dir]
"""

import io
import os
import re
import sys
import time
from pathlib import Path

import httpx
from PIL import Image
from playwright.sync_api import expect, sync_playwright

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
BASE = os.environ.get("PAPYRIS_API", "http://localhost:8000")
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
PASSWORD = "Passw0rd!23"
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)


def token(username):
    r = httpx.post(f"{API}/auth/login", json={"identifier": username, "password": PASSWORD})
    r.raise_for_status()
    return r.json()["data"]["access_token"]


def photo(path: Path, colour, size=(3000, 2000), gps=True):
    img = Image.new("RGB", size, colour)
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"
    if gps:
        exif[0x8825] = {1: "N", 2: (53.0, 20.0, 41.0), 3: "W", 4: (6.0, 15.0, 30.0)}
    img.save(path, "JPEG", exif=exif, quality=90)
    return path


def login(page, username):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill(username)
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    page.wait_for_url(lambda url: "/login" not in url)


def messages(tok, conversation_id):
    r = httpx.get(f"{API}/conversations/{conversation_id}/messages", params={"limit": 100},
                  headers={"Authorization": f"Bearer {tok}"})
    return r.json()["data"]


def served(url):
    return httpx.get(BASE + url).content


def wait_for_messages(tok, conversation_id, predicate, seconds=20):
    deadline = time.time() + seconds
    while time.time() < deadline:
        found = [m for m in messages(tok, conversation_id) if predicate(m)]
        if found:
            return found
        time.sleep(0.5)
    return []


def main():
    alice_tok, bob_tok = token("qa_alice"), token("qa_bob")
    me = lambda t: httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {t}"}).json()["data"]
    alice, bob = me(alice_tok), me(bob_tok)
    r = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {alice_tok}"},
                   json={"kind": "group", "title": f"E2E Media {int(time.time()) % 100000}", "participant_ids": [bob["id"]]})
    group = r.json()["data"]["id"]
    other_title = f"E2E Forward {int(time.time()) % 100000}"
    r = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {alice_tok}"},
                   json={"kind": "group", "title": other_title, "participant_ids": [bob["id"]]})
    other = r.json()["data"]["id"]
    print("group", group)

    photos = [photo(SHOTS / f"p{i}.jpg", c) for i, c in enumerate([(200, 60, 60), (60, 200, 60), (60, 60, 200), (200, 200, 60), (90, 40, 140)])]
    document = photo(SHOTS / "scan.jpg", (230, 230, 230), size=(2400, 1800))
    big_video = SHOTS / "big.bin.mp4"
    big_video.write_bytes(b"\x00\x00\x00\x18ftypmp42" + os.urandom(6 * 1024 * 1024))
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, permissions=["microphone"], accept_downloads=True)
        page = context.new_page()
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        login(page, "qa_alice")
        page.goto(f"{WEB}/chat/{group}")
        expect(page.get_by_label("Message", exact=True)).to_be_visible()

        # ---- 5 photos at once -> album; shrunk to 1600px, no location
        page.get_by_label("Attach").click()
        with page.expect_file_chooser() as chooser:
            page.get_by_role("menuitem", name=re.compile("Photos & videos")).click()
        chooser.value.set_files([str(x) for x in photos])
        expect(page.get_by_role("button", name=re.compile(r"^Attachment \d"))).to_have_count(5)
        page.screenshot(path=SHOTS / "m1-tray.png")
        page.get_by_label("Send", exact=True).click()
        expect(page.get_by_role("group", name="5 photos")).to_be_visible(timeout=30000)
        page.screenshot(path=SHOTS / "m2-album.png")
        sent = wait_for_messages(alice_tok, group, lambda m: m["media_type"] == "image")
        if len(sent) != 5 or any(max(m["media_width"], m["media_height"]) > 1600 for m in sent):
            problems.append(f"photos not shrunk: {[(m['media_width'], m['media_height']) for m in sent]}")
        data = served(sent[0]["media_url"])
        with Image.open(io.BytesIO(data)) as img:
            if img.getexif() or b"PhoneMaker" in data:
                problems.append("photo still has camera/location data")

        # ---- document keeps full resolution (but not location)
        page.get_by_label("Attach").click()
        with page.expect_file_chooser() as chooser:
            page.get_by_role("menuitem", name=re.compile("Document")).click()
        chooser.value.set_files(str(document))
        page.get_by_label("Send", exact=True).click()
        doc = wait_for_messages(alice_tok, group, lambda m: m["media_type"] == "file" and m["media_filename"] == "scan.jpg")
        if not doc:
            problems.append("document not sent")
        else:
            data = served(doc[0]["media_url"])
            with Image.open(io.BytesIO(data)) as img:
                if img.size != (2400, 1800) or b"PhoneMaker" in data:
                    problems.append(f"document changed: {img.size}")

        # ---- voice note (fake microphone)
        page.get_by_label("Record voice message").click()
        expect(page.get_by_text("Recording voice message")).to_be_visible()
        page.wait_for_timeout(2300)
        page.screenshot(path=SHOTS / "m3-recording.png")
        page.get_by_label("Send voice message").click()
        expect(page.get_by_label("Play voice message").last).to_be_visible(timeout=20000)
        if not wait_for_messages(alice_tok, group, lambda m: m["media_type"] == "audio"):
            problems.append("voice note not saved")
        page.screenshot(path=SHOTS / "m4-voice.png")

        # ---- failed upload -> Retry
        page.route("**/media/upload**", lambda route: route.abort())
        page.get_by_label("Attach").click()
        with page.expect_file_chooser() as chooser:
            page.get_by_role("menuitem", name=re.compile("Document")).click()
        chooser.value.set_files(str(photos[0]))
        page.get_by_label("Send", exact=True).click()
        expect(page.get_by_text("Not sent")).to_be_visible(timeout=15000)
        page.screenshot(path=SHOTS / "m5-failed.png")
        page.unroute("**/media/upload**")
        page.get_by_role("button", name="Retry").click()
        expect(page.get_by_text("Not sent")).to_have_count(0, timeout=20000)

        # ---- cancel a slow upload
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 50, "downloadThroughput": -1, "uploadThroughput": 200 * 1024})
        page.get_by_label("Attach").click()
        with page.expect_file_chooser() as chooser:
            page.get_by_role("menuitem", name=re.compile("Document")).click()
        chooser.value.set_files(str(big_video))
        page.get_by_label("Send", exact=True).click()
        cancel = page.get_by_label("Cancel upload")
        expect(cancel).to_be_visible(timeout=10000)
        page.screenshot(path=SHOTS / "m6-uploading.png")
        cancel.click()
        expect(cancel).to_have_count(0)
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 0, "downloadThroughput": -1, "uploadThroughput": -1})
        page.wait_for_timeout(1500)
        if any(m.get("media_filename") == "big.bin.mp4" for m in messages(alice_tok, group)):
            problems.append("cancelled upload was sent anyway")

        # ---- a link, then forward it to another chat
        page.get_by_label("Message", exact=True).fill("Menu: https://example.com/menu")
        page.get_by_label("Send", exact=True).click()
        bubble = page.locator("[data-message-id]", has_text="https://example.com/menu").last
        expect(bubble).to_be_visible(timeout=15000)
        page.wait_for_timeout(800)  # let the server copy replace the optimistic one
        bubble.hover()
        page.get_by_role("button", name="Forward").first.click()
        dialog = page.get_by_role("dialog", name="Forward message")
        dialog.get_by_label("Search chats").fill(other_title)
        dialog.get_by_role("button", name=other_title).click()
        page.screenshot(path=SHOTS / "m7-forward.png")
        dialog.get_by_label("Send forward").click()
        if not wait_for_messages(alice_tok, other, lambda m: "example.com/menu" in (m["text"] or "")):
            problems.append("forward didn't arrive")

        # ---- download from the viewer
        page.get_by_role("group", name="5 photos").get_by_role("button").first.click()
        viewer = page.get_by_role("dialog", name="Media viewer")
        expect(viewer).to_be_visible()
        with page.expect_download() as download:
            viewer.get_by_label("Download").click()
        if not download.value.suggested_filename.endswith(".jpg"):
            problems.append(f"download name {download.value.suggested_filename}")
        viewer.get_by_label("Close").click()

        # ---- chat info: media, docs, links
        page.get_by_label("Group info").last.click()
        page.get_by_role("button", name=re.compile("Media, links and docs")).click()
        page.wait_for_timeout(800)
        page.screenshot(path=SHOTS / "m8-media-tab.png")
        tiles = page.get_by_role("button", name="Open image")
        if tiles.count() < 5:
            problems.append(f"media tab shows {tiles.count()} photos")
        page.get_by_role("tab", name="Docs").click()
        expect(page.get_by_label("Play voice message").last).to_be_visible()
        page.get_by_role("tab", name="Links").click()
        expect(page.get_by_text("https://example.com/menu").first).to_be_visible()
        page.screenshot(path=SHOTS / "m9-links.png")

        # ---- Bob sees the album and voice note
        bob_page = context.browser.new_page(viewport={"width": 390, "height": 844})
        login(bob_page, "qa_bob")
        bob_page.goto(f"{WEB}/chat/{group}")
        expect(bob_page.get_by_role("group", name="5 photos")).to_be_visible(timeout=15000)
        expect(bob_page.get_by_label("Play voice message").first).to_be_visible()
        bob_page.screenshot(path=SHOTS / "m10-bob-phone.png")
        width = bob_page.evaluate("document.documentElement.scrollWidth")
        if width > 390:
            problems.append(f"phone page scrolls sideways ({width}px)")
        browser.close()

    print("\n".join(problems) if problems else "ALL CHECKS PASSED")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
