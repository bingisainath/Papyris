"""Optional encrypted backup: one per account, only the newest kept, readable only by its owner."""

import os


async def upload(client, user, size=1000, kind="backup"):
    r = await client.post(f"/api/v1/media/upload?encrypted=true&kind={kind}", headers=user.headers,
                          files={"file": ("backup.enc", os.urandom(size), "application/octet-stream")})
    assert r.status_code == 200, r.text
    return r.json()["data"]["url"]


def body(url):
    return {"url": url, "sha256": "x" * 44, "size": 1000, "wrapped_key": {"n": "a" * 32, "c": "b" * 64}, "verifier": "v" * 43}


async def test_backup_lifecycle(client, make_user, upload_dir):
    a, b = await make_user(), await make_user()
    assert (await client.get("/api/v1/e2e/backup", headers=a.headers)).json()["data"] == {"exists": False}

    first = await upload(client, a)
    r = await client.put("/api/v1/e2e/backup", json=body(first), headers=a.headers)
    assert r.status_code == 200, r.text
    got = (await client.get("/api/v1/e2e/backup", headers=a.headers)).json()["data"]
    assert got["exists"] and "sig=" in got["url"] and got["wrapped_key"] == {"n": "a" * 32, "c": "b" * 64}
    assert (await client.get("/api/v1/e2e/backup", headers=b.headers)).json()["data"] == {"exists": False}
    assert (await client.get(got["url"])).status_code == 200

    # A newer backup replaces the old one, whose file is deleted
    second = await upload(client, a)
    await client.put("/api/v1/e2e/backup", json=body(second), headers=a.headers)
    files = [p for p in upload_dir.rglob("*.enc")]
    assert len(files) == 1

    # Only encrypted uploads, and a sane wrapped key
    assert (await client.put("/api/v1/e2e/backup", json=body("/api/v1/media/2026/10/" + "a" * 32 + ".enc"), headers=a.headers)).status_code == 422
    bad = body(second)
    bad["wrapped_key"] = {"x": 1}
    assert (await client.put("/api/v1/e2e/backup", json=bad, headers=a.headers)).status_code == 422

    assert (await client.delete("/api/v1/e2e/backup", headers=a.headers)).status_code == 200
    assert (await client.get("/api/v1/e2e/backup", headers=a.headers)).json()["data"] == {"exists": False}
    assert not list(upload_dir.rglob("*.enc"))


async def test_backups_may_be_bigger_than_files(client, make_user):
    from app.services import media_storage
    assert media_storage.max_size_for("backup") > media_storage.max_size_for("video")
    a = await make_user()
    await upload(client, a, size=11 * 1024 * 1024)  # above the 10 MB file limit
