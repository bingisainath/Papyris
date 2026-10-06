# backend/app/core/errors.py

import logging

from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


class CatchUnhandledErrors:
    """
    Turn unexpected exceptions into a generic JSON 500 and log the traceback once.
    Added inside CORSMiddleware so browsers get the error response (not a CORS failure),
    and internal details never reach the client.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if response_started:
                raise
            response = JSONResponse(
                status_code=500,
                content={"success": False, "message": "Something went wrong. Please try again.", "data": None},
            )
            await response(scope, receive, send)
