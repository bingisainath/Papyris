"""
Make a user an app admin (can choose which AI models are offered and the monthly scan limit).

    python scripts/make_admin.py <username>          # grant
    python scripts/make_admin.py <username> --revoke # take it away

Only someone with access to the server and its database can run this.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.db.session import async_session_maker, engine  # noqa: E402
from app.models import User  # noqa: E402


async def main(username: str, grant: bool) -> int:
    async with async_session_maker() as db:
        user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if user is None:
            print(f"No user called {username!r}")
            return 1
        user.is_app_admin = grant
        await db.commit()
        print(f"{username} is {'now' if grant else 'no longer'} an app admin")
    await engine.dispose()
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1], "--revoke" not in sys.argv[2:])))
