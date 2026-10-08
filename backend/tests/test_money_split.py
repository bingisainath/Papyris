"""Pure-logic tests: money parsing, allocation, the receipt split engine, balances."""
import random
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.services.balances import net_balances, pairwise, simplify
from app.services.money import MoneyError, allocate, format_minor, to_minor
from app.services.split_engine import (
    EngineAdjustment, EngineItem, split_manual, split_receipt, validate_payers,
)

P = [f"p{i}" for i in range(1, 7)]


def everyone(*people):
    return [(p, Decimal(1)) for p in (people or P)]


# ---------------------------------------------------------------- money

@pytest.mark.parametrize("value,currency,expected", [
    ("12.30", "EUR", 1230), ("12,30", "EUR", 1230), ("1,234.50", "USD", 123450),
    ("1.234,50", "EUR", 123450), ("€ 3.00", "EUR", 300), ("-1.20", "EUR", -120),
    ("500", "JPY", 500), ("1.234", "KWD", 1234), ("0.005", "EUR", 1), (Decimal("99.99"), "INR", 9999),
])
def test_to_minor(value, currency, expected):
    assert to_minor(value, currency) == expected


def test_unknown_currency_rejected():
    with pytest.raises(MoneyError):
        to_minor("1", "XYZ")


def test_format():
    assert format_minor(164200, "INR") == "₹1,642.00"
    assert format_minor(-120, "EUR") == "-€1.20"
    assert format_minor(500, "JPY") == "¥500"


def test_allocate_is_exact_and_fair():
    assert allocate(100, [1, 1, 1]) == [34, 33, 33]
    assert allocate(-100, [1, 1, 1]) == [-34, -33, -33]
    assert allocate(10, [0, 0]) == [5, 5]
    assert allocate(1, [1, 2]) == [0, 1]
    rng = random.Random(7)
    for _ in range(500):
        total = rng.randint(-100000, 100000)
        weights = [rng.randint(0, 50) for _ in range(rng.randint(1, 8))]
        parts = allocate(total, weights)
        assert sum(parts) == total
        if sum(weights):
            for w, part in zip(weights, parts):
                assert abs(part - total * w / sum(weights)) < 1  # within one cent of exact


# ---------------------------------------------------------------- receipt split

def test_design_example_tesco_six_people():
    milk = EngineItem(1, 180, assignments=everyone("p1"))
    cheese = EngineItem(2, 400, assignments=everyone("p2", "p3"))
    rice = EngineItem(3, 1200, assignments=everyone())
    bread = EngineItem(4, 160, assignments=everyone("p4"))
    croissants = EngineItem(5, 250, assignments=everyone("p5"))
    adjustments = [
        EngineAdjustment(10, "item_discount", -120, scope="item", item_ids=[4]),       # reduced
        EngineAdjustment(11, "item_discount", -250, scope="item", item_ids=[5]),       # reduced to €0
        EngineAdjustment(12, "store_discount", -178, scope="bill", item_ids=[1, 2, 3]),  # Tesco 10%, not reduced
    ]
    result = split_receipt([milk, cheese, rice, bread, croissants], adjustments, printed_total=1642)

    assert result.item_net == {1: 162, 2: 360, 3: 1080, 4: 40, 5: 0}
    assert result.person_totals == {"p1": 342, "p2": 360, "p3": 360, "p4": 220, "p5": 180, "p6": 180}
    assert result.difference == 0
    assert result.unassigned_items == []


def test_item_discount_only_hits_its_item():
    a = EngineItem(1, 1000, assignments=everyone("p1"))
    b = EngineItem(2, 1000, assignments=everyone("p2"))
    result = split_receipt([a, b], [EngineAdjustment(1, "promotion", -300, scope="item", item_ids=[1])])
    assert result.person_totals == {"p1": 700, "p2": 1000}


def test_multibuy_spread_by_price_across_deal_items():
    meal = [EngineItem(1, 300, assignments=everyone("p1")), EngineItem(2, 100, assignments=everyone("p2"))]
    result = split_receipt(meal, [EngineAdjustment(1, "promotion", -100, scope="group", item_ids=[1, 2])])
    assert result.person_totals == {"p1": 225, "p2": 75}


def test_multibuy_per_unit_every_item_in_the_deal_costs_the_same():
    # Any 3 for 2: vitamin D 3.00 (for p2) + 2 multivitamins 7.90 (one each for p1 and p2), 3.00 off
    items = [EngineItem(1, 300, assignments=everyone("p2")),
             EngineItem(2, 790, quantity=Decimal(2), assignments=everyone("p1", "p2"))]
    deal = EngineAdjustment(1, "promotion", -300, scope="group", item_ids=[1, 2], allocation="per_unit")
    r = split_receipt(items, [deal])
    assert r.item_net == {1: 263, 2: 527}  # 7.90 for 3 units
    assert r.person_totals == {"p2": 527, "p1": 263}  # 2 of the 3 units for p2
    by_price = split_receipt(items, [EngineAdjustment(1, "promotion", -300, scope="group", item_ids=[1, 2])])
    assert by_price.person_totals == {"p2": 504, "p1": 286}


def test_cents_rounded_once_so_nobody_collects_every_leftover_cent():
    # Six cheap items shared by six people: rounding per item gave p1 an extra cent each time
    items = [EngineItem(i, price, assignments=everyone()) for i, price in enumerate([134, 80, 198, 134, 900, 61], 1)]
    r = split_receipt(items, [])
    exact = sum([134, 80, 198, 134, 900, 61]) / 6
    assert sum(r.person_totals.values()) == 1507
    assert all(abs(v - exact) < 1 for v in r.person_totals.values())
    assert max(r.person_totals.values()) - min(r.person_totals.values()) <= 1
    for person, parts in r.person_breakdown.items():  # the breakdown still adds up to each total
        assert sum(p["amount"] for p in parts) == r.person_totals[person]


def test_quantity_split():
    eggs = EngineItem(1, 600, split_mode="quantity", assignments=[("p1", Decimal(2)), ("p4", Decimal(4))])
    assert split_receipt([eggs], []).person_totals == {"p1": 200, "p4": 400}


def test_fee_split_equally_per_person_and_tip_to_someone():
    items = [EngineItem(1, 900, assignments=everyone("p1")), EngineItem(2, 100, assignments=everyone("p2"))]
    result = split_receipt(items, [
        EngineAdjustment(1, "service_charge", 100, allocation="equal"),
        EngineAdjustment(2, "tip", 50, allocation="assign", assignee_ids=["p1"]),
    ])
    assert result.person_totals == {"p1": 900 + 50 + 50, "p2": 100 + 50}


def test_tax_added_on_top_proportional():
    items = [EngineItem(1, 1000, assignments=everyone("p1")), EngineItem(2, 3000, assignments=everyone("p2"))]
    result = split_receipt(items, [EngineAdjustment(1, "tax", 400)], printed_total=4400)
    assert result.person_totals == {"p1": 1100, "p2": 3300}
    assert result.difference == 0


def test_voided_and_unassigned_items():
    items = [
        EngineItem(1, 500, assignments=everyone("p1")),
        EngineItem(2, 999, voided=True),
        EngineItem(3, 200),
    ]
    result = split_receipt(items, [], printed_total=700)
    assert result.unassigned_items == [3] and result.unassigned_amount == 200
    assert result.computed_total == 700 and result.difference == 0


def test_mismatch_reported():
    result = split_receipt([EngineItem(1, 500, assignments=everyone("p1"))], [], printed_total=537)
    assert result.difference == 37


def test_disabled_store_rule_ignored():
    items = [EngineItem(1, 1000, assignments=everyone("p1"))]
    rule = EngineAdjustment(1, "store_discount", -100, enabled=False)
    assert split_receipt(items, [rule]).person_totals == {"p1": 1000}


def test_random_receipts_always_add_up():
    rng = random.Random(42)
    for _ in range(300):
        people = P[: rng.randint(1, 6)]
        items = []
        for i in range(1, rng.randint(1, 12) + 1):
            chosen = rng.sample(people, rng.randint(1, len(people)))
            mode = rng.choice(["equal", "quantity", "weight"])
            items.append(EngineItem(i, rng.randint(0, 5000), split_mode=mode,
                                    assignments=[(p, Decimal(rng.randint(1, 5))) for p in chosen]))
        adjustments = []
        for j in range(rng.randint(0, 4)):
            kind = rng.choice(["item_discount", "store_discount", "tax", "service_charge"])
            target = rng.sample([i.id for i in items], rng.randint(1, len(items)))
            amount = -rng.randint(0, 300) if "discount" in kind else rng.randint(0, 300)
            adjustments.append(EngineAdjustment(100 + j, kind, amount, item_ids=target,
                                                allocation=rng.choice(["proportional", "equal"]) if kind == "service_charge" else "proportional"))
        result = split_receipt(items, adjustments)
        assert sum(result.person_totals.values()) + result.unassigned_amount == result.computed_total


# ---------------------------------------------------------------- manual splits & payers

def test_manual_splits():
    assert split_manual(1000, "equal", [("a", None), ("b", None), ("c", None)]) == {"a": 334, "b": 333, "c": 333}
    assert split_manual(1000, "exact", [("a", "700"), ("b", "300")]) == {"a": 700, "b": 300}
    assert split_manual(1000, "percent", [("a", "25"), ("b", "75")]) == {"a": 250, "b": 750}
    assert split_manual(900, "shares", [("a", "2"), ("b", "1")]) == {"a": 600, "b": 300}
    with pytest.raises(MoneyError):
        split_manual(1000, "exact", [("a", "700"), ("b", "200")])
    with pytest.raises(MoneyError):
        split_manual(1000, "percent", [("a", "50"), ("b", "40")])


def test_payers_must_add_up():
    validate_payers(6000, {"alice": 4000, "bob": 2000})
    with pytest.raises(MoneyError):
        validate_payers(6000, {"alice": 4000})


# ---------------------------------------------------------------- balances

def expense(currency, payers, shares):
    return SimpleNamespace(currency=currency, payers=list(payers.items()), shares=list(shares.items()))


def test_two_payers_dinner_example():
    # €60 dinner: Alice paid 40, Bob 20, split equally -> Carol owes Alice 20
    dinner = expense("EUR", {"alice": 4000, "bob": 2000}, {"alice": 2000, "bob": 2000, "carol": 2000})
    nets = net_balances([dinner], [])
    assert nets == {"EUR": {"alice": 2000, "carol": -2000}}
    assert [(d.from_user, d.to_user, d.amount) for d in simplify(nets)] == [("carol", "alice", 2000)]


def test_simplify_chain():
    # A owes B 10, B owes C 10 -> A pays C 10
    e1 = expense("EUR", {"b": 1000}, {"a": 1000})
    e2 = expense("EUR", {"c": 1000}, {"b": 1000})
    debts = simplify(net_balances([e1, e2], []))
    assert [(d.from_user, d.to_user, d.amount) for d in debts] == [("a", "c", 1000)]
    raw = pairwise([e1, e2], [])
    assert sorted((d.from_user, d.to_user, d.amount) for d in raw) == [("a", "b", 1000), ("b", "c", 1000)]


def test_settlement_clears_debt_and_currencies_stay_separate():
    e1 = expense("EUR", {"a": 1000}, {"b": 1000})
    e2 = expense("INR", {"b": 50000}, {"a": 50000})
    paid = SimpleNamespace(currency="EUR", from_user="b", to_user="a", amount=1000)
    nets = net_balances([e1, e2], [paid])
    assert nets == {"EUR": {}, "INR": {"b": 50000, "a": -50000}}
