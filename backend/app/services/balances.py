# backend/app/services/balances.py

"""
Who owes whom, per currency, from expenses (payers and shares) and settlements.
Balances are always calculated, never stored, so they can't drift out of sync.
"""

from collections import defaultdict
from dataclasses import dataclass

from app.services.money import allocate


@dataclass
class Debt:
    currency: str
    from_user: str
    to_user: str
    amount: int


def net_balances(expenses: list, settlements: list) -> dict[str, dict[str, int]]:
    """
    currency -> user -> net (positive = is owed money, negative = owes money).
    expenses: objects with .currency, .payers [(user_id, amount)], .shares [(user_id, amount)]
    settlements: objects with .currency, .from_user, .to_user, .amount
    """
    nets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for expense in expenses:
        for user_id, amount in expense.payers:
            nets[expense.currency][user_id] += amount
        for user_id, amount in expense.shares:
            nets[expense.currency][user_id] -= amount
    for s in settlements:
        nets[s.currency][s.from_user] += s.amount
        nets[s.currency][s.to_user] -= s.amount
    return {cur: {u: v for u, v in users.items() if v != 0} for cur, users in nets.items()}


def simplify(nets: dict[str, dict[str, int]]) -> list[Debt]:
    """
    Fewest payments that settle everything: repeatedly match the person who owes most
    with the person owed most. (A→B→C becomes A→C.)
    """
    debts: list[Debt] = []
    for currency, users in sorted(nets.items()):
        debtors = sorted(((-v, u) for u, v in users.items() if v < 0), key=lambda x: (-x[0], x[1]))
        creditors = sorted(((v, u) for u, v in users.items() if v > 0), key=lambda x: (-x[0], x[1]))
        i = j = 0
        debtors = [list(d) for d in debtors]
        creditors = [list(c) for c in creditors]
        while i < len(debtors) and j < len(creditors):
            pay = min(debtors[i][0], creditors[j][0])
            debts.append(Debt(currency, debtors[i][1], creditors[j][1], pay))
            debtors[i][0] -= pay
            creditors[j][0] -= pay
            if debtors[i][0] == 0:
                i += 1
            if creditors[j][0] == 0:
                j += 1
    return debts


def pairwise(expenses: list, settlements: list) -> list[Debt]:
    """
    Without simplification: each person owes the people who actually paid for their
    share (split by how much each payer paid), netted per pair.
    """
    owed: dict[tuple[str, str, str], int] = defaultdict(int)  # (currency, debtor, creditor) -> amount
    for expense in expenses:
        paid_total = sum(a for _, a in expense.payers)
        if paid_total <= 0:
            continue
        for debtor, share in expense.shares:
            parts = allocate(share, [a for _, a in expense.payers])
            for (creditor, _), part in zip(expense.payers, parts):
                if creditor != debtor and part:
                    owed[(expense.currency, debtor, creditor)] += part
    for s in settlements:
        owed[(s.currency, s.from_user, s.to_user)] -= s.amount

    debts: list[Debt] = []
    seen: set[tuple[str, str, str]] = set()
    for (currency, a, b), amount in sorted(owed.items()):
        if (currency, a, b) in seen:
            continue
        seen.add((currency, a, b))
        seen.add((currency, b, a))
        net = amount - owed.get((currency, b, a), 0)
        if net > 0:
            debts.append(Debt(currency, a, b, net))
        elif net < 0:
            debts.append(Debt(currency, b, a, -net))
    return debts
