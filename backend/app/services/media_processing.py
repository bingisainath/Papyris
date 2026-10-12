# backend/app/services/media_processing.py

"""
Server-side clean-up of uploads before they are stored:

- Photos: rotated upright and re-saved WITHOUT metadata, so GPS location, camera serial
  numbers etc. never reach other people. Capped at 4096 px (the app sends 1600 px normally,
  4096 px for HD).
- Videos: re-encoded to H.264/AAC MP4 at most 1280 px, unless sent in HD or as a document.
  Uses the ffmpeg bundled with the imageio-ffmpeg package (no system install needed); if it
  isn't available the original is kept.
- Video posters: a representative frame saved as a JPEG, plus the video's size and length, so
  apps that can't make a poster themselves (the phone app) still show a preview.
"""

import asyncio
import io
import logging
import re
from pathlib import Path

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MAX_IMAGE_EDGE = 4096
VIDEO_MAX_EDGE = 1280
VIDEO_TIMEOUT_SECONDS = 300
POSTER_MAX_EDGE = 640
POSTER_TIMEOUT_SECONDS = 30
_DURATION_RE = re.compile(rb"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)")

try:
    import imageio_ffmpeg

    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:  # package missing or no binary for this platform
    FFMPEG = None


def strip_jpeg_metadata(data: bytes) -> bytes:
    """Drop EXIF/XMP/IPTC/comment segments from a JPEG without re-compressing it."""
    if not data.startswith(b"\xff\xd8"):
        return data
    out = bytearray(b"\xff\xd8")
    i = 2
    while i + 4 <= len(data) and data[i] == 0xFF:
        marker = data[i + 1]
        if marker == 0xDA:  # start of scan: the rest is image data
            out += data[i:]
            return bytes(out)
        length = int.from_bytes(data[i + 2 : i + 4], "big")
        segment = data[i : i + 2 + length]
        # APP1 (EXIF/XMP), APP13 (IPTC/Photoshop), COM (comments) can identify people or places
        if marker not in (0xE1, 0xED, 0xFE):
            out += segment
        i += 2 + length
    return data  # unusual layout: leave it to the re-encode path


def clean_image(path: Path, mime: str, keep_original: bool = False) -> tuple[int, int] | None:
    """
    Strip metadata (and downscale huge images) in place. Returns (width, height).
    keep_original: sent as a document; JPEGs keep their exact pixels (metadata still removed).
    """
    if mime == "image/gif":  # keep animations; GIFs carry no location data
        with Image.open(path) as img:
            return img.size
    if keep_original and mime == "image/jpeg":
        data = path.read_bytes()
        stripped = strip_jpeg_metadata(data)
        if stripped is not data:
            path.write_bytes(stripped)
            with Image.open(path) as img:
                return img.size
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE))
        out = io.BytesIO()
        if mime == "image/jpeg":
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.save(out, format="JPEG", quality=90, optimize=True)
        elif mime == "image/png":
            img.save(out, format="PNG", optimize=True)
        elif mime == "image/webp":
            img.save(out, format="WEBP", quality=90)
        else:
            return img.size
        size = img.size
    path.write_bytes(out.getvalue())  # saved without exif/xmp/icc comments
    return size


async def compress_video(source: Path, target: Path) -> bool:
    """Re-encode to a small, streamable MP4. True if `target` was written and is smaller."""
    if not FFMPEG:
        return False
    scale = f"scale='if(gt(iw,ih),min({VIDEO_MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min({VIDEO_MAX_EDGE},ih))'"
    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-map_metadata", "-1",  # drop location and other metadata
        "-vf", scale, "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(target),
    ]
    process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=VIDEO_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        process.kill()
        logger.warning("Video compression timed out; keeping the original")
        target.unlink(missing_ok=True)
        return False
    if process.returncode != 0 or not target.exists():
        logger.warning("Video compression failed: %s", (stderr or b"")[-300:].decode(errors="replace"))
        target.unlink(missing_ok=True)
        return False
    if target.stat().st_size >= source.stat().st_size:
        target.unlink(missing_ok=True)  # already small; keep the original
        return False
    return True


async def video_poster(source: Path, target: Path) -> tuple[int, int, float | None] | None:
    """
    Save a representative early frame of the video as a JPEG (at most 640 px) at `target`.
    Returns (video width, video height, duration in seconds or None), or None if it couldn't.
    """
    if not FFMPEG:
        return None
    cmd = [
        FFMPEG, "-hide_banner", "-y", "-i", str(source),
        # pick the most typical of the first 30 frames (skips black/fade-in first frames)
        "-vf", f"thumbnail=30,scale='min({POSTER_MAX_EDGE},iw)':-2",
        "-frames:v", "1", "-q:v", "4", "-map_metadata", "-1", str(target),
    ]
    process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE)
    try:
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=POSTER_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        process.kill()
        target.unlink(missing_ok=True)
        return None
    if process.returncode != 0 or not target.exists() or target.stat().st_size == 0:
        target.unlink(missing_ok=True)
        return None
    duration = None
    if match := _DURATION_RE.search(stderr or b""):
        hours, minutes, seconds = match.groups()
        duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    try:
        with Image.open(target) as img:
            poster_w, poster_h = img.size
    except Exception:
        target.unlink(missing_ok=True)
        return None
    # The frame is scaled down; report the video's own proportions at its shown size
    return poster_w, poster_h, duration
