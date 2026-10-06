"""
Encrypt media files uploaded before encryption at rest existed. Safe to run more than once:
files that are already encrypted are skipped.

    python scripts/encrypt_media.py            # encrypt everything in UPLOAD_DIR
    python scripts/encrypt_media.py --dry-run  # only count

Set MEDIA_ENCRYPTION_KEY in backend/.env first if you want your own key (see README).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import media_crypto, media_storage  # noqa: E402


def main(dry_run: bool) -> int:
    root = media_storage.upload_root()
    done = skipped = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name.startswith(".") or path.suffix in (".upload", ".enc-tmp"):
            continue
        key = path.relative_to(root).as_posix()
        if media_storage.path_for_key(key) is None:
            continue  # not one of ours
        if media_crypto.is_encrypted(path):
            skipped += 1
            continue
        if not dry_run:
            media_crypto.encrypt_file(path, path)
        done += 1
    print(f"{'Would encrypt' if dry_run else 'Encrypted'} {done} file(s); {skipped} already encrypted. Folder: {root}")
    return 0


if __name__ == "__main__":
    sys.exit(main("--dry-run" in sys.argv[1:]))
