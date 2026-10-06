# backend/app/core/logging.py

import logging
import re
import sys

from app.config.settings import settings

LOG_FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"

# Secrets that appear in URLs: WebSocket access tokens and media link signatures
_SECRET_PARAMS = re.compile(r"((?:token|sig)=)[^&\s\"']+")


class RedactSecrets(logging.Filter):
    """Mask ?token= and &sig= values in log lines (uvicorn logs full request URLs)."""

    def filter(self, record: logging.LogRecord) -> bool:
        redact = lambda v: _SECRET_PARAMS.sub(r"\1[redacted]", v) if isinstance(v, str) else v
        if isinstance(record.args, dict):
            record.args = {k: redact(v) for k, v in record.args.items()}
        elif isinstance(record.args, tuple):
            record.args = tuple(redact(a) for a in record.args)
        if isinstance(record.msg, str):
            record.msg = _SECRET_PARAMS.sub(r"\1[redacted]", record.msg)
        return True


def setup_logging() -> None:
    """
    Send app logs to stdout at LOG_LEVEL (DEBUG, INFO, WARNING, ERROR).
    Safe to call more than once (uvicorn --reload re-imports the app).
    """
    root = logging.getLogger()
    if not any(getattr(h, "_papyris", False) for h in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        handler._papyris = True  # type: ignore[attr-defined]
        root.addHandler(handler)
    root.setLevel(settings.LOG_LEVEL.upper())

    for name in ("uvicorn.access", "uvicorn.error"):
        target = logging.getLogger(name)
        if not any(isinstance(f, RedactSecrets) for f in target.filters):
            target.addFilter(RedactSecrets())

    # Our loggers follow LOG_LEVEL; keep chatty libraries at WARNING unless debugging them
    for name in ("asyncio", "multipart", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)
