# backend/app/services/fx_rates.py
# Exchange rates for showing expense totals in the currency someone picked in Settings.
# Only for display: balances, splits and payments always stay in each expense's own currency.
#
# Source: ExchangeRate-API's open endpoint (free, no key, updated once a day). Rates are kept in
# memory for a few hours so the app doesn't call it on every screen.

import logging
import time

import httpx

from app.services.money import CURRENCIES

logger = logging.getLogger(__name__)

SOURCE_URL = "https://open.er-api.com/v6/latest/USD"
CACHE_SECONDS = 6 * 3600
RETRY_SECONDS = 10 * 60  # after a failed fetch, don't hammer the source

_cache: dict = {"rates": None, "updated": None, "fetched_at": 0.0, "failed_at": 0.0}


class RatesUnavailable(Exception):
    pass


async def usd_rates() -> tuple[dict[str, float], str | None]:
    """{currency: units per 1 USD} for the currencies Papyris supports, and when they were published."""
    now = time.time()
    fresh = _cache["rates"] is not None and now - _cache["fetched_at"] < CACHE_SECONDS
    if fresh or (_cache["rates"] is not None and now - _cache["failed_at"] < RETRY_SECONDS):
        return _cache["rates"], _cache["updated"]
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(SOURCE_URL)
            response.raise_for_status()
            body = response.json()
        if body.get("result") != "success":
            raise ValueError(f"unexpected answer: {body.get('result')}")
        rates = {code: float(rate) for code, rate in body["rates"].items() if code in CURRENCIES and rate}
        _cache.update(rates=rates, updated=body.get("time_last_update_utc"), fetched_at=now)
    except Exception:
        _cache["failed_at"] = now
        logger.exception("Couldn't fetch exchange rates")
        if _cache["rates"] is None:
            raise RatesUnavailable("Exchange rates are unavailable right now")
    return _cache["rates"], _cache["updated"]


async def rates_for(base: str) -> tuple[dict[str, float], str | None]:
    """{currency: units of that currency per 1 `base`}."""
    usd, updated = await usd_rates()
    if base not in usd:
        raise RatesUnavailable(f"No exchange rate for {base}")
    per_base = usd[base]
    return {code: rate / per_base for code, rate in usd.items()}, updated
