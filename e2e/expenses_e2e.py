"""
Browser test for expenses and receipt scanning (Playwright + Chromium).

Needs: backend from e2e/fake_ai_server.py on :8000, `npm start` on :3000, and the QA users
qa_alice / qa_bob / qa_carol (password Passw0rd!23) in the database.

    python e2e/expenses_e2e.py [screenshot_dir]

Other ports: PAPYRIS_API=http://localhost:8001 PAPYRIS_WEB=http://localhost:3001 python e2e/expenses_e2e.py
"""

import io
import os
import re
import sys
import time
from pathlib import Path

import httpx
from PIL import Image, ImageDraw
from playwright.sync_api import expect, sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
from encryption_gate import pass_encryption_gate  # noqa: E402

API = os.environ.get("PAPYRIS_API", "http://localhost:8000") + "/api/v1"
WEB = os.environ.get("PAPYRIS_WEB", "http://localhost:3000")
PASSWORD = "Passw0rd!23"
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else "e2e-screenshots")
SHOTS.mkdir(parents=True, exist_ok=True)


def wait_for(url: str, seconds: int = 120) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            httpx.get(url, timeout=2)
            return
        except httpx.HTTPError:
            time.sleep(1)
    raise SystemExit(f"{url} didn't come up")


def token(username: str) -> str:
    r = httpx.post(f"{API}/auth/login", json={"identifier": username, "password": PASSWORD})
    r.raise_for_status()
    return r.json()["data"]["access_token"]


def me(tok: str) -> dict:
    return httpx.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()["data"]


def receipt_photo() -> bytes:
    img = Image.new("RGB", (600, 900), "white")
    draw = ImageDraw.Draw(img)
    lines = ["TESCO", "", "MILK 1.80", "CHEESE 4.00", "RICE 12.00", "BREAD 1.60", " REDUCED -1.20",
             "CROISSANTS 2.50", " REDUCED -2.50", "", "TOTAL 18.20"]
    for n, line in enumerate(lines):
        draw.text((60, 60 + n * 50), line, fill="black")
    out = io.BytesIO()
    img.save(out, "JPEG")
    return out.getvalue()


def login(page, username: str) -> None:
    page.goto(f"{WEB}/login")
    page.locator("input[name=loginIdentifier]").fill(username)
    page.locator("input[name=loginPassword]").fill(PASSWORD)
    page.locator("input[name=loginPassword]").press("Enter")
    page.wait_for_url(lambda url: "/login" not in url)
    pass_encryption_gate(page, username)


def main() -> None:
    wait_for(f"{API}/currencies")
    wait_for(WEB)
    alice_tok, bob_tok, carol_tok = token("qa_alice"), token("qa_bob"), token("qa_carol")
    alice, bob, carol = me(alice_tok), me(bob_tok), me(carol_tok)

    r = httpx.post(f"{API}/conversations", headers={"Authorization": f"Bearer {alice_tok}"},
                   json={"kind": "group", "title": f"E2E Flat {int(time.time()) % 100000}", "participant_ids": [bob["id"], carol["id"]]})
    r.raise_for_status()
    group = r.json()["data"]["id"]
    print("group", group)

    # Alice's own Tesco discount (not printed on receipts): shows up switched off, rate adjustable
    rules = httpx.get(f"{API}/store-discounts", headers={"Authorization": f"Bearer {alice_tok}"}).json()["data"]
    if not any(r["store_name"].lower() == "tesco" for r in rules):
        httpx.post(f"{API}/store-discounts", headers={"Authorization": f"Bearer {alice_tok}"},
                   json={"store_name": "Tesco", "percent": "15"}).raise_for_status()

    photo = SHOTS / "receipt.jpg"
    photo.write_bytes(receipt_photo())
    problems: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 860})
        page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
        login(page, "qa_alice")
        page.goto(f"{WEB}/chat/{group}")

        # ---- manual expense
        page.get_by_title("Add expense").click()
        page.get_by_role("tab", name="Enter manually").click()
        page.get_by_label("Description").fill("Pizza night")
        page.get_by_label("Amount", exact=True).fill("30")
        page.screenshot(path=SHOTS / "01-manual-form.png")
        page.get_by_role("dialog").get_by_role("button", name="Add expense", exact=True).click()
        expect(page.get_by_text("Pizza night").first).to_be_visible()
        page.screenshot(path=SHOTS / "02-chat-card.png")

        # ---- scan a receipt
        page.get_by_title("Add expense").click()
        page.locator("input[type=file][accept='image/*']").set_input_files(str(photo))
        page.get_by_role("button", name="Read receipt").click()
        expect(page.get_by_text("Who is each item for?")).to_be_visible(timeout=30000)
        page.screenshot(path=SHOTS / "03-review.png", full_page=True)

        # Milk only for Alice, Cheese for Bob+Carol, Bread for Bob, Croissants for Carol, Rice for everyone
        page.get_by_role("button", name="Clear").click()
        items = page.locator("ul > li").filter(has=page.locator("button[aria-pressed]"))
        def assign(index: int, names: list[str]) -> None:
            for name in names:
                items.nth(index).locator(f"button[aria-pressed][title='{name}']").click()
        names = {u["id"]: (u.get("name") or u["username"]) for u in (alice, bob, carol)}
        a, b, c = names[alice["id"]], names[bob["id"]], names[carol["id"]]
        assign(0, [a]); assign(1, [b, c]); assign(2, [a, b, c]); assign(3, [b]); assign(4, [c])
        page.wait_for_timeout(1200)  # autosave + recalculation
        summary = page.locator("section", has_text="Each person pays")
        expect(summary).to_contain_text("18.20")

        # The store discount can be re-rated per receipt (10 / 15 / 20 %), then switched off again
        rate = page.get_by_role("group", name="Discount rate")
        rate.get_by_role("button", name="20%").click()
        page.wait_for_timeout(1200)
        expect(summary).to_contain_text("14.64")  # 18.20 - 20% of 17.80 (milk, cheese, rice; not reduced items)
        page.get_by_role("switch", name=re.compile("^Apply Tesco")).click()
        page.wait_for_timeout(1200)
        expect(summary).to_contain_text("18.20")

        # Paid by several: Alice 10.00, Bob 8.20
        page.get_by_role("tab", name="Several").click()
        payers = page.locator("div.space-y-2", has=page.get_by_label(re.compile(" paid$")))
        page.get_by_label(f"You paid").fill("10")
        payers.locator(f"button[aria-pressed][title='{b}']").click()
        page.get_by_label(f"{b} paid").fill("8.20")
        page.wait_for_timeout(1200)
        page.screenshot(path=SHOTS / "04-assigned.png", full_page=True)
        page.get_by_role("button", name=re.compile("^Save expense")).click()
        expect(page.get_by_text("Tesco").first).to_be_visible()

        # ---- hovering a received message must not move it or the sender's avatar
        bob_page = browser.new_page(viewport={"width": 1280, "height": 860})
        login(bob_page, "qa_bob")
        bob_page.goto(f"{WEB}/chat/{group}")
        bob_page.get_by_label("Message", exact=True).fill("Thanks for shopping!")
        bob_page.get_by_label("Send").click()
        bubble = page.locator("[data-message-id]", has_text="Thanks for shopping!").last
        expect(bubble).to_be_visible(timeout=15000)
        avatar = bubble.locator("[data-avatar]").first
        before = avatar.bounding_box()
        bubble.hover()
        page.wait_for_timeout(300)
        after = avatar.bounding_box()
        page.screenshot(path=SHOTS / "05a-hover.png")
        if before != after:
            problems.append(f"avatar moved on hover: {before} -> {after}")
        bob_page.close()

        # ---- open the card, check history
        page.locator("button", has_text="Tesco").last.click()
        expect(page.get_by_role("dialog")).to_contain_text("Paid by")
        page.get_by_role("tab", name="History (1)").click()
        expect(page.get_by_role("dialog")).to_contain_text("from a receipt")
        page.screenshot(path=SHOTS / "05-detail-history.png")
        page.get_by_role("dialog").get_by_label("Close").click()

        # ---- balances + settle up on the Expenses page
        page.goto(f"{WEB}/expenses?chat={group}")
        expect(page.get_by_text("You are owed")).to_be_visible()
        page.screenshot(path=SHOTS / "06-expenses-page.png")
        page.get_by_role("button", name="Settle").first.click()
        page.get_by_role("button", name="Record payment").click()
        page.wait_for_timeout(800)
        page.screenshot(path=SHOTS / "07-after-settle.png")

        # ---- settings
        page.goto(f"{WEB}/settings")
        expect(page.get_by_text("Receipt scanning")).to_be_visible()
        expect(page.get_by_text("Store discounts")).to_be_visible()
        page.screenshot(path=SHOTS / "08-settings.png", full_page=True)

        # ---- Bob on a phone sees what he owes
        phone = browser.new_page(viewport={"width": 390, "height": 844})
        phone.on("pageerror", lambda e: problems.append(f"page error (bob): {e}"))
        login(phone, "qa_bob")
        phone.goto(f"{WEB}/chat/{group}")
        expect(phone.get_by_text("You owe").first).to_be_visible()
        phone.screenshot(path=SHOTS / "09-bob-phone-chat.png")
        phone.goto(f"{WEB}/expenses?chat={group}")
        # Bob paid 8.20 of the receipt, so he owes Alice 10.00 + 6.40 - 8.20 = 8.20.
        # Alice settled the largest debt (Carol's 16.00) first, so only Bob's is left.
        expect(phone.locator("main")).to_contain_text(re.compile(r"You owe\s*€8\.20"))
        phone.screenshot(path=SHOTS / "10-bob-phone-balances.png")
        width = phone.evaluate("document.documentElement.scrollWidth")
        if width > 390:
            problems.append(f"phone page scrolls sideways ({width}px)")

        browser.close()

    # Server-side truth: shares of the receipt expense
    expenses = httpx.get(f"{API}/conversations/{group}/expenses", headers={"Authorization": f"Bearer {alice_tok}"}).json()["data"]
    tesco = next(e for e in expenses if e["source"] == "receipt")
    paid = {p["user_id"]: p["amount_minor"] for p in tesco["payers"]}
    if paid != {alice["id"]: 1000, bob["id"]: 820}:
        problems.append(f"receipt payers {paid}")
    shares = {s["user_id"]: s["amount_minor"] for s in tesco["shares"]}
    expected = {alice["id"]: 180 + 400, bob["id"]: 200 + 400 + 40, carol["id"]: 200 + 400}
    if shares != expected or tesco["total_minor"] != 1820:
        problems.append(f"receipt shares {shares} != {expected}")

    print("\n".join(problems) if problems else "ALL CHECKS PASSED")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
