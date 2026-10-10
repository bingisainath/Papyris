"""Request bodies for the ai settings routes (app/api/v1/ai_settings.py)."""

from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


Provider = Literal["anthropic", "openai"]


class PreferenceRequest(BaseModel):
    # None = use the app default
    preferred_model_id: Optional[int] = None


class KeyRequest(BaseModel):
    api_key: str = Field(..., min_length=20, max_length=300)


class StoreDiscountRequest(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=80)
    percent: Decimal = Field(..., gt=0, le=100)
    excluded_categories: list[str] = Field(default_factory=list, max_length=20)
    stacks_with_reduced: bool = False
    active: bool = True


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
