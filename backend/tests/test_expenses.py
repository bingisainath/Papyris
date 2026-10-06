"""Manual expenses, permissions, history, settle up, balances and AI settings."""

import uuid

import pytest
from sqlalchemy import select, update

from app.api.v1 import ai_settings
from app.models.ai import UserAISettings
from app.models.user import User


async def add(client, user, conversation_id, amount="30.00", **fields):
    body = {"description": "Dinner", "currency": "EUR", "amount": amount, "split_mode": "equal", **fields}
    return await client.post(f"/api/v1/conversations/{conversation_id}/expenses", json=body, headers=user.headers)


async def balances(client, user, conversation_id, **params):
    r = await client.get(f"/api/v1/conversations/{conversation_id}/balances", params=params, headers=user.headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


@pytest.fixture
def trio(make_user, make_group):
    async def _make():
        a, b, c = await make_user("alice"), await make_user("bob"), await make_user("carol")
        return a, b, c, await make_group(a, [b, c], "Trip")
    return _make


async def test_equal_split_default_payer_and_balances(client, trio, events):
    a, b, c, group = await trio()
    r = await add(client, a, group, "10.00", splits=[{"user_id": u.id} for u in (a, b, c)])
    assert r.status_code == 200, r.text
    expense = r.json()["data"]
    assert expense["payers"] == [{"user_id": a.id, "amount_minor": 1000}]
    assert sorted(s["amount_minor"] for s in expense["shares"]) == [333, 333, 334]
    assert any(p.get("type") == "expense_changed" for _, p in events)
    assert any(p.get("expenseId") == expense["id"] for _, p in events)  # chat card

    data = await balances(client, b, group)
    eur = data["currencies"][0]
    assert eur["my_net_minor"] == -333
    assert {(d["from_user"], d["to_user"]) for d in eur["debts"]} == {(b.id, a.id), (c.id, a.id)}
    assert set(data["users"]) == {a.id, b.id, c.id}


async def test_multiple_payers_and_validation(client, trio, make_user):
    a, b, c, group = await trio()
    outsider = await make_user()
    split = [{"user_id": u.id} for u in (a, b, c)]
    r = await add(client, a, group, "60.00", splits=split, payers=[{"user_id": a.id, "amount": "40"}, {"user_id": b.id, "amount": "10"}])
    assert r.status_code == 400 and "add up" in r.json()["message"]
    r = await add(client, a, group, "60.00", splits=split + [{"user_id": outsider.id}])
    assert r.status_code == 400 and "in this chat" in r.json()["message"]
    r = await add(client, a, group, "60.00", splits=split, payers=[{"user_id": a.id, "amount": "40"}, {"user_id": b.id, "amount": "20"}])
    assert r.status_code == 200
    debts = (await balances(client, c, group))["currencies"][0]["debts"]
    assert [(d["from_user"], d["to_user"], d["amount_minor"]) for d in debts] == [(c.id, a.id, 2000)]

    r = await add(client, a, group, "10", split_mode="percent",
                  splits=[{"user_id": a.id, "value": "50"}, {"user_id": b.id, "value": "40"}])
    assert r.status_code == 400 and "100" in r.json()["message"]
    r = await add(client, a, group, "10", split_mode="exact",
                  splits=[{"user_id": a.id, "value": "7.50"}, {"user_id": b.id, "value": "2,50"}])
    assert r.status_code == 200
    assert {s["user_id"]: s["amount_minor"] for s in r.json()["data"]["shares"]} == {a.id: 750, b.id: 250}
    r = await add(client, a, group, "1000", currency="JPY", split_mode="shares",
                  splits=[{"user_id": a.id, "value": "2"}, {"user_id": c.id, "value": "1"}])
    assert {s["user_id"]: s["amount_minor"] for s in r.json()["data"]["shares"]} == {a.id: 667, c.id: 333}
    currencies = {cur["currency"] for cur in (await balances(client, a, group))["currencies"]}
    assert currencies == {"EUR", "JPY"}


async def test_edit_history_conflicts_and_permissions(client, trio):
    a, b, c, group = await trio()
    expense = (await add(client, b, group, "30", splits=[{"user_id": u.id} for u in (a, b, c)])).json()["data"]
    url = f"/api/v1/expenses/{expense['id']}"
    edit = {"description": "Pizza", "currency": "EUR", "amount": "36", "split_mode": "equal",
            "splits": [{"user_id": u.id} for u in (a, b, c)], "payers": [{"user_id": b.id, "amount": "36"}]}

    r = await client.put(url, json={**edit, "version": 1}, headers=c.headers)  # any member can edit
    assert r.status_code == 200, r.text
    assert r.json()["data"]["version"] == 2
    r = await client.put(url, json={**edit, "version": 1}, headers=a.headers)  # stale
    assert r.status_code == 409

    r = await client.delete(url, headers=c.headers)  # not the creator, not admin
    assert r.status_code == 403
    r = await client.put(f"{url}/lock", json={"locked": True}, headers=b.headers)  # b isn't an admin
    assert r.status_code == 403
    r = await client.put(f"{url}/lock", json={"locked": True}, headers=a.headers)  # a created the group
    assert r.status_code == 200
    r = await client.put(url, json={**edit, "version": 3}, headers=b.headers)
    assert r.status_code == 403 and "locked" in r.json()["message"]
    await client.put(f"{url}/lock", json={"locked": False}, headers=a.headers)

    r = await client.delete(url, headers=b.headers)  # creator can delete
    assert r.status_code == 200
    assert (await balances(client, a, group))["currencies"] == []
    r = await client.post(f"{url}/restore", headers=a.headers)
    assert r.status_code == 200
    assert (await balances(client, a, group))["currencies"][0]["my_net_minor"] == -1200

    history = (await client.get(f"{url}/history", headers=a.headers)).json()["data"]
    actions = [h["action"] for h in history]
    assert actions == ["restored", "deleted", "unlocked", "locked", "updated", "created"]
    updated = history[4]
    assert updated["actor"]["id"] == c.id
    assert "'Dinner' to 'Pizza'" in updated["summary"] and "€30.00 to €36.00" in updated["summary"]
    assert updated["before"]["total_minor"] == 3000 and updated["after"]["total_minor"] == 3600

    listed = (await client.get(f"/api/v1/conversations/{group}/expenses", headers=a.headers)).json()["data"]
    assert [e["description"] for e in listed] == ["Pizza"]


async def test_dm_both_people_are_admins(client, make_user, make_dm):
    a, b = await make_user(), await make_user()
    dm = await make_dm(a, b)
    expense = (await add(client, a, dm, "20", splits=[{"user_id": a.id}, {"user_id": b.id}])).json()["data"]
    r = await client.delete(f"/api/v1/expenses/{expense['id']}", headers=b.headers)
    assert r.status_code == 200


async def test_settle_up_and_simplify_setting(client, trio, events):
    a, b, c, group = await trio()
    await add(client, b, group, "10", splits=[{"user_id": a.id}])  # a owes b 10
    await add(client, c, group, "10", splits=[{"user_id": b.id}])  # b owes c 10
    simplified = (await balances(client, a, group))["currencies"][0]["debts"]
    assert [(d["from_user"], d["to_user"]) for d in simplified] == [(a.id, c.id)]

    r = await client.put(f"/api/v1/conversations/{group}/expense-settings", json={"simplify_debts": False}, headers=a.headers)
    assert r.status_code == 200
    raw = (await balances(client, a, group))["currencies"][0]["debts"]
    assert {(d["from_user"], d["to_user"]) for d in raw} == {(a.id, b.id), (b.id, c.id)}

    r = await client.post(f"/api/v1/conversations/{group}/settlements",
                          json={"from_user": a.id, "to_user": b.id, "currency": "EUR", "amount": "10"}, headers=a.headers)
    assert r.status_code == 200
    assert any("paid" in (p.get("text") or "") for _, p in events)
    raw = (await balances(client, a, group))["currencies"][0]["debts"]
    assert [(d["from_user"], d["to_user"]) for d in raw] == [(b.id, c.id)]

    settlement = r.json()["data"]["id"]
    assert (await client.delete(f"/api/v1/settlements/{settlement}", headers=c.headers)).status_code == 403
    assert (await client.delete(f"/api/v1/settlements/{settlement}", headers=a.headers)).status_code == 200


async def test_outsider_sees_nothing(client, trio, make_user):
    a, b, c, group = await trio()
    expense = (await add(client, a, group, "5", splits=[{"user_id": a.id}])).json()["data"]
    outsider = await make_user()
    assert (await client.get(f"/api/v1/expenses/{expense['id']}", headers=outsider.headers)).status_code == 404
    assert (await client.get(f"/api/v1/conversations/{group}/balances", headers=outsider.headers)).status_code == 404
    assert (await add(client, outsider, group, "5", splits=[{"user_id": outsider.id}])).status_code == 404


# ------------------------------------------------------------------ AI settings

async def test_ai_settings_models_and_own_keys(client, make_user, db, monkeypatch):
    user = await make_user()
    data = (await client.get("/api/v1/ai/settings", headers=user.headers)).json()["data"]
    assert [m["model_id"] for m in data["models"]] == ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"]
    assert data["models"][0]["is_default"] is True
    assert data["keys"] == {"anthropic": None, "openai": None}

    r = await client.put("/api/v1/ai/settings", json={"preferred_model_id": 2}, headers=user.headers)
    assert r.json()["data"]["preferred_model_id"] == 2

    r = await client.put("/api/v1/ai/keys/anthropic", json={"api_key": "not-a-key-at-all-really"}, headers=user.headers)
    assert r.status_code == 400

    async def fake_verify(provider, key):
        return None
    monkeypatch.setattr(ai_settings, "verify_key", fake_verify)
    secret = "sk-ant-api03-" + "x" * 40 + "WXYZ"
    r = await client.put("/api/v1/ai/keys/anthropic", json={"api_key": secret}, headers=user.headers)
    assert r.status_code == 200
    assert r.json()["data"]["keys"]["anthropic"] == "…WXYZ"
    assert secret not in r.text
    stored = await db.get(UserAISettings, uuid.UUID(user.id))
    assert stored.anthropic_key_encrypted and secret not in stored.anthropic_key_encrypted

    r = await client.delete("/api/v1/ai/keys/anthropic", headers=user.headers)
    assert r.json()["data"]["keys"]["anthropic"] is None


async def test_store_discounts_are_private(client, make_user):
    a, b = await make_user(), await make_user()
    r = await client.post("/api/v1/store-discounts", json={"store_name": "Tesco", "percent": "10", "excluded_categories": ["Alcohol"]}, headers=a.headers)
    rule = r.json()["data"]
    assert rule["percent"] == "10" and rule["excluded_categories"] == ["alcohol"]
    assert (await client.get("/api/v1/store-discounts", headers=b.headers)).json()["data"] == []
    assert (await client.delete(f"/api/v1/store-discounts/{rule['id']}", headers=b.headers)).status_code == 404
    r = await client.put(f"/api/v1/store-discounts/{rule['id']}", json={"store_name": "Tesco", "percent": "15"}, headers=a.headers)
    assert r.json()["data"]["percent"] == "15"


async def test_admin_only_model_management(client, make_user, db):
    user, admin = await make_user(), await make_user()
    assert (await client.get("/api/v1/admin/ai", headers=user.headers)).status_code == 403
    await db.execute(update(User).where(User.id == uuid.UUID(admin.id)).values(is_app_admin=True))
    await db.commit()

    data = (await client.get("/api/v1/admin/ai", headers=admin.headers)).json()["data"]
    assert data["receipt_scans_per_month"] == 50
    sonnet = next(m for m in data["models"] if m["model_id"] == "claude-sonnet-5")
    body = {**{k: sonnet[k] for k in ("provider", "model_id", "label", "description", "sort_order")}, "enabled": True, "is_default": True}
    r = await client.put(f"/api/v1/admin/ai/models/{sonnet['id']}", json=body, headers=admin.headers)
    defaults = [m["model_id"] for m in r.json()["data"]["models"] if m["is_default"]]
    assert defaults == ["claude-sonnet-5"]

    r = await client.put("/api/v1/admin/ai/scan-limit", json={"receipt_scans_per_month": 80}, headers=user.headers)
    assert r.status_code == 403
    r = await client.put("/api/v1/admin/ai/scan-limit", json={"receipt_scans_per_month": 80}, headers=admin.headers)
    assert r.json()["data"]["receipt_scans_per_month"] == 80

    # put things back for other tests
    opus = next(m for m in data["models"] if m["model_id"] == "claude-opus-5")
    body = {**{k: opus[k] for k in ("provider", "model_id", "label", "description", "sort_order")}, "enabled": True, "is_default": True}
    await client.put(f"/api/v1/admin/ai/models/{opus['id']}", json=body, headers=admin.headers)
    await client.put("/api/v1/admin/ai/scan-limit", json={"receipt_scans_per_month": 50}, headers=admin.headers)
