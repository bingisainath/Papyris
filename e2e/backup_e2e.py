"""
Browser test for the optional encrypted backup and the last-device logout warning.

Checks: turning on a backup shows a 64-digit recovery key once; logging out of the only signed-in
device warns first (mentioning the recovery key when a backup exists, or that chats will be lost
when there's none); a fresh browser restores the same keys from the backup (no new keys, old
messages still readable); a wrong recovery key is refused.

Uses qa_carol. Needs the API, `npm start`, a worker, and the dev database at PAPYRIS_DB.

    PAPYRIS_API=http://localhost:8000 PAPYRIS_WEB=http://localhost:3000 python e2e/backup_e2e.py [screenshot_dir]
"""

import os
import re
import sys
from pathlib import Path

import psycopg2
from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from encryption_gate import pass_encryption_gate  # noqa: E402

WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
DB = os.environ.get("PAPYRIS_DB", "postgresql://papyris:papyris@localhost:5432/papyris")
PASSWORD = "Passw0rd!23"
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)


def sql(query, *args):
    with psycopg2.connect(DB) as conn, conn.cursor() as cur:
        cur.execute(query, args)
        return cur.fetchall() if cur.description else None


def login(page):
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill("qa_carol")
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    page.wait_for_url(lambda url: "/login" not in url)


def main():
    carol = sql("select id from users where username = 'qa_carol'")[0][0]
    sql("delete from e2e_backups where user_id = %s", carol)
    sql("update e2e_devices set removed_at = now() where user_id = %s and removed_at is null", carol)  # no other devices
    problems = []

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def fresh():
            page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()
            page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
            return page

        page = fresh()
        login(page)
        pass_encryption_gate(page)
        keys_before = sql("select enc_public from user_keys where user_id = %s", carol)[0][0]

        # ---- no backup: the warning says chats will be lost
        page.wait_for_timeout(1500)  # let this browser register as a v2 device
        page.get_by_role("button", name="Logout").first.click()
        dialog = page.get_by_role("dialog", name="Log out of your only device?")
        expect(dialog).to_be_visible(timeout=10000)
        expect(dialog.get_by_text(re.compile("you have no backup"))).to_be_visible()
        page.screenshot(path=SHOTS / "b1-warning-no-backup.png")
        dialog.get_by_role("button", name="Turn on backup").click()

        # ---- turn on backup
        page.get_by_role("button", name="Turn on backup").click()
        key = page.get_by_test_id("recovery-key").inner_text()
        if len(re.sub(r"\D", "", key)) != 64:
            problems.append(f"recovery key isn't 64 digits: {key!r}")
        page.screenshot(path=SHOTS / "b2-recovery-key.png")
        page.get_by_text("I've saved my recovery key").click()
        page.get_by_role("button", name="Turn on and back up now").click()
        expect(page.get_by_text(re.compile("^On\\. Last backup"))).to_be_visible(timeout=20000)
        if not sql("select 1 from e2e_backups where user_id = %s", carol):
            problems.append("no backup stored")
        aik_before = sql("select aik from e2e_device_lists where user_id = %s", carol)[0][0]

        # ---- with a backup: the warning mentions the recovery key
        page.get_by_role("button", name="Logout").first.click()
        expect(dialog.get_by_text(re.compile("64-digit backup recovery key"))).to_be_visible(timeout=10000)
        dialog.get_by_role("button", name="Log out anyway").click()
        expect(page.locator("input[name=loginIdentifier]")).to_be_visible(timeout=15000)

        # ---- a fresh browser restores the same keys from the backup
        page2 = fresh()
        login(page2)
        expect(page2.get_by_role("heading", name="Link this browser")).to_be_visible(timeout=15000)
        page2.get_by_role("button", name="Don't have your other device?").click()
        page2.get_by_label("Recovery key").fill("1" * 64)
        page2.get_by_role("button", name="Restore").click()
        expect(page2.get_by_text("That recovery key doesn't match your backup")).to_be_visible(timeout=15000)
        page2.get_by_label("Recovery key").fill(key)
        page2.screenshot(path=SHOTS / "b3-restore.png")
        page2.get_by_role("button", name="Restore").click()
        expect(page2.get_by_role("heading", name="Chats")).to_be_visible(timeout=20000)
        if sql("select enc_public from user_keys where user_id = %s", carol)[0][0] != keys_before:
            problems.append("restoring replaced the keys instead of restoring them")
        # v2: the restored browser is on the device list, signed with the same account key (same security code)
        page2.wait_for_timeout(1500)
        aik_after, signed = sql("select aik, signed_list from e2e_device_lists where user_id = %s", carol)[0]
        newest = sql("select max(device_id) from e2e_devices where user_id = %s", carol)[0][0]
        if aik_after != aik_before:
            problems.append("restoring changed the account key (contacts would see a new security code)")
        if f'"id": {newest},' not in signed:
            problems.append("the restored browser isn't on the account's device list")

        # ---- turning backups off
        page2.goto(f"{WEB}/settings")
        page2.once("dialog", lambda d: d.accept())
        page2.get_by_role("button", name="Turn off").click()
        expect(page2.get_by_role("button", name="Turn on backup")).to_be_visible(timeout=15000)
        if sql("select 1 from e2e_backups where user_id = %s", carol):
            problems.append("backup not deleted when turned off")
        browser.close()

    if problems:
        print("PROBLEMS:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("backup e2e: all checks passed")


if __name__ == "__main__":
    main()
