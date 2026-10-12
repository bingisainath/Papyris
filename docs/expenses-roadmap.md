# Expenses: ideas for future enhancements

Collected October 2026 by comparing Papyris with Splitwise (free and Pro). Each idea says what it would
look like in Papyris and roughly how much work it is. Status: **Done**, **Building** (in progress) or
**Idea**.

## What Papyris already has

| Feature | In Splitwise | In Papyris |
|---|---|---|
| Groups and one-to-one chats with expenses | Free | Yes: every chat has expenses |
| Equal, exact, percentage and share splits | Free | Yes |
| Several currencies in one group | Free | Yes (balances kept per currency) |
| Simplify debts | Free | Yes (per chat setting) |
| Settle up / record a payment | Free | Yes |
| Receipt scanning, split line by line | Pro | Yes, with AI, discounts and deals handled, manual editing |
| Spending by category, member and month | Pro (charts) | Yes (Summary tab) |
| Expense history and filters | Pro (search) | Yes (History tab: date, category, member, type) |
| Export | Free (CSV) | Yes (Excel: summary, every item and who pays for it, discounts) |
| Edit and delete with history | Free | Yes (with change history, lock, restore) |
| End-to-end encrypted chat around the money | No | Yes |

## Ideas

### 1. Totals across all chats ("friends" view): **Building**
The Expenses home shows "Overall you're owed €X / you owe €Y", plus one line per person summed across
every group and direct chat. Tapping a person shows which chats it comes from. Splitwise is built around
this view. *Effort: small.*

### 2. Payment reminders: **Building**
A "Remind" button next to someone who owes you sends them a push notification ("Sai reminded you
about €16.02 in Donegal"). It's limited to once a day per person per chat, so it can't be used to
spam. *Effort: small.*

### 3. Payment links: **Building**
People add their payment details once in their profile (Revolut, PayPal.me, UPI). Someone who owes
them then sees a "Pay" button that opens that app with the amount filled in, and records the payment
afterwards. Papyris never moves money itself. *Effort: small to medium.*

### 4. Recurring expenses: Idea
For rent, bills and subscriptions: an expense repeats weekly, monthly or yearly. The server adds it on
the day, posts a card in the chat, and the next one can be skipped or ended. Splitwise has this for
free. *Effort: medium (needs a scheduled job; the worker could run it).*

### 5. Default split per group: Idea
A group remembers a usual split (for example "Rent: Sai 40%, Ruthwik 60%", or "everyone except
Sudesh") and new expenses start from it. Splitwise Pro has this. *Effort: medium.*

### 6. "Adjustment" split: Idea
Split equally, then add or take off a fixed amount for one person ("+€5 for Kesh, he had extra").
A fifth split mode next to equal, exact, % and shares. *Effort: small.*

### 7. Comments, notes and photos on an expense: Idea
A short discussion inside each expense ("did this include the tip?"), plus a note field and extra
photos (a bill, a ticket). Comments notify the people in the expense. *Effort: medium.*

### 8. Currency conversion: Idea
Show all balances in one currency at today's rate (original amounts kept), and settle in a different
currency than the expense. Splitwise Pro has this. *Effort: medium (needs a daily exchange-rate
source such as the ECB reference rates).*

### 9. Search: Idea
Find expenses by description, amount or item ("Tesco", "milk") across a chat or all chats. Splitwise
Pro has this. *Effort: small (description); medium (receipt items).*

### 10. Trip mode: Idea
Mark a group as a trip with start and end dates. The Summary shows cost per person per day and a
"trip finished, settle up" prompt at the end. *Effort: medium.*

### 11. Charts: Idea
A pie chart for categories and a line chart for spending over time, on top of the current bars.
*Effort: small.*

### 12. Activity feed: Idea
One feed of everything across all chats: added, edited, deleted, settled, reminded. *Effort: small
(the expense history already records it per expense).*

### 13. Budgets and spending alerts: Idea
A monthly budget per group or category ("Groceries €300"), with a notification at 80% and 100%.
*Effort: medium.*

### 14. Import card transactions: Idea
Splitwise Pro imports card transactions in the US. For Europe that would need an open-banking
provider (PSD2). Probably not worth it early on. *Effort: large.*

### 15. Offline adding: Idea
Add expenses without a connection and send them when back online. Splitwise has this for free.
*Effort: medium (the phone would queue them like unsent messages).*

## Suggested order
1. Ideas 1, 2 and 3 (building now): faster settling up.
2. Ideas 4 and 5: recurring bills and fixed splits, which matter most for flats and couples.
3. Ideas 6, 9 and 11: small and visible.
4. Then 7, 8, 10, 12, 13; and 14 and 15 only if people ask for them.

## Sources
- [Android Central: Splitwise for group trips in 2026](https://androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026)
- [Splitwise pricing 2026: what Pro costs and what stays free](https://getfinny.app/blog/splitwise-pricing-2026)
- [Product study: Splitwise](https://thinkingcrayfish.substack.com/p/product-study-splitwise)
