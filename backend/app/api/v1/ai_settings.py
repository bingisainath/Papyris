# backend/app/api/v1/ai_settings.py

"""
Receipt-scanning settings:
- /ai/settings         each person's scans used this month (ShareEven picks the model; no own keys)
- /store-discounts     each person's store discounts ("Tesco 10%, not on reduced items")
- /admin/ai/...        app admins: which model scans receipts, and the monthly limit

Server API keys are only ever read from the server's environment; nothing here exposes them.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.config.settings import settings
from app.db.session import get_db
from app.models.ai import AIModel, AppSetting
from app.models.receipt import StoreDiscountRule
from app.models.user import User
from app.services import admin as admin_service
from app.services.receipt_ai import pipeline
from app.schemas.ai_settings import (
    StoreDiscountRequest, ModelRequest, ScanLimitRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI settings"])


def _ok(data, message: str = "OK") -> dict:
    return {"success": True, "message": message, "data": data}


def _app_has_key(provider: str) -> bool:
    return bool(settings.ANTHROPIC_API_KEY if provider == "anthropic" else settings.OPENAI_API_KEY)


def _serialize_model(model: AIModel) -> dict:
    return {
        "id": model.id,
        "provider": model.provider,
        "model_id": model.model_id,
        "label": model.label,
        "description": model.description,
        "is_default": model.is_default,
    }


@router.get("/ai/settings")
async def get_ai_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """How many receipt scans this person used this month, out of how many. ShareEven picks the model."""
    return _ok({
        "usage": {
            "scans_this_month": await pipeline.scans_used(db, current_user.id),
            "monthly_limit": (await pipeline.person_scan_limit(db, current_user))["limit"],
        },
    })


# ------------------------------------------------------------------ store discounts


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
    await admin_service.log(db, current_user, "ai_model_added", None, None, model=body.model_id, default=body.is_default)
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
    await admin_service.log(db, current_user, "ai_model_changed", None, None, model=body.model_id,
                            enabled=body.enabled, default=body.is_default)
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
    await admin_service.log(db, current_user, "scan_limit_changed", None, None, scans_per_month=body.receipt_scans_per_month)
    await db.commit()
    logger.info("App admin %s set the scan limit to %s", current_user.id, body.receipt_scans_per_month)
    return _ok(await _admin_payload(db), "Limit saved")
