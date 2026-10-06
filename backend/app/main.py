from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import app.models
from app.config.settings import settings
from app.core.errors import CatchUnhandledErrors
from app.core.logging import setup_logging
from app.api.v1 import api_router
from app.websocket.routes import router as ws_router

setup_logging()

app = FastAPI(title=settings.APP_NAME)

# Order matters: middleware added later wraps earlier ones, so CORS stays outermost
app.add_middleware(CatchUnhandledErrors)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Wrap FastAPI HTTPException -> {success:false, message, data:null}
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # detail may be {"message": ..., "code": ...} when clients need to react to a specific case
    detail = exc.detail
    content = {"success": False, "message": detail, "data": None}
    if isinstance(detail, dict):
        content.update(message=detail.get("message"), code=detail.get("code"), data=detail.get("data"))
    return JSONResponse(status_code=exc.status_code, content=content, headers=getattr(exc, "headers", None))

def _first_validation_message(errors) -> str:
    for error in errors:
        message = str(error.get("msg") or "")
        if message.startswith("Value error, "):
            return message[len("Value error, "):]
    return "Please check the highlighted fields"


# ✅ Wrap validation errors too (422)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            # The first problem in plain words (e.g. "Use 3-30 lowercase letters...")
            "message": _first_validation_message(exc.errors()),
            # Only plain fields: ctx can hold exception objects that can't be sent as JSON
            "data": [{k: e.get(k) for k in ("loc", "msg", "type")} for e in exc.errors()],
        },
    )

app.include_router(api_router, prefix="/api/v1")

app.include_router(ws_router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "Backend works"}
