"""
Browser test for one-tap device linking ("Is this you?" with number matching).

Checks: a new browser shows a number and the signed-in browser pops up "Is this you?" with three
numbers; a wrong number turns it down (the new browser says so); trying again and tapping the right
number links it and the history comes across; "Not me" turns it down (and closes the pop-up on
the other signed-in browser); the grant doesn't stay on the server.

It resets the encryption keys of the QA users qa_alice and qa_bob first (test accounts).

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/link_approval_e2e.py [screenshot_dir]
"""

import re
import sys

from playwright.sync_api import expect, sync_playwright

import httpx

from encryption_e2e import API, SHOTS, WEB, chats_ready, login, sql, token, wait_db


def reset(user_ids):
    ids = tuple(user_ids)
    sql("delete from previous_user_keys where user_id::text in %s", ids)
    sql("delete from user_keys where user_id::text in %s", ids)
    for table in ("e2e_envelopes", "e2e_link_requests", "e2e_one_time_prekeys", "e2e_signed_prekeys", "e2e_device_lists", "e2e_devices", "e2e_backups"):
        column = "recipient_user_id" if table == "e2e_envelopes" else "user_id"
        sql(f"delete from {table} where {column}::text in %s", ids)


def main():
    users = {u: str(sql("select id from users where username = %s", u)[0][0]) for u in ("qa_alice", "qa_bob")}
    reset(users.values())
    auth = {"Authorization": f"Bearer {token('qa_alice')}"}
    dm = httpx.post(f"{API}/conversations", headers=auth, json={"kind": "dm", "participant_ids": [users["qa_bob"]]}).json()["data"]["id"]
    sql("delete from messages where conversation_id = %s", dm)
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_page(name):
            page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
            page.on("pageerror", lambda e: problems.append(f"{name} page error: {e}"))
            return page

        alice = new_page("alice")
        login(alice, "qa_alice")
        chats_ready(alice)
        bob = new_page("bob")
        login(bob, "qa_bob")
        chats_ready(bob)
        alice.goto(f"{WEB}/chat/{dm}")
        expect(alice.get_by_label("End-to-end encrypted")).to_be_visible(timeout=15000)
        secret = "history before linking"
        alice.get_by_label("Message", exact=True).fill(secret)
        alice.get_by_label("Send", exact=True).click()
        if not wait_db(dm, lambda r: r[0].startswith("e2e2:")):  # sent, not just shown
            problems.append("the first message never reached the server")
        alice.goto(f"{WEB}/chats")
        chats_ready(alice)

        # ---- a new browser: the number by default, a pop-up on the signed-in one
        second = new_page("alice-second")
        login(second, "qa_alice")
        expect(second.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        number = int(second.get_by_test_id("link-number").inner_text())
        if second.get_by_test_id("link-code").is_visible():
            problems.append("the code shows by default instead of the number")
        second.screenshot(path=SHOTS / "l1-new-browser-number.png")

        dialog = alice.get_by_role("alertdialog", name="Is this you?")
        expect(dialog).to_be_visible(timeout=15000)
        choices = [int(t) for t in dialog.get_by_role("group", name="Number choices").get_by_role("button").all_inner_texts()]
        if len(choices) != 3 or number not in choices or len(set(choices)) != 3:
            problems.append(f"choices {choices} don't hold the number {number} once among three")
        alice.screenshot(path=SHOTS / "l2-is-this-you.png")

        # ---- wrong number: turned down on both sides
        wrong = next(n for n in choices if n != number)
        dialog.get_by_role("button", name=str(wrong), exact=True).click()
        expect(dialog).to_be_hidden(timeout=15000)
        expect(alice.get_by_text(re.compile("wasn't the number"))).to_be_visible(timeout=10000)
        expect(second.get_by_text("This was turned down on your other device.")).to_be_visible(timeout=15000)
        second.screenshot(path=SHOTS / "l3-turned-down.png")

        # ---- try again, right number: linked, history arrives
        second.get_by_role("button", name="Try again").click()
        expect(second.get_by_test_id("link-number")).to_be_visible(timeout=15000)
        number = int(second.get_by_test_id("link-number").inner_text())
        expect(dialog).to_be_visible(timeout=15000)
        dialog.get_by_role("button", name=str(number), exact=True).click()
        chats_ready(second)
        expect(dialog).to_be_hidden(timeout=10000)
        second.goto(f"{WEB}/chat/{dm}")
        expect(second.locator("[data-message-id]", has_text=secret).last).to_be_visible(timeout=20000)
        second.screenshot(path=SHOTS / "l4-linked-history.png")
        # The grant is handed over once and then deleted
        left = sql('select count(*) from e2e_link_requests where user_id::text = %s and "grant" is not null', users["qa_alice"])[0][0]
        if left:
            problems.append(f"{left} grant(s) still on the server after the new browser collected it")

        # ---- "Not me" (both signed-in browsers ask; answering on one closes it on the other)
        third = new_page("alice-third")
        login(third, "qa_alice")
        expect(third.get_by_test_id("link-number")).to_be_visible(timeout=15000)
        expect(dialog).to_be_visible(timeout=15000)
        second_dialog = second.get_by_role("alertdialog", name="Is this you?")
        expect(second_dialog).to_be_visible(timeout=15000)
        dialog.get_by_role("button", name="Not me").click()
        expect(third.get_by_text("This was turned down on your other device.")).to_be_visible(timeout=15000)
        expect(second_dialog).to_be_hidden(timeout=15000)

        browser.close()

    if problems:
        print("PROBLEMS:\n- " + "\n- ".join(problems))
        sys.exit(1)
    print("link approval e2e: all checks passed")


if __name__ == "__main__":
    main()
