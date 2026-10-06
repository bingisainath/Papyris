# backend/app/services/split_engine.py

"""
Turns a receipt (items, discounts, tax, fees, who each item is for) into exact
per-person amounts. Pure functions on integers: no database, no AI.

Order of application (see docs/expenses-design in the PR):
  1. Item and promotion discounts       -> only the item(s) they belong to
  2. Store-wide / coupon bill discounts -> eligible items, by their price after step 1
  3. Tax added on top of prices         -> taxed items, by price
  4. Fees, service charges, tips, ...   -> by item price, equally per person, or to chosen people
Then each item's net price is split among the people it's for. Every split uses the
largest-remainder method, so the parts always add up exactly.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.services.money import MoneyError, allocate

STAGES = {
    "item_discount": 1,
    "promotion": 1,
    "store_discount": 2,
    "coupon": 2,
    "tax": 3,
    "service_charge": 4,
    "tip": 4,
    "fee": 4,
    "rounding": 4,
}
ADJUSTMENT_KINDS = set(STAGES)
ALLOCATIONS = {"proportional", "equal", "assign"}
ITEM_SPLIT_MODES = {"equal", "quantity", "weight"}


@dataclass
class EngineItem:
    id: int
    gross: int
    split_mode: str = "equal"
    # (user_id, value): value is ignored for equal, units for quantity, weight for weight
    assignments: list[tuple[str, Decimal]] = field(default_factory=list)
    voided: bool = False


@dataclass
class EngineAdjustment:
    id: int
    kind: str
    amount: int  # negative = discount
    scope: str = "bill"  # item | group | bill
    item_ids: list[int] = field(default_factory=list)
    allocation: str = "proportional"
    assignee_ids: list[str] = field(default_factory=list)
    enabled: bool = True
    position: int = 0


@dataclass
class SplitResult:
    item_net: dict[int, int]
    # item_id -> [(adjustment_id, amount)] adjustments that landed on this item
    item_adjustments: dict[int, list[tuple[int, int]]]
    # user_id -> total they owe
    person_totals: dict[str, int]
    # user_id -> [{"type": "item"|"adjustment", "id": ..., "amount": ...}]
    person_breakdown: dict[str, list[dict]]
    unassigned_items: list[int]
    unassigned_amount: int
    computed_total: int
    printed_total: int | None

    @property
    def difference(self) -> int | None:
        """Printed total minus what the lines add up to (0 = matches the receipt)."""
        return None if self.printed_total is None else self.printed_total - self.computed_total


def _people(items: list[EngineItem]) -> list[str]:
    seen: list[str] = []
    for item in items:
        for user_id, _ in item.assignments:
            if user_id not in seen:
                seen.append(user_id)
    return seen


def split_receipt(
    items: list[EngineItem],
    adjustments: list[EngineAdjustment],
    printed_total: int | None = None,
) -> SplitResult:
    active_items = [i for i in items if not i.voided]
    by_id = {i.id: i for i in active_items}
    net = {i.id: i.gross for i in active_items}
    item_adjustments: dict[int, list[tuple[int, int]]] = {i.id: [] for i in active_items}
    person_extra: dict[str, list[tuple[int, int]]] = {}

    ordered = sorted(
        (a for a in adjustments if a.enabled and a.amount != 0),
        key=lambda a: (STAGES.get(a.kind, 4), a.position, a.id),
    )
    for adj in ordered:
        if adj.allocation in ("equal", "assign") and adj.scope == "bill":
            recipients = adj.assignee_ids if adj.allocation == "assign" and adj.assignee_ids else _people(active_items)
            if not recipients:
                raise MoneyError(f"Nobody to charge '{adj.kind}' to: assign the items first")
            for user_id, part in zip(recipients, allocate(adj.amount, [1] * len(recipients))):
                person_extra.setdefault(user_id, []).append((adj.id, part))
            continue

        targets = [i for i in adj.item_ids if i in by_id] if adj.item_ids else list(by_id)
        if not targets:
            raise MoneyError(f"'{adj.kind}' doesn't apply to any item on the receipt")
        weights = [max(net[t], 0) for t in targets]
        for target, part in zip(targets, allocate(adj.amount, weights)):
            net[target] += part
            item_adjustments[target].append((adj.id, part))

    person_totals: dict[str, int] = {}
    breakdown: dict[str, list[dict]] = {}
    unassigned: list[int] = []
    unassigned_amount = 0
    for item in active_items:
        if not item.assignments:
            unassigned.append(item.id)
            unassigned_amount += net[item.id]
            continue
        if item.split_mode == "equal":
            weights = [1] * len(item.assignments)
        else:
            weights = [max(Decimal(v), Decimal(0)) for _, v in item.assignments]
        for (user_id, _), part in zip(item.assignments, allocate(net[item.id], weights)):
            person_totals[user_id] = person_totals.get(user_id, 0) + part
            breakdown.setdefault(user_id, []).append({"type": "item", "id": item.id, "amount": part})

    for user_id, extras in person_extra.items():
        for adj_id, part in extras:
            person_totals[user_id] = person_totals.get(user_id, 0) + part
            breakdown.setdefault(user_id, []).append({"type": "adjustment", "id": adj_id, "amount": part})

    computed_total = sum(i.gross for i in active_items) + sum(a.amount for a in ordered)
    assert sum(person_totals.values()) + unassigned_amount == computed_total, "split doesn't add up"

    return SplitResult(
        item_net=net,
        item_adjustments=item_adjustments,
        person_totals=person_totals,
        person_breakdown=breakdown,
        unassigned_items=unassigned,
        unassigned_amount=unassigned_amount,
        computed_total=computed_total,
        printed_total=printed_total,
    )


# --------------------------------------------------------------------------
# Manual expenses
# --------------------------------------------------------------------------

MANUAL_SPLIT_MODES = {"equal", "exact", "percent", "shares"}


def split_manual(total: int, mode: str, entries: list[tuple[str, str | None]]) -> dict[str, int]:
    """
    entries: (user_id, value). value: ignored for equal; minor units for exact;
    percent for percent (must total 100); weight for shares.
    """
    if not entries:
        raise MoneyError("Choose at least one person to split with")
    users = [u for u, _ in entries]
    if len(set(users)) != len(users):
        raise MoneyError("Each person can only appear once")
    if mode == "equal":
        parts = allocate(total, [1] * len(entries))
    elif mode == "exact":
        parts = [int(Decimal(v or 0)) for _, v in entries]
        if sum(parts) != total:
            raise MoneyError("The amounts must add up to the total")
    elif mode == "percent":
        percents = [Decimal(v or 0) for _, v in entries]
        if sum(percents) != 100:
            raise MoneyError("Percentages must add up to 100")
        parts = allocate(total, percents)
    elif mode == "shares":
        weights = [Decimal(v or 0) for _, v in entries]
        if sum(weights) <= 0:
            raise MoneyError("Shares must be more than zero")
        parts = allocate(total, weights)
    else:
        raise MoneyError(f"Unknown split mode: {mode}")
    return dict(zip(users, parts))


def validate_payers(total: int, payers: dict[str, int]) -> None:
    if not payers:
        raise MoneyError("Choose who paid")
    if any(amount < 0 for amount in payers.values()):
        raise MoneyError("Paid amounts can't be negative")
    if sum(payers.values()) != total:
        raise MoneyError("What people paid must add up to the total")
