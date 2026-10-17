"""
Browser test for envelope-first delivery of encrypted (v2) messages (docs/encryption-design-v2.md §4.7).

Checks: a message appears on the other person's browser and on the sender's other (linked) browser
without "Waiting for this message…" ever showing, even for a moment; a second tab of the sending
browser shows it too; and a packet that can't be decrypted shows the placeholder, asks the sender's
device to encrypt it again and then shows the text.

It resets the encryption keys of the QA users qa_alice and qa_bob first (test accounts).

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/envelope_first_e2e.py [screenshot_dir]
"""

import json
import sys

import httpx
from playwright.sync_api import expect, sync_playwright

from encryption_e2e import API, SHOTS, WEB, chats_ready, login, sql, token, wait_db
from link_approval_e2e import reset

# Records whether the placeholder was ever on screen, from the first paint on (survives navigations)
WATCH_WAITING = """
window.__sawWaiting = false;
new MutationObserver(() => {
  if (!window.__sawWaiting && document.body && document.body.innerText.includes('Waiting for this message')) window.__sawWaiting = true;
}).observe(document, { subtree: true, childList: true, characterData: true });
"""


def bubble(page, text):
    return page.locator("[data-message-id]", has_text=text).last


def main():
    users = {u: str(sql("select id from users where username = %s", u)[0][0]) for u in ("qa_alice", "qa_bob")}
    reset(users.values())
    sql("delete from e2e_retry_requests where requester_user_id::text in %s or sender_user_id::text in %s", tuple(users.values()), tuple(users.values()))
    auth = {"Authorization": f"Bearer {token('qa_alice')}"}
    dm = httpx.post(f"{API}/conversations", headers=auth, json={"kind": "dm", "participant_ids": [users["qa_bob"]]}).json()["data"]["id"]
    sql("delete from messages where conversation_id = %s", dm)
    problems = []
    corrupt = {"next": False, "done": False, "device": None}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_context(name):
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            context.add_init_script(WATCH_WAITING)
            return context

        def new_page(context, name):
            page = context.new_page()
            page.on("pageerror", lambda e: problems.append(f"{name} page error: {e}"))
            return page

        def saw_waiting(page):
            return page.evaluate("window.__sawWaiting")

        def calm(*pages):
            for page in pages:
                page.evaluate("window.__sawWaiting = false")

        alice_ctx, bob_ctx, second_ctx = new_context("alice"), new_context("bob"), new_context("alice-second")
        alice, bob = new_page(alice_ctx, "alice"), new_page(bob_ctx, "bob")
        login(alice, "qa_alice")
        chats_ready(alice)
        login(bob, "qa_bob")
        chats_ready(bob)

        # Alice's second browser: its WebSocket can damage the next packet with details (to test retries)
        second = new_page(second_ctx, "alice-second")

        def route(ws):
            server = ws.connect_to_server()
            ws.on_message(lambda m: server.send(m))

            def to_browser(message):
                if corrupt["next"] and isinstance(message, str):
                    data = json.loads(message)
                    # Every socket of the account gets every device's packets: damage this browser's own
                    if data.get("type") == "e2e_envelope" and data.get("meta") and data.get("deviceId") == corrupt["device"]:
                        c = data["envelope"]["packet"]["c"]
                        data["envelope"]["packet"]["c"] = ("B" if c[0] == "A" else "A") + c[1:]
                        corrupt["next"], corrupt["done"] = False, True
                        message = json.dumps(data)
                ws.send(message)
            server.on_message(to_browser)

        second.route_web_socket("**/ws/chat**", route)
        login(second, "qa_alice")
        expect(second.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        number = second.get_by_test_id("link-number").inner_text()
        dialog = alice.get_by_role("alertdialog", name="Is this you?")
        expect(dialog).to_be_visible(timeout=15000)
        dialog.get_by_role("button", name=number, exact=True).click()
        chats_ready(second)
        corrupt["device"] = sql("select max(device_id) from e2e_devices where user_id::text = %s and removed_at is null", users["qa_alice"])[0][0]

        for page in (alice, bob, second):
            page.goto(f"{WEB}/chat/{dm}")
            expect(page.get_by_label("End-to-end encrypted")).to_be_visible(timeout=15000)
        alice.wait_for_timeout(1500)
        calm(alice, bob, second)

        # ---- Alice sends: Bob and Alice's other browser show it straight away, never the placeholder
        alice.get_by_label("Message", exact=True).fill("no flash, please")
        alice.get_by_label("Send", exact=True).click()
        for page, name in ((bob, "bob"), (second, "alice's other browser")):
            expect(bubble(page, "no flash, please")).to_be_visible(timeout=15000)
            if saw_waiting(page):
                problems.append(f"{name} showed 'Waiting for this message' before Alice's message")
        mine = bubble(alice, "no flash, please")
        expect(mine).to_be_visible()
        if not wait_db(dm, lambda r: r[0] == "e2e2:"):
            problems.append("Alice's message never reached the server")
        alice.wait_for_timeout(1000)
        if (mine.get_attribute("data-message-id") or "").startswith("temp-"):
            problems.append("Alice's bubble was never linked to the server's row (message_sent)")

        # Bob has the chat open, so he read it: both of Alice's browsers show it as read (receipts can
        # arrive before the other browser has decrypted its copy)
        for page, name in ((alice, "alice"), (second, "alice's other browser")):
            try:
                expect(bubble(page, "no flash, please").get_by_role("img", name="Read")).to_be_visible(timeout=10000)
            except AssertionError:
                problems.append(f"{name} doesn't show Alice's message as read")

        # ---- Bob answers: both of Alice's browsers
        calm(alice, second)
        bob.get_by_label("Message", exact=True).fill("loud and clear")
        bob.get_by_label("Send", exact=True).click()
        for page, name in ((alice, "alice"), (second, "alice's other browser")):
            expect(bubble(page, "loud and clear")).to_be_visible(timeout=15000)
            if saw_waiting(page):
                problems.append(f"{name} showed 'Waiting for this message' before Bob's message")
        bob.screenshot(path=SHOTS / "ef1-bob.png")
        second.screenshot(path=SHOTS / "ef2-alice-second.png")

        # ---- a second tab of Alice's first browser (same device): shows what the first tab sends
        tab = new_page(alice_ctx, "alice-tab")
        tab.goto(f"{WEB}/chat/{dm}")
        expect(bubble(tab, "loud and clear")).to_be_visible(timeout=15000)
        calm(tab)
        alice.get_by_label("Message", exact=True).fill("from the first tab")
        alice.get_by_label("Send", exact=True).click()
        expect(bubble(tab, "from the first tab")).to_be_visible(timeout=15000)
        if saw_waiting(tab):
            problems.append("the second tab showed 'Waiting for this message'")
        tab.close()

        # ---- a packet that can't be decrypted: placeholder, retry request, Bob's browser sends it again
        corrupt["next"] = True
        bob.get_by_label("Message", exact=True).fill("worth asking again")
        bob.get_by_label("Send", exact=True).click()
        expect(bubble(alice, "worth asking again")).to_be_visible(timeout=15000)
        expect(second.get_by_text("Waiting for this message").last).to_be_visible(timeout=15000)
        expect(bubble(second, "worth asking again")).to_be_visible(timeout=20000)
        if not corrupt["done"]:
            problems.append("the test never damaged a packet")
        rows = sql("select attempts, handled_at is not null from e2e_retry_requests where requester_user_id::text = %s", users["qa_alice"])
        if rows != [(1, True)]:
            problems.append(f"expected one handled retry request, got {rows}")
        second.screenshot(path=SHOTS / "ef3-retried.png")

        left = sql("select count(*) from e2e_envelopes where recipient_user_id::text in %s", tuple(users.values()))[0][0]
        if left:
            problems.append(f"{left} packets still waiting on the server after being read")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for x in problems:
            print(" -", x)
        sys.exit(1)
    print("envelope-first e2e: all checks passed")


if __name__ == "__main__":
    main()
