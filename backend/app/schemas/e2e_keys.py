"""Request bodies for the e2e keys routes (app/api/v1/e2e_keys.py)."""

import base64
import binascii
import json
from typing import Any
from pydantic import BaseModel, Field, field_validator


MAX_LINK_PAYLOAD_BYTES = 4096


def _public_key(value: str) -> str:
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("Not base64")
    if len(raw) != 32:
        raise ValueError("A public key is 32 bytes")
    return value


class SetKeysBody(BaseModel):
    enc_public: str = Field(..., max_length=64)
    sign_public: str = Field(..., max_length=64)
    # True for a fresh start (no other device to link from): older encrypted messages become unreadable
    replace: bool = False

    @field_validator("enc_public", "sign_public")
    @classmethod
    def check_public_key(cls, v: str) -> str:
        return _public_key(v)


class LinkRequestBody(BaseModel):
    ephemeral_public: str = Field(..., max_length=64)
    device_name: str = Field("New device", max_length=100)

    @field_validator("ephemeral_public")
    @classmethod
    def check_public_key(cls, v: str) -> str:
        return _public_key(v)


class ApproveBody(BaseModel):
    payload: dict[str, Any]

    @field_validator("payload")
    @classmethod
    def check_payload(cls, v: dict) -> dict:
        if len(json.dumps(v)) > MAX_LINK_PAYLOAD_BYTES or not {"e", "n", "c"} <= v.keys():
            raise ValueError("Invalid payload")
        return v
