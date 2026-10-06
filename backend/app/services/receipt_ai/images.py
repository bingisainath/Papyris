# backend/app/services/receipt_ai/images.py

"""Prepares receipt photos for the AI: upright, at most 2576px, re-encoded (drops EXIF/GPS)."""

import base64
import io

from PIL import Image, ImageOps

MAX_EDGE = 2576


def prepare(data: bytes) -> tuple[str, str]:
    """Image bytes -> (media type, base64 data)."""
    with Image.open(io.BytesIO(data)) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=90)
    return "image/jpeg", base64.standard_b64encode(out.getvalue()).decode()
