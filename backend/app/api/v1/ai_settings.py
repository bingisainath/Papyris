# backend/app/api/v1/ai_settings.py

"""
Receipt-scanning settings:
- /ai/...              each person's model choice, own API keys (write-only), usage this month
- /store-discounts     each person's store discounts ("Tesco 10%, not on reduced items")
- /admin/ai/...        app admins: which models are offered, the default, the monthly limit

Server API keys are only ever read from the server's environment; nothing here exposes them.
"""

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal, Optional

import anthropic
import openai
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.config.settings import settings
from app.db.session import get_db
from app.models.ai import AIModel, AppSetting, UserAISettings
from app.models.receipt import StoreDiscountRule
from app.models.user import User
from app.services import secrets
from app.services.receipt_ai import pipeline

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI settings"])

Provider = Literal["anthropic", "openai"]


def _ok(data, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data}


def _app_has_key(provider: str) -> bool:
    return bool(settings.ANTHROPIC_API_KEY if provider == "anthropic" else settings.OPENAI_API_KEY)


async def _prefs(db: AsyncSession, user: User) -> UserAISettings:
    prefs = await db.get(UserAISettings, user.id)
    if prefs is None:
        prefs = UserAISettings(user_id=user.id)
        db.add(prefs)
        await db.flush()
    return prefs


def _serialize_model(model: AIModel, own_keys: dict[str, bool] | None = None) -> dict:
    data = {
        "id": model.id,
        "provider": model.provider,
        "model_id": model.model_id,
        "label": model.label,
        "description": model.description,
        "is_default": model.is_default,
    }
    if own_keys is not None:
        data["available"] = _app_has_key(model.provider) or own_keys.get(model.provider, False)
    return data


async def _settings_payload(db: AsyncSession, user: User) -> dict:
    prefs = await db.get(UserAISettings, user.id)
    anthropic_key = secrets.decrypt(prefs.anthropic_key_encrypted) if prefs else None
    openai_key = secrets.decrypt(prefs.openai_key_encrypted) if prefs else None
    own = {"anthropic": bool(anthropic_key), "openai": bool(openai_key)}
    models = (await db.execute(
        select(AIModel).where(AIModel.enabled.is_(True)).order_by(AIModel.sort_order, AIModel.id)
    )).scalars().all()
    return {
        "models": [_serialize_model(m, own) for m in models],
        "preferred_model_id": prefs.preferred_model_id if prefs else None,
        "keys": {
            "anthropic": secrets.mask(anthropic_key),
            "openai": secrets.mask(openai_key),
        },
        "app_keys": {"anthropic": _app_has_key("anthropic"), "openai": _app_has_key("openai")},
        "usage": {
            "scans_this_month": await pipeline.scans_used(db, user.id),
            "monthly_limit": await pipeline.scan_limit(db),
        },
        "is_app_admin": bool(user.is_app_admin),
    }


class PreferenceRequest(BaseModel):
    # None = use the app default
    preferred_model_id: Optional[int] = None


class KeyRequest(BaseModel):
    api_key: str = Field(..., min_length=20, max_length=300)


_KEY_FORMATS = {"anthropic": re.compile(r"^sk-ant-[A-Za-z0-9_\-]+$"), "openai": re.compile(r"^sk-[A-Za-z0-9_\-]+$")}


async def verify_key(provider: str, api_key: str) -> None:
    """Cheap check that the key works (lists models; costs nothing)."""
    try:
        if provider == "anthropic":
            await anthropic.AsyncAnthropic(api_key=api_key, timeout=15, max_retries=0).models.list(limit=1)
        else:
            await openai.AsyncOpenAI(api_key=api_key, timeout=15, max_retries=0).models.list()
    except (anthropic.AuthenticationError, openai.AuthenticationError):
        raise HTTPException(status_code=400, detail="That key was rejected. Check you copied all of it")
    except (anthropic.PermissionDeniedError, openai.PermissionDeniedError):
        raise HTTPException(status_code=400, detail="That key doesn't have permission to use the API")
    except (anthropic.APIError, openai.APIError):
        logger.warning("Couldn't verify a %s key", provider)
        raise HTTPException(status_code=502, detail="Couldn't check the key right now. Try again")


@router.get("/ai/settings")
async def get_ai_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return _ok(await _settings_payload(db, current_user))


@router.put("/ai/settings")
async def update_ai_settings(
    body: PreferenceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prefs = await _prefs(db, current_user)
    if body.preferred_model_id is not None:
        model = await db.get(AIModel, body.preferred_model_id)
        if model is None or not model.enabled:
            raise HTTPException(status_code=400, detail="That model isn't available")
    prefs.preferred_model_id = body.preferred_model_id
    await db.commit()
    return _ok(await _settings_payload(db, current_user), "Saved")


@router.put("/ai/keys/{provider}")
async def set_own_key(
    provider: Provider,
    body: KeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = body.api_key.strip()
    if not _KEY_FORMATS[provider].match(key):
        raise HTTPException(status_code=400, detail="That doesn't look like an API key")
    await verify_key(provider, key)
    prefs = await _prefs(db, current_user)
    if provider == "anthropic":
        prefs.anthropic_key_encrypted = secrets.encrypt(key)
    else:
        prefs.openai_key_encrypted = secrets.encrypt(key)
    await db.commit()
    logger.info("User %s saved their own %s key", current_user.id, provider)
    return _ok(await _settings_payload(db, current_user), "Key saved")


@router.delete("/ai/keys/{provider}")
async def remove_own_key(
    provider: Provider,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prefs = await _prefs(db, current_user)
    if provider == "anthropic":
        prefs.anthropic_key_encrypted = None
    else:
        prefs.openai_key_encrypted = None
    await db.commit()
    return _ok(await _settings_payload(db, current_user), "Key removed")


# ------------------------------------------------------------------ store discounts

class StoreDiscountRequest(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=80)
    percent: Decimal = Field(..., gt=0, le=100)
    excluded_categories: list[str] = Field(default_factory=list, max_length=20)
    stacks_with_reduced: bool = False
    active: bool = True


def _serialize_rule(rule: StoreDiscountRule) -> dict:
    return {
        "id": rule.id,
        "store_name": rule.store_name,
        "percent": f"{Decimal(rule.percent).normalize():f}",
        "excluded_categories": rule.excluded_categories or [],
        "stacks_with_reduced": rule.stacks_with_reduced,
        "active": rule.active,
    }


def _apply_rule(rule: StoreDiscountRule, body: StoreDiscountRequest) -> None:
    key = pipeline.store_key(body.store_name)
    if not key:
        raise HTTPException(status_code=400, detail="Enter the store's name")
    rule.store_name = body.store_name.strip()
    rule.store_key = key
    rule.percent = body.percent
    rule.excluded_categories = sorted({c.strip().lower()[:40] for c in body.excluded_categories if c.strip()})
    rule.stacks_with_reduced = body.stacks_with_reduced
    rule.active = body.active


async def _own_rule(db: AsyncSession, rule_id: int, user: User) -> StoreDiscountRule:
    rule = await db.get(StoreDiscountRule, rule_id)
    if rule is None or rule.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Store discount not found")
    return rule


@router.get("/store-discounts")
async def list_store_discounts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rules = (await db.execute(
        select(StoreDiscountRule).where(StoreDiscountRule.owner_id == current_user.id).order_by(StoreDiscountRule.store_name)
    )).scalars().all()
    return _ok([_serialize_rule(r) for r in rules])


@router.post("/store-discounts")
async def create_store_discount(
    body: StoreDiscountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = len((await db.execute(
        select(StoreDiscountRule.id).where(StoreDiscountRule.owner_id == current_user.id)
    )).all())
    if count >= 30:
        raise HTTPException(status_code=400, detail="You can save up to 30 store discounts")
    rule = StoreDiscountRule(owner_id=current_user.id, created_at=datetime.now(timezone.utc))
    _apply_rule(rule, body)
    db.add(rule)
    await db.commit()
    return _ok(_serialize_rule(rule), "Store discount saved")


@router.put("/store-discounts/{rule_id}")
async def update_store_discount(
    rule_id: int,
    body: StoreDiscountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _own_rule(db, rule_id, current_user)
    _apply_rule(rule, body)
    await db.commit()
    return _ok(_serialize_rule(rule), "Store discount saved")


@router.delete("/store-discounts/{rule_id}")
async def delete_store_discount(
    rule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _own_rule(db, rule_id, current_user)
    await db.delete(rule)
    await db.commit()
    return _ok(None, "Store discount removed")


# ------------------------------------------------------------------ app admin

def _require_app_admin(user: User) -> None:
    if not user.is_app_admin:
        raise HTTPException(status_code=403, detail="Only app admins can do this")


class ModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    provider: Provider
    model_id: str = Field(..., min_length=3, max_length=80, pattern=r"^[A-Za-z0-9._:\-]+$")
    label: str = Field(..., min_length=1, max_length=80)
    description: str = Field("", max_length=200)
    enabled: bool = True
    is_default: bool = False
    sort_order: int = 0


class ScanLimitRequest(BaseModel):
    receipt_scans_per_month: int = Field(..., ge=0, le=100000)


async def _admin_payload(db: AsyncSession) -> dict:
    models = (await db.execute(select(AIModel).order_by(AIModel.sort_order, AIModel.id))).scalars().all()
    return {
        "models": [{**_serialize_model(m), "enabled": m.enabled, "sort_order": m.sort_order} for m in models],
        "receipt_scans_per_month": await pipeline.scan_limit(db),
        "app_keys": {"anthropic": _app_has_key("anthropic"), "openai": _app_has_key("openai")},
    }


async def _save_model(db: AsyncSession, model: AIModel, body: ModelRequest) -> None:
    model.provider, model.model_id, model.label = body.provider, body.model_id, body.label
    model.description, model.enabled, model.sort_order = body.description, body.enabled, body.sort_order
    if body.is_default:
        if not body.enabled:
            raise HTTPException(status_code=400, detail="The default model must be enabled")
        await db.execute(update(AIModel).values(is_default=False))
    model.is_default = body.is_default and body.enabled


@router.get("/admin/ai")
async def admin_get(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_app_admin(current_user)
    return _ok(await _admin_payload(db))


@router.post("/admin/ai/models")
async def admin_add_model(
    body: ModelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_app_admin(current_user)
    model = AIModel()
    await _save_model(db, model, body)
    db.add(model)
    await db.commit()
    logger.info("App admin %s added model %s/%s", current_user.id, body.provider, body.model_id)
    return _ok(await _admin_payload(db), "Model added")


@router.put("/admin/ai/models/{model_id}")
async def admin_update_model(
    model_id: int,
    body: ModelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_app_admin(current_user)
    model = await db.get(AIModel, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    await _save_model(db, model, body)
    await db.commit()
    logger.info("App admin %s updated model %s", current_user.id, model_id)
    return _ok(await _admin_payload(db), "Model saved")


@router.put("/admin/ai/scan-limit")
async def admin_scan_limit(
    body: ScanLimitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_app_admin(current_user)
    row = await db.get(AppSetting, pipeline.SCAN_LIMIT_KEY)
    if row is None:
        db.add(AppSetting(key=pipeline.SCAN_LIMIT_KEY, value=str(body.receipt_scans_per_month)))
    else:
        row.value = str(body.receipt_scans_per_month)
    await db.commit()
    logger.info("App admin %s set the scan limit to %s", current_user.id, body.receipt_scans_per_month)
    return _ok(await _admin_payload(db), "Limit saved")
