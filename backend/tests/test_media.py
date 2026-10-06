import struct
import zlib

import pytest

from app.config.settings import settings
from app.services import media_storage


def png_bytes(width=4, height=3):
    raw = b"".join(b"\x00" + b"\x10\x20\x30" * width for _ in range(height))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


async def upload(client, user, content=None, mime="image/png", name="pic.png"):
    files = {"file": (name, content if content is not None else png_bytes(), mime)}
    return await client.post("/api/v1/media/upload", files=files, headers=user.headers)


async def test_upload_and_serve_signed(client, make_user):
    user = await make_user()
    r = await upload(client, user)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["mediaType"] == "image" and "sig=" not in data["url"]
    served = await client.get(data["signedUrl"])
    assert served.status_code == 200
    # Re-saved without metadata, so not byte-identical, but the same picture
    from PIL import Image
    import io
    with Image.open(io.BytesIO(served.content)) as img:
        assert img.format == "PNG" and img.size == (4, 3)
    assert (data["width"], data["height"]) == (4, 3)


async def test_unsigned_or_tampered_links_refused(client, make_user):
    user = await make_user()
    data = (await upload(client, user)).json()["data"]
    assert (await client.get(data["url"])).status_code == 403
    tampered = data["signedUrl"][:-1] + ("0" if data["signedUrl"][-1] != "0" else "1")
    assert (await client.get(tampered)).status_code == 403


def test_expired_signature_rejected():
    key = "2026/01/" + "a" * 32 + ".png"
    assert not media_storage.verify_signature(key, "1000", media_storage._signature(key, 1000))


async def test_upload_requires_login(client):
    r = await client.post("/api/v1/media/upload", files={"file": ("p.png", png_bytes(), "image/png")})
    assert r.status_code in (401, 403)


@pytest.mark.parametrize("content,mime,status", [
    (png_bytes(), "video/mp4", 415),       # content doesn't match declared type
    (b"<html></html>", "text/html", 415),  # type not allowed
])
async def test_upload_rejects_bad_files(client, make_user, content, mime, status):
    user = await make_user()
    assert (await upload(client, user, content, mime)).status_code == status


async def test_upload_size_limit(client, make_user, monkeypatch, upload_dir):
    user = await make_user()
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 100)
    r = await upload(client, user, png_bytes(64, 64))
    assert r.status_code == 413
    assert not any(p.is_file() for p in upload_dir.rglob("*"))  # partial file removed


async def test_range_request(client, make_user):
    user = await make_user()
    signed = (await upload(client, user)).json()["data"]["signedUrl"]
    r = await client.get(signed, headers={"Range": "bytes=0-7"})
    assert r.status_code == 206
    assert r.content == b"\x89PNG\r\n\x1a\n"
    assert r.headers["content-range"].startswith("bytes 0-7/")


async def test_path_traversal_refused(client):
    r = await client.get("/api/v1/media/..%2F..%2Fapp%2Fmain.py")
    assert r.status_code in (403, 404)


async def test_avatar_is_returned_signed(client, make_user):
    user = await make_user()
    url = (await upload(client, user)).json()["data"]["url"]
    r = await client.patch("/api/v1/auth/me", json={"avatar": url}, headers=user.headers)
    assert "sig=" in r.json()["data"]["avatar"]


async def test_download_uses_original_name(client, make_user):
    user = await make_user()
    signed = (await upload(client, user)).json()["data"]["signedUrl"]
    r = await client.get(signed + "&download=1&name=Holiday%20photo%20%E2%9C%93.png")
    assert r.status_code == 200
    assert r.headers["content-disposition"] == "attachment; filename*=UTF-8''Holiday%20photo%20%E2%9C%93.png"
    r = await client.get(signed + "&download=1&name=..%2F..%2Fetc%2Fpasswd")
    assert "passwd" in r.headers["content-disposition"] and "/" not in r.headers["content-disposition"].split("''")[1]
