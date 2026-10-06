"""Photos lose their location data, videos are compressed, files are encrypted on disk."""

import io
import os
import subprocess

import pytest
from PIL import Image

from app.services import media_crypto, media_processing, media_storage
from tests.test_media import upload


def jpeg_with_gps(size=(2400, 1600)) -> bytes:
    img = Image.new("RGB", size, (120, 80, 200))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # camera make
    exif[0x8825] = {1: "N", 2: (53.0, 20.0, 41.0), 3: "W", 4: (6.0, 15.0, 30.0)}  # GPS
    out = io.BytesIO()
    img.save(out, "JPEG", exif=exif, quality=95)
    return out.getvalue()


def stored_path(url: str):
    return media_storage.path_for_key(media_storage.key_from_url(url))


async def test_photo_location_removed_and_file_encrypted(client, make_user):
    user = await make_user()
    original = jpeg_with_gps()
    assert b"PhoneMaker" in original
    data = (await upload(client, user, original, "image/jpeg", "holiday.jpg")).json()["data"]

    on_disk = stored_path(data["url"]).read_bytes()
    assert on_disk.startswith(media_crypto.MAGIC) and b"PhoneMaker" not in on_disk

    served = (await client.get(data["signedUrl"])).content
    with Image.open(io.BytesIO(served)) as img:
        assert img.size == (2400, 1600)
        assert not img.getexif()  # no camera, no GPS
    assert b"PhoneMaker" not in served


async def test_document_keeps_exact_pixels_but_not_location(client, make_user):
    user = await make_user()
    original = jpeg_with_gps((300, 200))
    r = await client.post("/api/v1/media/upload?quality=original", headers=user.headers,
                          files={"file": ("scan.jpg", original, "image/jpeg")})
    served = (await client.get(r.json()["data"]["signedUrl"])).content
    assert b"PhoneMaker" not in served
    # compressed image data (everything from start-of-scan) is untouched
    assert served[served.index(b"\xff\xda"):] == original[original.index(b"\xff\xda"):]


async def test_range_requests_across_encrypted_chunks(client, make_user):
    user = await make_user()
    content = b"%PDF-1.4\n" + os.urandom(200_000)
    data = (await upload(client, user, content, "application/pdf", "big.pdf")).json()["data"]
    assert data["size"] == len(content)
    whole = await client.get(data["signedUrl"])
    assert whole.content == content and whole.headers["content-length"] == str(len(content))
    start, end = 65_530, 131_100  # spans two chunk boundaries
    part = await client.get(data["signedUrl"], headers={"Range": f"bytes={start}-{end}"})
    assert part.status_code == 206 and part.content == content[start:end + 1]
    assert part.headers["content-range"] == f"bytes {start}-{end}/{len(content)}"


async def test_old_unencrypted_files_still_work_and_can_be_encrypted(client, upload_dir):
    key = media_storage.new_key(".pdf")
    path = media_storage.path_for_key(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"%PDF-legacy file")
    url = media_storage.sign_url(media_storage.MEDIA_URL_PREFIX + key)
    assert (await client.get(url)).content == b"%PDF-legacy file"

    import scripts.encrypt_media as script
    script.main(dry_run=False)
    assert path.read_bytes().startswith(media_crypto.MAGIC)
    assert (await client.get(url)).content == b"%PDF-legacy file"
    script.main(dry_run=False)  # second run skips it
    assert media_crypto.read_all(path) == b"%PDF-legacy file"


async def test_tampered_file_is_not_served(client, make_user):
    user = await make_user()
    data = (await upload(client, user, b"%PDF-" + os.urandom(1000), "application/pdf", "x.pdf")).json()["data"]
    path = stored_path(data["url"])
    raw = bytearray(path.read_bytes())
    raw[-5] ^= 0xFF
    path.write_bytes(bytes(raw))
    with pytest.raises(Exception):
        await client.get(data["signedUrl"])


async def test_voice_note_upload(client, make_user):
    user = await make_user()
    webm = b"\x1a\x45\xdf\xa3" + os.urandom(500)
    r = await upload(client, user, webm, "audio/webm", "voice.webm")
    data = r.json()["data"]
    assert r.status_code == 200 and data["mediaType"] == "audio" and data["url"].endswith(".weba")
    served = await client.get(data["signedUrl"])
    assert served.content == webm and "attachment" not in served.headers.get("content-disposition", "")
    assert media_storage.preview_text("audio", None) == "Voice message"


def make_video(path, size="1920x1080"):
    subprocess.run([media_processing.FFMPEG, "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"testsrc=size={size}:rate=30",
                    "-f", "lavfi", "-i", "sine=frequency=440", "-t", "2", "-c:v", "libx264", "-crf", "5",
                    "-c:a", "aac", "-metadata", "location=+53.3498-006.2603/", str(path)], check=True)


def video_size(data: bytes, tmp_path):
    probe = tmp_path / "probe.mp4"
    probe.write_bytes(data)
    out = subprocess.run([media_processing.FFMPEG, "-i", str(probe)], capture_output=True, text=True).stderr
    return out


@pytest.mark.skipif(media_processing.FFMPEG is None, reason="imageio-ffmpeg not installed")
async def test_video_compressed_to_720p_mp4_without_location(client, make_user, tmp_path):
    user = await make_user()
    source = tmp_path / "clip.mov"
    make_video(source)
    original = source.read_bytes()
    r = await client.post("/api/v1/media/upload", headers=user.headers,
                          files={"file": ("clip.mov", original, "video/quicktime")})
    data = r.json()["data"]
    assert r.status_code == 200, r.text
    assert data["url"].endswith(".mp4") and data["filename"] == "clip.mp4" and data["mimeType"] == "video/mp4"
    assert data["size"] < len(original)
    served = (await client.get(data["signedUrl"])).content
    info = video_size(served, tmp_path)
    assert "1280x720" in info and "location" not in info

    # A poster frame is made on the server (for the phone app), with the video's shape and length
    assert data["width"] / data["height"] == pytest.approx(16 / 9, rel=0.01)
    assert data["duration"] == pytest.approx(2, abs=0.2)
    assert data["thumbnailUrl"].endswith(".jpg") and "sig=" in data["thumbnailSignedUrl"]
    poster = (await client.get(data["thumbnailSignedUrl"])).content
    assert poster.startswith(b"\xff\xd8") and b"Exif" not in poster[:200]
    assert (await client.get(data["thumbnailUrl"])).status_code == 403  # unsigned link refused

    # HD keeps the video exactly as sent
    r = await client.post("/api/v1/media/upload?quality=hd", headers=user.headers,
                          files={"file": ("clip.mov", original, "video/quicktime")})
    assert (await client.get(r.json()["data"]["signedUrl"])).content == original


async def test_shared_media_docs_and_links(client, make_user, make_dm, add_message, make_group):
    from app.models.message import MessageType
    a, b, outsider = await make_user(), await make_user(), await make_user()
    dm = await make_dm(a, b)
    photo = (await upload(client, a)).json()["data"]["url"]
    await add_message(dm, a, "", message_type=MessageType.IMAGE, media_url=photo, media_width=4, media_height=3)
    await add_message(dm, b, "", message_type=MessageType.AUDIO, media_url=photo.replace(".png", ".weba"), media_duration=7)
    await add_message(dm, a, "see https://example.com/menu and http://maps.example.org/x.", message_type=MessageType.TEXT)
    await add_message(dm, a, "no links here")

    def get(kind, who=a):
        return client.get(f"/api/v1/conversations/{dm}/shared", params={"kind": kind}, headers=who.headers)

    media = (await get("media")).json()["data"]
    assert len(media) == 1 and media[0]["media_type"] == "image" and "sig=" in media[0]["media_url"]
    docs = (await get("docs")).json()["data"]
    assert [d["media_type"] for d in docs] == ["audio"] and docs[0]["media_duration"] == 7
    links = (await get("links")).json()["data"]
    assert [l["url"] for l in links] == ["https://example.com/menu", "http://maps.example.org/x"]
    assert (await get("media", outsider)).status_code == 404

    history = (await client.get(f"/api/v1/conversations/{dm}/messages", headers=b.headers)).json()["data"]
    assert any(m["media_duration"] == 7 for m in history)


async def test_setting_a_media_key_later_keeps_old_files_readable(client, make_user, monkeypatch):
    import base64
    import secrets as pysecrets
    from app.config.settings import settings

    user = await make_user()
    content = b"%PDF-" + os.urandom(100_000)
    monkeypatch.setattr(settings, "MEDIA_ENCRYPTION_KEY", "")
    old = (await upload(client, user, content, "application/pdf", "old.pdf")).json()["data"]

    monkeypatch.setattr(settings, "MEDIA_ENCRYPTION_KEY", base64.urlsafe_b64encode(pysecrets.token_bytes(32)).decode())
    new = (await upload(client, user, content, "application/pdf", "new.pdf")).json()["data"]
    assert (await client.get(old["signedUrl"])).content == content
    assert (await client.get(new["signedUrl"])).content == content
    part = await client.get(old["signedUrl"], headers={"Range": "bytes=70000-70009"})
    assert part.content == content[70000:70010]
