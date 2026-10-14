# backend/app/core/email_check.py
"""
Before an account is created: can this address receive the 6-digit code at all?

- The domain must exist and accept email (its DNS mail records), so "x@gmial.cmo" fails at once
  instead of the code silently never arriving.
- A domain one or two letters away from a big provider ("gmial.com", "outlok.com") gets a
  "Did you mean …?", since squatters often own those domains and do accept mail.

The person still proves the address is theirs by entering the emailed code; this only catches
mistakes earlier. If DNS can't be reached, the address is allowed (never block sign-up on our side).
"""

import asyncio
import difflib
import logging
from typing import Optional

from email_validator import EmailNotValidError, EmailUndeliverableError, caching_resolver, validate_email

logger = logging.getLogger(__name__)

# Big providers people mistype. Exact matches always pass.
POPULAR = [
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com",
    "icloud.com", "proton.me", "protonmail.com", "aol.com", "yahoo.co.in", "yahoo.co.uk", "hotmail.co.uk",
    "outlook.in", "rediffmail.com", "eircom.net", "hotmail.ie", "outlook.ie", "zoho.com",
]
# Real providers that look like a popular one: never "correct" these.
ALSO_REAL = {
    "mail.com", "gmx.com", "gmx.net", "ymail.com", "me.com", "mac.com", "hey.com", "pm.me", "web.de", "yandex.com",
    "protonmail.ch", "proton.ch", "live.co.uk", "live.in", "yahoo.ie", "yahoo.in", "hotmail.fr", "outlook.fr", "hotmail.de", "outlook.de",
}

_resolver = None


def typo_suggestion(email: str) -> Optional[str]:
    """'sai@gmial.com' -> 'sai@gmail.com'; None when the domain looks fine."""
    local, _, domain = email.strip().lower().rpartition("@")
    if not local or domain in POPULAR or domain in ALSO_REAL:
        return None
    close = difflib.get_close_matches(domain, POPULAR, n=1, cutoff=0.84)
    return f"{local}@{close[0]}" if close else None


def _check_dns(email: str) -> Optional[str]:
    global _resolver
    if _resolver is None:
        _resolver = caching_resolver(timeout=3)
    try:
        validate_email(email, check_deliverability=True, dns_resolver=_resolver)
    except EmailUndeliverableError:
        domain = email.rpartition("@")[2]
        return f"We can't send email to {domain}. Check the address for typos."
    except EmailNotValidError as e:
        return str(e)
    except Exception:  # DNS down or slow: don't block sign-up on our problem
        logger.warning("Couldn't check an email domain; allowing it")
    return None


async def email_problem(email: str, typo_checked: bool = False) -> Optional[dict]:
    """None if the address looks deliverable, else {"message", "code", "data"} for a 400.
    typo_checked: the person saw "Did you mean …?" and kept their address."""
    suggestion = None if typo_checked else typo_suggestion(email)
    if suggestion:
        return {"message": f"Did you mean {suggestion}?", "code": "email_typo", "data": {"suggestion": suggestion}}
    problem = await asyncio.to_thread(_check_dns, email)
    if problem:
        return {"message": problem, "code": "email_undeliverable", "data": None}
    return None
