"""
Shared by the browser tests: get past the end-to-end encryption step after signing in.

The first browser on an account creates the keys silently. A browser signing in to an account
whose keys live elsewhere is asked to link (scan a QR from the other device); tests that don't
care about that start fresh instead (new keys; older encrypted messages become unreadable).
"""

from playwright.sync_api import expect


def pass_encryption_gate(page, username: str = "") -> None:
    """Wait for the chats; if this browser is asked to link, start fresh with new keys."""
    link = page.get_by_role("heading", name="Link this browser")
    app = page.get_by_role("heading", name="Chats")
    expect(link.or_(app).first).to_be_visible(timeout=20000)
    if link.is_visible():
        page.get_by_role("button", name="Don't have your other device?").click()
        page.get_by_role("button", name="Start fresh").click()
        expect(link).to_have_count(0, timeout=20000)
