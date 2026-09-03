# Product Requirements Document — Crypto TradePro (INR Edition)

**Status:** Draft v2
**Owner:** Ail
**Platform:** Mobile-first web app (PWA-ready)
**Exchange:** Binance (Spot + Futures)

**Changelog (v1 → v2):**
- Added a critical balance-sufficiency check to the Bracket Order sheet (5.2) — fixes an observed bug where a Paper-mode Buy executed despite insufficient wallet balance.
- Changed Paper mode's "Add Mock Funds" into a full balance edit (5.5) — the mock wallet balance can now be set to any value, not just topped up.
- Added Portfolio Summary & Daily P&L (5.8) — total portfolio value at the top of the Portfolio screen, plus today's realized profit, loss, and net.
- Added Trade History (5.9) — a closed-trades log with a tap-to-expand detail view showing entry/exit price, fees, tax, and net P&L per trade.
- Added the missing Section 6 header ("Security") and moved Section 9 (Production Hardening) to its correct position after Section 8 — a document-structure fix, not a content change.

---

## 1. Overview

Crypto TradePro is a **manual** crypto options/futures trading dashboard. The user
watches a live option chain, gets AI-generated trade ideas, and taps a button
to execute — the AI never places an order on its own. The app runs on real
Binance data end-to-end but is priced entirely in INR, and ships with a Paper
Trading mode so the full flow (chain → AI signal → bracket order → P&L) can be
proven safe before any real money is at risk.

### Explicit non-goals
- **No autonomous execution.** The AI Advisor may only *suggest* — it must never
  call an order-placement endpoint itself. Every Buy/Sell is a human tap.
- **No multi-exchange abstraction in v1.** Deribit or other options-native
  exchanges are out of scope for this version; the architecture should not be
  blocked from adding them later, but nothing should be built for them now.

---

## 2. Users & Platform

- Single user (personal trading tool), optimized for one-handed phone use.
- Bottom navigation: **Home (Option Chain)** · **Portfolio** · **AI Advisor** · **Settings**.
- Professional dark-mode theme, large tap targets, no unnecessary page reloads —
  everything updates live via WebSocket.

---

## 3. Currency Handling

Binance returns everything in USD/USDT. The **entire UI** — option chain
premiums, chart axes, P&L, wallet balance — must render in INR only.

- Fetch a live USD→INR rate (fallback to a configurable static rate if the
  rate API is unreachable).
- A single `useCurrencyConverter` hook multiplies incoming WebSocket/REST data
  by this rate before it reaches any component. Components never see raw USD.
- When the user places a **Live** order, the INR amount they typed must be
  converted back to USDT before it's sent to Binance — this conversion should
  happen in exactly one place in the code (the order-submission service), not
  duplicated across components, to avoid two different rates being used by
  mistake.

---

## 4. Real-Time Price Updates — Critical Requirement

**Observed problem in the current build:** the price on screen freezes at one
value and only jumps after a few seconds, instead of moving continuously.
This is treated as a launch blocker, not a nice-to-have — a trading dashboard
where the visible price lags the real market is actively dangerous, since the
user is making Buy/Sell decisions off a stale number.

**Required behavior:** every price shown on screen (option chain LTP, chart,
ATM marker, open-position P&L) must update the instant new data arrives on
the WebSocket — sub-second, not "every few seconds."

**Likely causes to check, in order:**
1. **Polling instead of streaming.** If any price on the page is being
   fetched with a `setInterval` + REST call instead of read from the open
   WebSocket, that's the stall — REST polling is inherently a few seconds
   behind. Every live price on the page must come from the WebSocket
   subscription, not a timer.
2. **React re-render not triggered by new data.** If the WebSocket message
   handler updates a plain variable instead of state (or updates state that
   nothing on screen is subscribed to), the DOM won't repaint even though
   correct data arrived. The incoming tick must go through `setState` /
   Zustand's store update on every message, not just on some of them.
3. **Throttling/debouncing set too aggressively.** If updates are intentionally
   batched (e.g. "update UI once per second") to reduce re-renders, that
   batching interval is itself the multi-second delay the user is seeing —
   this needs to be removed or reduced, not treated as expected behavior.
4. **A single stale WebSocket connection.** If the socket silently disconnects
   (network blip, tab backgrounded, exchange-side timeout) and isn't
   auto-reconnected, the UI will keep showing the last price it received
   forever, which looks exactly like "it stops and then jumps" once it does
   reconnect. There must be an automatic reconnect-with-backoff on disconnect,
   and ideally a small visual indicator (e.g. a dot) showing live-connected
   vs reconnecting, so a frozen price is never mistaken for a real quote.

Whichever of these is the actual cause, it must be fixed before this app is
trusted with either Paper or Live money — a delayed price defeats the purpose
of the 5%-target / stop-loss bracket logic in Section 5.2 (and the fee/tax
math layered on top of it in 5.3), since none of that math is meaningful
against a price that's actually current.

## 5. Core Features

### 5.1 Live Option Chain (Home)
- Classic layout: Calls (left) · Strike price (center) · Puts (right).
- Per strike: LTP (INR), Volume, Change %.
- The strike nearest the current spot price is visually marked **ATM**.
- `Buy CE` / `Buy PE` button on every row → opens the Bracket Order sheet (5.2).
- Tapping any row (not just Buy) opens that strike's live candlestick chart
  (TradingView Lightweight Charts), so the user can inspect before buying.

### 5.2 Smart Bracket Order (Buy Sheet)
A bottom-sheet modal on tap of Buy CE/PE:

| Field | Default | Notes |
|---|---|---|
| Entry price | Market | Limit optional |
| Quantity / lot size | — | required |
| Target % | 5% | editable |
| Stop-Loss % | 20% | editable |

On confirm: `sell_target = entry × (1 + target%)`, `sell_stop = entry × (1 − sl%)`,
shown in INR before the user confirms.

**Execution mode toggle** (per the user's clarification with the AI in the
build conversation): a setting for **Confirm before send** vs **Instant
execute**, so normal trading stays safe and fast-moving setups can skip the
extra tap.

**Balance Sufficiency Check — Critical Requirement**

**Observed problem in the current build:** in Paper mode, a Buy has gone
through even when the required amount exceeded the available wallet balance
— e.g. a mock wallet holding ₹500 was still able to "buy" an asset whose
entry cost was higher than ₹500, instead of the Buy being rejected. This is
a launch blocker of the same kind as Section 4's stale-price issue: the
whole point of Paper mode (Section 1) is that it proves the flow is safe
before real money is at risk, and a real Binance account would reject this
exact order for insufficient funds — Paper mode silently allowing it teaches
the user the app works when it wouldn't.

**Required behavior:**
- Before Confirm is even tappable, the required cost — `entry price ×
  quantity`, plus the estimated entry fee from 5.3 — must be checked against
  the currently available balance (the mock wallet in Paper mode per 5.5, the
  last-fetched real wallet balance in Live mode).
- If the required cost exceeds the available balance, the Confirm button is
  disabled and an explicit **"Insufficient balance"** message is shown with
  the shortfall in INR (e.g. "Insufficient balance — need ₹612, available
  ₹500, short by ₹112") — not a silent no-op, and not a generic error only
  after the fact.
- The Quantity field should reflect this live as the user types (e.g. either
  cap the max quantity to what the current balance affords at the live
  price, or surface the insufficient-balance state immediately), rather than
  only checking once Confirm is tapped.
- This check must be re-enforced server-side in the order-execution service
  (5.4) / mock engine (5.5), not only in the frontend — a stale frontend
  state must not be able to make either engine execute a Buy it shouldn't,
  following the same never-trust-the-client posture Section 6 already
  requires for API credentials.
- The check applies identically regardless of entry point — from the Option
  Chain (5.1) directly, or via the AI Advisor's deep link (5.6) — per 5.6's
  requirement that the Advisor path lands on this same confirm screen, it is
  subject to this same balance check, not a second route that bypasses it.

### 5.3 Fees & Tax Disclosure — Required on Every Order

**Problem this closes:** the Bracket Order sheet in 5.2 currently shows
target/stop-loss in INR but not what Binance actually deducts, or what India's
crypto tax rules would take on top of that. Without this, the P&L a user sees
on screen is not the P&L they actually keep — the number is wrong the moment
a real trade fills, and it's wrong in Paper mode too if Paper is supposed to
be a faithful rehearsal of Live (per 5.5). This section is not optional
polish; it's a correctness requirement of the same kind as Section 4
(a stale price is dangerous; an undisclosed cost is misleading in the same
way — the user is deciding whether to tap Buy off a number that doesn't
match reality).

**Two separate categories — do not conflate them:**

**(a) Exchange fee / brokerage** — this is a fact, computable exactly, and
must be shown in numeric terms:
- Binance charges a **maker/taker trading fee** (percentage-based, varies by
  Spot vs Futures, VIP tier, and whether BNB fee-discount is enabled on the
  account). `ccxt` returns the applicable fee rate/structure for the account
  via its market/fee endpoints — **do not hardcode a fee percentage**
  (e.g. "0.1%") in the frontend or backend, since the actual rate depends on
  account tier and can change; fetch it live the same way price data is
  fetched live per Section 4, and cache it with a short TTL rather than
  fetching per keystroke.
- Fee applies on **both legs** of a bracket order: the entry Buy, and
  whichever exit leg fills (target sell *or* stop-loss sell) — Futures
  additionally applies fee on `reduce-only` closes, same as any other fill.
  A "5% target" is not actually a 5% net gain once entry-fee + exit-fee are
  subtracted; the Bracket Order sheet (5.2) must show **both** the gross
  target/stop values (as it does today) **and** a fee-adjusted net figure,
  so the user isn't discovering the gap only after the position closes.
- Fee amount in INR = fee-in-USDT × the same live USD→INR rate from Section 3
  — reuse the existing `useCurrencyConverter` hook rather than a second
  conversion path, for the identical reason Section 3 already gives for
  keeping conversion in one place.

**(b) India crypto tax — informational estimate, explicitly not tax advice:**
- India currently taxes gains from transfer of virtual digital assets (VDAs)
  at a **flat 30%** on profit (no loss offset against other income, no
  deduction other than cost of acquisition), plus **1% TDS** deducted at
  source on the transaction value under Section 194S, subject to the
  applicable per-transaction/per-year threshold. These rules can change in
  any Union Budget — **the app must not hardcode "30%" and "1%" as if
  permanent**; store them as configurable values (e.g. a small `tax_config`
  the user or a future update can edit) with the rates visible in Settings so
  they're auditable, not buried in code.
- On the Bracket Order confirm screen and on the Portfolio P&L view, show an
  **estimated** post-tax figure alongside the actual (pre-tax) P&L — clearly
  labeled, e.g. "Est. after 30% VDA tax + 1% TDS — **not tax advice**". Do not
  present this as the exact amount the user will owe: TDS timing, exchange
  vs wallet transfer nuances, and offset rules are decided by India's tax
  authority and can depend on the user's full-year trading activity, which
  this single-trade estimate cannot know.
- This label ("not tax advice" / "estimate only") must appear **every time**
  the figure is shown, not just once in Settings — a one-time disclaimer the
  user scrolls past is not a disclaimer at the point of decision.
- **Paper mode must show the identical fee + tax estimate math as Live mode**
  (per the "Mock" labeling rule in 5.5) — the whole point of Paper mode per
  Section 1 is that the user can trust the numbers translate 1:1 to Live, and
  a Paper trade that hides fees/tax while Live doesn't would make Paper
  mode's rehearsal actively misleading rather than safe.

**UI requirement:** on the Bracket Order sheet (5.2), extend the confirm
screen to show, before the user taps confirm:

| Row | Example |
|---|---|
| Entry (gross) | ₹4,500 |
| Est. entry fee | −₹4.50 |
| Target (gross) | ₹4,725 |
| Est. exit fee at target | −₹4.73 |
| **Net gain if target hits** | **₹215.77** |
| Est. tax on net gain (30% + 1% TDS, editable in Settings) | −₹66.89 |
| **Est. take-home if target hits** | **₹148.88** |

The same breakdown applies symmetrically to the stop-loss leg (showing the
net loss after fees, since fees are owed even on a losing trade — this is
often the detail users forget). Numbers above are illustrative only; actual
fee/tax config values live in Settings per the point above, not hardcoded
into the template.

### 5.4 Order Execution Logic — Binance-specific (important)

The exchange does not treat "buy + target + stop-loss" as one atomic action
the way a simple prompt might imply. Spot and Futures also work differently,
and the backend must handle both correctly:

**Binance Spot:**
1. Place the market Buy. Wait for the fill confirmation and the *exact* filled
   quantity/price (do not assume the requested price = fill price).
2. Only after the fill, place a native **OCO** order (`target` limit sell +
   `stop-loss` stop-limit sell) using the *actual* filled quantity. Binance's
   own matching engine then auto-cancels whichever leg doesn't fill — this
   part genuinely is automatic once the OCO is live.
3. **Gap to handle:** the Buy and the OCO placement are two separate API
   calls, not one. If the backend crashes or errors between step 1 and step 2,
   the position is bought but **unprotected** — no stop-loss is resting on the
   exchange. The backend must treat "fill confirmed but OCO not yet placed" as
   an alerting condition (retry the OCO placement; surface a warning in the
   UI if it can't).

**Binance Futures:**
- Futures has no single OCO order type. The backend places two independent
  `reduce-only` conditional orders — Take-Profit and Stop-Loss — against the
  open position.
- Nothing on Binance's side auto-cancels the sibling order. The **backend is
  responsible** for listening to the account's user-data WebSocket stream
  (order-fill events) and cancelling the other order itself the moment one
  fills. Do this via the stream, not by polling — polling introduces exactly
  the kind of delay this feature exists to avoid.
- On backend restart, reconcile open positions against open orders before
  resuming — a crash mid-trade can otherwise leave both TP and SL sitting
  live at once, or neither.

This logic belongs in the backend order service, isolated from the UI, so it
can be tested independently of the chain/chart components.

### 5.5 Paper Trading vs. Live Trading
- Global toggle in the header: **Paper** / **Live**.
- **Paper mode:**
  - **Edit Mock Balance** — the user can set the mock wallet balance to any
    INR amount at will, increasing or decreasing it (not just topping it up).
    Entering a new value overwrites the current balance rather than adding to
    it, so this is a distinct action from a top-up — label it as a balance
    override (e.g. a "Set Balance" / "Reset Balance" control), not "Add
    Funds." Since changing the balance mid-trade has no equivalent in the
    Live mode this is meant to rehearse (Section 1), disable the edit — or
    show an explicit warning — while any Paper position is open, rather than
    letting an edit silently change the denominator an open position's P&L
    is being tracked against.
  - Every Buy checks against this balance immediately after it's edited — the
    balance-sufficiency check in 5.2 must always read the current balance,
    never a value cached from before the edit.
  - Orders never reach Binance. A mock execution engine watches the same live
    WebSocket prices and simulates fills, targets, and stop-losses against the
    mock wallet, using the identical bracket-order math as Live mode (so
    testing the UI actually validates the real logic) — this includes the
    fee and tax-estimate math from Section 5.3, applied against the same
    live-fetched fee rate and configurable tax rates, not skipped or zeroed
    out for convenience, **and it includes the balance-sufficiency check from
    5.2**: this is the engine where that check was found missing in the
    current build, so a Buy request whose cost exceeds the mock balance must
    be rejected the same way it would be in Live mode, not silently filled.
  - Mock P&L and mock positions are clearly labeled as such everywhere they
    appear (color/badge), so Paper and Live can never be visually confused.
- **Live mode:** orders route through `ccxt` to the real Binance account.
- Recommended flow: run Paper mode until behavior looks correct and stable,
  then switch to Live with real funds.

### 5.6 AI Advisor
- Dedicated tab / floating panel.
- Backend periodically pulls option-chain data (price, volume, liquidity) and
  sends it to an LLM, which returns a structured recommendation (e.g. "BTC
  96000 PE showing strong momentum near ₹205").
- Each recommendation renders as a chat message with an **Open Chart** button
  that deep-links to that exact strike's live chart.
- The Advisor **only recommends**. It has no access to order-placement
  functions — this should be enforced at the API layer (the LLM-facing
  service should not even have the execution function available to call), not
  just left as a UI convention.
- If a recommendation includes a suggested target/stop, tapping through to
  the chart and then to the Bracket Order sheet should land the user on the
  same 5.3 fee/tax-adjusted confirm screen as any other order — the Advisor
  path must not become a second, cost-blind route to placing a trade.

### 5.7 Portfolio / Account
- Active positions: instrument, avg. buy price, live price, live unrealized
  P&L (INR, green/red).
- Wallet balance (converted to INR).
- One-tap **Close** per position, and a **Close All** for emergencies.
- Unrealized P&L shown here is **gross** (matches the live market value, as
  is standard for an open-position view); realized P&L, once a position is
  closed, must switch to showing the **net-of-fees** figure from 5.3 so the
  number a user sees after a trade closes matches what actually happened to
  their balance, not the gross figure they were tracking while it was open.

### 5.8 Portfolio Summary & Daily P&L

**Problem this closes:** today the Portfolio screen (5.7) only shows active
positions and the raw wallet balance — there is no single number for "how
much am I worth right now" and no way to tell, at a glance, how today's
trading actually went. A user currently has to mentally add up individual
position P&Ls to answer either question, which for a trading dashboard whose
whole purpose is fast decision-making is a real gap of the same kind Section
4 and 5.3 close.

**Required behavior:**
- **Total Portfolio Value**, shown prominently at the top of the Portfolio
  screen, above the active-positions list from 5.7: `wallet balance
  (uninvested) + current market value of all open positions`, updating live
  from the same WebSocket prices that drive 5.1/5.7 (per Section 4, not a
  periodic recalculation).
- Directly beneath it, a compact **Today's P&L** block, scoped to the current
  calendar day (resets at local midnight) and covering only trades that
  closed today:
  - **Today's realized profit** — sum of net (post-fee, per 5.3) gains across
    all trades closed in profit today.
  - **Today's realized loss** — sum of net losses across all trades closed at
    a loss today, shown as a positive magnitude labeled "Loss" (not a
    confusing double-negative) so both figures are easy to read side by side.
  - **Today's net P&L** — profit minus loss, the actual change to the wallet
    balance from today's closed trades, color-coded green/red.
  - This is realized-only, distinct from the open positions' unrealized P&L
    already shown per-position in 5.7 — the two must not be added together
    into one misleading figure, since an open position's paper gain isn't
    money in the wallet yet.
- Paper and Live modes each track and show their own independent Total
  Portfolio Value and Today's P&L — switching the mode toggle (5.5) must not
  mix a Paper day's numbers into a Live summary or vice versa.

### 5.9 Trade History

**Problem this closes:** closed trades currently have nowhere to be reviewed
after the fact — 5.7's active-positions list drops a position once it
closes, and 5.3's fee/tax breakdown is only ever shown live on the confirm
screen at the moment of the trade, not afterward. A user has no way to look
back and answer "what did I actually pay to get in, what did I sell it for,
and what did fees/tax take out of that" for a specific past trade.

**Required behavior:**
- A **History** list on the Portfolio screen (below the active positions
  from 5.7 and the summary from 5.8), showing every closed trade — Paper and
  Live tracked separately per 5.5 — in reverse-chronological order, each row
  showing at minimum: instrument, closed date/time, and net P&L (green/red).
- Tapping a row opens a detail view for that specific trade, showing:

  | Field | Example |
  |---|---|
  | Entry price (gross) | ₹4,500 |
  | Exit price (gross) | ₹4,725 |
  | Quantity | 1.5 |
  | Entry fee | −₹4.50 |
  | Exit fee | −₹4.73 |
  | Tax withheld (per 5.3's config) | −₹66.89 |
  | **Net P&L** | **+₹148.88** |

  This reuses the identical fee/tax fields and figures already computed at
  trade-close time per 5.3 and 5.7's net-once-closed rule — the detail view
  must display the values actually recorded when the trade closed, not
  recompute them against current rates, since fee/tax rates can change and a
  historical trade's real cost shouldn't drift after the fact.
- Each closed trade's full breakdown (entry/exit price, quantity, fee, tax,
  net P&L) must be persisted at the moment the position closes, not derived
  later — this is a new data-storage requirement, since nothing currently
  described in the PRD keeps a record once a position leaves the active list.

---

## 6. Security

- API Key and Secret are **never** entered in the frontend and never pasted
  into any AI chat. They live only in a server-side `.env` file, read by the
  backend order service.
- Withdrawal permission must **never** be enabled on the Binance API key used
  by this app — Reading + Trading only.
- All signed requests to Binance happen server-side; the frontend only ever
  talks to this app's own backend.

---

## 7. Technical Architecture

- **Frontend:** Next.js (React), TypeScript, Tailwind CSS, Zustand for wallet/mode state.
- **Backend:** Node.js via Next.js API routes.
- **Exchange integration:** `ccxt` (Binance Spot + Futures).
- **Real-time data:** WebSocket subscriptions for chain prices and chart candles; user-data stream for order/fill events (see 5.4).
- **Charts:** TradingView Lightweight Charts.

---

## 8. Instructions for the Developer / Coding Assistant

1. Acknowledge this PRD and ask about anything that's ambiguous before writing code.
2. Propose the folder structure first (frontend routes/components, backend
   API routes, order-execution service module, currency-conversion utility,
   and a **fee/tax config module** per Section 5.3 — this should be a single
   source of truth both Live and Paper read from, per the parity requirement
   in 5.5, not duplicated logic in two places).
3. List the terminal commands to install all dependencies (`ccxt`, `lightweight-charts`, `zustand`, etc.).
4. Build in this order: (a) currency-conversion hook, (b) Option Chain UI on
   mock/static data, (c) Bracket Order sheet UI including the fee/tax
   breakdown rows from 5.3, (d) backend order-execution service with the
   Spot/Futures logic in Section 5.4 and the live fee-rate fetch + configurable
   tax-rate logic from 5.3, (e) Paper Trading engine reusing the identical
   bracket-order math **and** the identical fee/tax module, (f) WebSocket
   wiring for live prices, (g) AI Advisor panel, (h) Portfolio screen with
   the gross-while-open / net-once-closed P&L distinction from 5.7, (i) the
   portfolio-summary/today's-P&L header from 5.8, (j) the trade-history list
   and detail view from 5.9, including the persisted-at-close data model it
   depends on.
5. Keep the exchange-specific code (Section 5.4) and the fee/tax module
   (Section 5.3) each isolated behind their own single service so both can be
   unit-tested without a live Binance connection — the fee/tax module in
   particular should be testable by feeding it fixed rates, since real rates
   depend on account tier and current law.
6. Fix the real-time price staleness described in Section 4 as an early
   priority — every other feature, including the fee/tax math in 5.3, depends
   on the displayed price actually being current.
7. Do not hardcode the Binance fee percentage or the India tax percentages
   (30% / 1%) anywhere in frontend or backend code. Both must be
   read from the fee/tax config module described in point 2, so a rate
   change (account tier upgrade, BNB discount toggle, or a future Budget
   changing the 30%/1% figures) is a config edit, not a code change.
8. The balance-sufficiency check from 5.2 is worth writing tests for before
   anything else in that module, since it was the specific bug reported in
   production. Cover at minimum: cost exactly equal to balance (should pass),
   cost one paisa over balance (should reject), zero balance (should reject
   any nonzero Buy), and a balance edited mid-session via 5.5's Edit Mock
   Balance being reflected immediately in the very next check.

---

## 9. Production Hardening — Failure Modes That Must Be Handled

Sections 1–8 describe correct behavior under normal conditions. This section
covers what must happen when things go wrong — network blips, double taps,
rate limits, stale data — because a trading app that only works on the happy
path is not safe to use with real money. Each item below is a **required**
behavior, not a stretch goal.

### 9.1 WebSocket Reconnect — State Resync, Not Just Reconnect

Section 4 requires auto-reconnect-with-backoff when the price WebSocket
drops. That's necessary but not sufficient: **reconnecting the socket does
not by itself recover what was missed while it was down.**

- On reconnect, before resuming normal price updates, the client must
  **re-fetch current state via REST** (open positions, open orders, wallet
  balance) rather than assuming the last-known state is still accurate — an
  order could have filled, or a stop-loss could have triggered, during the
  gap.
- The user-data stream (order/fill events, referenced in 5.4) needs the same
  treatment: on reconnect, the backend must **reconcile** against Binance's
  actual open-orders list, not just resume listening for new events — an
  event that fired during the disconnect window is otherwise silently lost,
  which for an OCO/TP-SL pair (5.4) means a position could sit unprotected
  without anyone knowing.
- While reconnecting, the connection-status indicator from Section 4 must
  visually distinguish "reconnecting" from "reconnected but resyncing" from
  "fully live" — a user should not be able to place a new order while the
  app is still catching up on state it may have missed.

### 9.2 Binance Rate Limits

`ccxt` calls (fee-rate fetch in 5.3, order placement in 5.4, reconciliation
in 9.1) are all subject to Binance's request-weight rate limits. Hitting
these is not a hypothetical — it will happen if reconnect-triggered
reconciliation (9.1) fires repeatedly during a flaky connection, or if the
fee-rate cache TTL from 5.3 is set too short.

- All Binance REST calls must respect `ccxt`'s built-in rate-limit handling
  (`enableRateLimit: true`) rather than firing requests as fast as the code
  allows.
- Order-placement calls specifically (Buy, OCO, TP/SL) must **never** be
  silently dropped or retried into a queue behind unrelated calls (e.g. a
  price-cache refresh) — if a rate limit is hit on an order-placement call,
  that is surfaced to the user immediately as "order not confirmed, retrying"
  rather than queued invisibly, because a silently-delayed Buy is the same
  class of danger as the stale-price problem in Section 4.
- Reconciliation (9.1) and fee-rate refresh (5.3) should back off and batch
  rather than hammering the API every time the socket blips.

### 9.3 Duplicate-Submit Protection

The Bracket Order sheet (5.2) has no stated protection against a user
double-tapping Confirm — a real risk on a touch UI, especially under the
**Instant execute** toggle from 5.2 where there's no confirmation step to
naturally absorb a double-tap.

- The Confirm button must disable itself (and show a loading state) the
  instant it's tapped, before the network call resolves, and stay disabled
  until either a response or a timeout is received.
- The backend order-execution service (5.4) must additionally treat this as
  a server-side concern, not just a frontend one — a client-generated
  idempotency key per order submission, so that even a retried or
  double-fired request from a flaky mobile connection cannot result in two
  live Buys from one tap.

### 9.4 Data Staleness Guards

Sections 3 and 5.3 both depend on fetched values (USD→INR rate, Binance fee
rate) that are cached rather than fetched per-action. Caching is correct for
performance, but the PRD must define **how stale is too stale**:

- The USD→INR rate (Section 3) must carry a fetch timestamp; if the cached
  rate is older than a defined threshold (e.g. a few minutes) at the moment
  a **Live** order is being confirmed, the app must refresh it before
  showing the final confirm screen rather than confirming against a
  possibly-outdated conversion — this matters most at the exact moment
  described in Section 3's "converted back to USDT before it's sent," since
  that's the one place a stale rate has real financial consequence.
- The same staleness check applies to the cached fee rate from 5.3: an order
  confirm screen must not display fee/tax math computed from a fee-rate
  fetch that predates a recent tier change on the account.
- The static-rate fallback in Section 3 (used when the rate API is
  unreachable) must be visually flagged on screen as a fallback (not shown
  identically to a live rate), so the user knows if they're trading against
  an approximation.

### 9.5 Explicit Error & Empty States

No section currently specifies what the UI shows when a call fails outright
(not just slow — actually errors). For a trading app, a silent failure is
worse than a visible one, since the user may assume "no error shown" means
"order went through."

- Every action that hits the network — order placement, fee-rate fetch,
  chain-data load, Advisor request, Close/Close All — must have a defined
  failure state shown directly in the UI at the point of action, not just
  logged to a console or surfaced only in Settings.
- **Close All** (5.7) specifically needs partial-failure handling: if 3 of 5
  positions close successfully and 2 fail, the UI must show which 2 failed
  and why, not report generic success or generic failure for the whole
  batch.
- First-load / empty states (no positions yet, Advisor has no
  recommendation yet, chain data still loading) must be visually distinct
  from "data failed to load" — a blank panel is ambiguous between "nothing
  here yet" and "something broke," and on a trading screen that ambiguity
  is itself a hazard.
