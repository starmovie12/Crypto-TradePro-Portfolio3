# Product Requirements Document — Crypto TradePro (INR Edition)

**Status:** Draft v2.7
**Owner:** Ail
**Platform:** Mobile-first web app (PWA-ready)
**Exchange:** Binance (Spot + Futures) for manual trading (5.1–5.10); Bybit Futures Testnet (via the user's own Freqtrade bot, monitored read-only) for 5.11

**Changelog (v1 → v2):**
- Added a critical balance-sufficiency check to the Bracket Order sheet (5.2) — fixes an observed bug where a Paper-mode Buy executed despite insufficient wallet balance.
- Changed Paper mode's "Add Mock Funds" into a full balance edit (5.5) — the mock wallet balance can now be set to any value, not just topped up.
- Added Portfolio Summary & Daily P&L (5.8) — total portfolio value at the top of the Portfolio screen, plus today's realized profit, loss, and net.
- Added Trade History (5.9) — a closed-trades log with a tap-to-expand detail view showing entry/exit price, fees, tax, and net P&L per trade.
- Added the missing Section 6 header ("Security") and moved Section 9 (Production Hardening) to its correct position after Section 8 — a document-structure fix, not a content change.

**Changelog (v2 → v2.1):**
- Added Section 5.10 (Conditional Entry Strategies) — three optional pre-trade
  decision engines (Step Entry, Tick Analytics, Trailing Buy) that sit between
  tapping Buy and the Bracket Order sheet actually firing, per the user's
  strategy discussion in the build conversation.

**Changelog (v2.1 → v2.2):**
- Added Section 9.6 (Conditional Entry Engine Hardening) — failure-mode
  coverage specifically for the three 5.10 engines (overlapping trackers,
  backgrounded-tab timer drift, tracker survival across navigation and
  WebSocket drops, undefined-math edge cases in Tick Analytics, fired-vs-
  filled state confusion, and mode-switch-mid-arm risk), so these engines are
  designed against crashes and silent-wrong-behavior before they're built,
  not patched after a Live-money incident.

**Changelog (v2.2 → v2.3):**
- Restructured 5.1 from a single always-visible option chain (implicitly
  Bitcoin-only) into a two-level Home screen: a **Crypto List** covering
  every underlying Binance lists options for, and an **Option Chain** that
  expands in place on tap, showing every strike with no filtering. Corrected
  the Section 2 bottom-nav label to match. Added Section 9.7 (Home Screen
  Scale) requiring strike-list virtualization and viewport-bounded
  subscriptions, since an unfiltered multi-crypto chain is a real
  performance/crash risk on mobile if built naively.

**Changelog (v2.3 → v2.4):**
- Added Section 5.11 (Bot Dashboard) — a new, dedicated read-only monitoring
  tab for the user's separate automated trading bot (CROWN-v12, built on
  Freqtrade, running on **Bybit Futures Testnet**), styled to match
  Groww/Angel One-caliber broker apps: a live Running Trades section, a
  Closed Trades history below it, and a tap-through detail view with a live
  chart. Data comes from the bot's existing Freqtrade REST API and
  WebSocket (the same interface its current bare-bones `dashboard.html`
  monitor already uses) — this is explicitly **not** a webhook-receiver
  design where the bot POSTs signals inbound; the app polls/subscribes to
  the bot's own API instead. Updated Section 6 (Security) and Section 7
  (Technical Architecture) to document this as a second, separate
  exchange/credential integration alongside the existing Binance one, and
  Section 8 with a corresponding build step.

**Changelog (v2.4 → v2.5):**
- Added Section 5.11.0 (Will This Actually Connect? — Pre-flight
  Checklist) — an explicit, numbered list of the 8 real conditions that
  determine whether this dashboard's connection to the Bybit bot will
  succeed, sourced directly from gaps the bot's own `DEPLOY_GUIDE.md` and
  `config.json` already document (CORS origin whitelist, Render free-tier
  sleep, JWT secret length, missing Postgres causing silent trade-history
  wipes, unauthenticated WebSocket if `ws_token` is left blank, etc.). Most
  of these fail *silently* — a generic error with no specific cause — so
  Section 5.11.3 (Connection & Error States) was added as a required
  (not optional) table of distinct, named UI states, one per failure
  mode, each telling the user exactly what to check rather than a single
  shared "connection error" message. Renumbered the former 5.11.2/5.11.3
  (Trade Detail View / Visual Style) to make room.

**Changelog (v2.5 → v2.6):**
- Corrected Section 5.11 against a full line-by-line read of every file in
  the Bot233 deployment package (not just the files sampled for v2.5),
  turning up two real bugs and one stale/inaccurate claim in the
  *previous PRD draft itself*:
  - **CORS is currently open, not closed.** v2.5 said `CORS_origins` was
    `[]` (blocking) based on a comment in `config.json` — the comment is
    stale; the actual live value is `["*"]` (wide open). CORS will not
    block this dashboard as currently deployed. The error state stays in
    5.11.3 as a safeguard for if the bot operator tightens it later, but
    it's no longer described as the most likely day-one failure.
  - **`WS_TOKEN` is documented but not wired.** `start.sh` describes a
    `WS_TOKEN` environment variable in its own header comment and
    substitutes every *other* secret (`DB_URL`, `API_USERNAME`,
    `API_PASSWORD`, `JWT_SECRET`, `PORT`) into the runtime config — but
    the substitution line for `WS_TOKEN` is missing from the script body.
    Setting it on Render currently has no effect; the bot's WebSocket
    stays on the placeholder token. 5.11.1's live-update design was
    corrected to build on REST polling (what `dashboard.html` actually
    uses) rather than assuming the WebSocket is available.
  - **The `DASHBOARD_WEBHOOK_URL` receiver doesn't exist.** Both
    `config.json` and `v12_Strategy.py` reference a `docker-compose.yml`
    and a "dashboard-receiver" service as already built this session —
    neither file is present in the zip. Harmless today
    (`DASHBOARD_WEBHOOK_ENABLED` defaults off), but noted in 5.11.0 so it
    isn't silently assumed to exist if that flag is ever turned on.
  - Also corrected: `dashboard.html`'s header text describes the bot as
    "Bitcoin futures," but `config.json`'s actual `pair_whitelist` covers
    30 pairs — this dashboard's copy and design should not inherit the
    BTC-only assumption.
  - Verified (no issues found): `requirements.txt` correctly pins
    `psycopg2-binary` for the Postgres path DEPLOY_GUIDE.md instructs; the
    options overlay (`OPTIONS_OVERLAY_ENABLED`) and dashboard webhook both
    default safely off; no unresolved TODO/FIXME markers in
    `v12_Strategy.py` — all "AUDIT FIX" comments in that file are already
    resolved, not open issues.

**Changelog (v2.6 → v2.7):**
- Added Sections 5.11.5–5.11.9, expanding the Bot Dashboard from strictly
  read-only monitoring to include a verified set of "Pro" broker-style
  features, each checked against Freqtrade's actual REST API and this
  bot's actual code before being added — not taken on faith from feature
  proposals:
  - **5.11.5 Emergency Bot Controls** — Pause/Stop/Stopbuy/Start/Force-Exit,
    confirmed as real Freqtrade endpoints that don't need any bot-side
    config change. This is a genuine scope change from 5.11's original
    "read-only" framing, so it's called out explicitly, with its own
    confirmation-step and audit-log requirements since it's the first part
    of 5.11 that can actually affect real trading. Explicitly did **not**
    include a "live-edit strategy parameters" control some proposals
    suggested: verified that `/api/v1/reload_config` restarts the whole
    bot process (not a hot-reload), and that this strategy's tunable
    values are hardcoded Python constants in `v12_Strategy.py`, not
    config fields — editing them from a web form would mean deploying a
    code change, a much bigger feature than it was described as.
  - **5.11.6 Visual Analytics** — equity curve and win/loss breakdown,
    computed client-side from data already being polled (no new backend
    calls). Left out Sharpe/Sortino/Calmar ratios as a separate,
    explicitly-deferred future item pending a methodology decision.
  - **5.11.7 Push Notifications** — diffs trade IDs across the existing
    5-second poll; confirmed Freqtrade has no native push mechanism for
    this over plain REST, so this is a frontend-only addition.
  - **5.11.8 Adaptive Stop-Loss Chart Overlay** — confirmed this data only
    exists via the optional strategy webhook already documented in 5.11.0
    (not any REST endpoint), so this feature inherits that webhook's
    dependency and its still-unresolved missing-receiver gap (5.11.0 item
    7) rather than being newly independent.
  - **5.11.9 Explicitly Deferred** — documents what was proposed but left
    out and why: AI trade autopsy (belongs in Section 5.6, not 5.11), PnL
    share cards (fine but cosmetic, doesn't affect build order), live
    order book (verified the bot doesn't use market depth at all —
    `check_depth_of_market.enabled: false` — so this is a manual-trading
    feature, not a bot-monitoring one), multi-bot fleet management
    (speculative for a one-bot system), Telegram/Discord alerts (verified
    zero existing Telegram config anywhere in the bot), and the
    manual-trading-UX items from a larger 20-feature list (hotkeys,
    order-book heatmaps, voice commands, etc.) as out of scope for this
    section specifically.
- Updated Section 6 (Security) with a rule specific to the new
  state-changing controls: proxied server-side only, never called
  directly from the frontend, every action logged.
- Updated Section 8's build sequence with steps (m)–(o) for the new
  5.11.6–5.11.8 additions, with 5.11.5 (Emergency Controls) deliberately
  sequenced last within Section 5.11's build — after the read-only path
  is solid — since it's the first part of this feature that can actually
  change what the bot does.

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
- Bottom navigation: **Home (Crypto List → Option Chain)** · **Portfolio** · **AI Advisor** · **Settings**.
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

### 5.1 Home Screen — Crypto List with Expandable Option Chain

**Problem this closes:** the app currently behaves as if there's exactly one
crypto (Bitcoin) with one option chain always visible. The Home screen must
instead show **every crypto Binance offers options on**, and let the user
open any one of them into its full option chain in place, without leaving
the screen.

**Two-level layout, both on the same screen (no separate route/page for the
option chain):**

**Level 1 — Crypto List (default view on Home):**
- A scrollable list of **every underlying Binance lists options for**
  (BTC, ETH, and whatever else the exchange currently supports) — not a
  hardcoded shortlist. Fetch the available underlyings from `ccxt`'s
  options-market listing rather than hardcoding "BTC" anywhere in the
  frontend, so a new underlying Binance adds later shows up without a code
  change.
- Each row shows: crypto name/symbol, current spot price (INR, live), and
  24h change % — all from the same live WebSocket subscriptions required by
  Section 4, not REST polling, since this list-level price is exactly the
  kind of "price on screen" Section 4 already requires to be live and
  sub-second.
- Rows are collapsed by default — this list is the landing view, so it must
  stay lightweight (one live price line per crypto) even before the user
  opens anything.

**Level 2 — Option Chain (expands in place on row tap):**
- Tapping a crypto's row **expands that row in place** into its full option
  chain (Calls / Strike / Puts layout, as previously specified) — it does
  not navigate to a different screen or route. The rest of the Crypto List
  stays visible above/below the expanded chain so the user can collapse it
  and open a different crypto without losing their place.
- Only one crypto's chain is expanded at a time — opening a second one
  collapses the first, both to keep the screen readable on a phone and to
  cap how many chain-level WebSocket subscriptions are active at once (see
  the subscription note below).
- **Every strike Binance lists for that expiry is shown — no filtering to
  "near the money" or any other subset.** If the exchange returns 40
  strikes or 400, all of them render, spanning the full range from deep
  in-the-money to deep out-of-the-money on both the Call and Put side. The
  strike nearest the current spot price is still visually marked **ATM**
  (as previously specified) so the user has a reference point inside the
  full list, but ATM-marking is a visual cue, not a filter — nothing is
  hidden.
  - **Performance note carried into Section 9:** rendering an unbounded
    number of strike rows without list virtualization is a real
    crash/jank risk on a phone, independent of anything server-side — this
    is addressed as a required behavior in the new Section 9.7, not left
    as an assumption here.
- Per strike, same as before: LTP (INR), Volume, Change %. `Buy CE` / `Buy
  PE` button on every row opens the Bracket Order sheet (5.2) immediately on
  tap — this applies uniformly across every strike in the full,
  unfiltered list, not just ones near the money, so a deep OTM strike's Buy
  button works identically to the ATM row's.
- Tapping any row (not just Buy) still opens that strike's live candlestick
  chart (TradingView Lightweight Charts), same as previously specified.

**Subscription management:** opening a crypto's option chain means
subscribing to a live WebSocket feed per visible strike (for LTP/Volume/
Change%) in addition to the one Level-1 spot-price subscription already
active for every crypto in the list. Collapsing a chain (or expanding a
different crypto's, per the one-at-a-time rule above) must **unsubscribe**
the strike-level feeds for the chain being collapsed — leaving them
subscribed in the background after the user has moved on is both a
performance cost and a violation of Section 4's live-data requirement
turning into stale, unused subscriptions nobody is looking at.

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

### 5.10 Conditional Entry Strategies (Optional Pre-Trade Layer)

**Problem this closes:** today, tapping `Buy CE` / `Buy PE` (5.1) goes
straight to the Bracket Order sheet (5.2) — the tap itself is the entry
decision. These three strategies insert an **optional confirmation layer**
between the tap and the actual order: the tap arms a tracker that watches
live price behavior for a short window and only *then* decides whether to
place the real order, cancel, or place a different order than a naive
same-second Buy would have. All three are variations on one idea — waiting
for the market to show its hand before committing capital — but they each
watch for a different signal, so each needs its own settings and its own
tracking function.

All three share the same architectural shape:

- Each is a **named engine** the user selects per-order (not a global
  setting) — e.g. a mode selector on the Bracket Order sheet: **Instant**
  (today's behavior, no tracker) / **Step Entry** / **Tick Analytics** /
  **Trailing Buy**.
- Arming an engine does **not** place any order and does **not** touch the
  Balance Sufficiency Check (5.2) or the fee/tax estimate (5.3) yet — those
  only apply once the engine actually decides to fire a Buy or Sell, at
  which point the order flows through the exact same Bracket Order path as
  an Instant order (same balance check, same fee/tax breakdown, same
  Spot/Futures execution logic from 5.4). An armed-but-not-fired tracker is
  purely client-side price-watching, not an order.
- Each engine reads live ticks from the **same WebSocket subscription**
  already required by Section 4 — it must not open a second connection or
  fall back to polling, for the identical reason Section 4 gives for banning
  polling on the main price display.
- Each engine needs a visible **"tracking" state** on screen (per Section
  9.5's rule that no in-flight state should look identical to idle) — the
  user should be able to see at a glance that an engine is armed and
  watching, and a manual **Cancel Tracker** control that stops it before
  it fires, with no order placed.
- Each engine needs a **timeout**, after which it auto-cancels if it hasn't
  fired — an armed tracker must never wait indefinitely.
- **Recommendation, not a requirement:** before any of these three engines
  is trusted with Live money, it should be run in Paper mode (5.5) across a
  reasonable number of trades and reviewed against Trade History (5.9) to
  see whether it actually improved entries versus Instant mode for this
  user's instruments and timeframes. None of the three has been validated
  against real market data yet — the logic below is a specification of
  *what* each engine does, not a claim that it's profitable.

#### 5.10.1 Step Entry (Momentum Confirmation)

Waits for price to move a set distance in one direction before treating that
as confirmation, instead of entering the instant the button is tapped.

**Settings:**

| Field | Example | Notes |
|---|---|---|
| Total Steps | 10 | |
| Step Size | ₹0.10 | |
| Upward Action | Execute Buy | Dropdown: Execute Buy / Execute Sell / Cancel Tracker |
| Downward Action | Cancel Tracker | Dropdown: Execute Buy / Execute Sell / Cancel Tracker |
| Timeout | 60s | Auto-cancel if neither trigger hits in time |

**Logic:**
- On tap, record the current LTP as `basePrice`. Do not send anything to the
  exchange yet.
- `upTrigger = basePrice + (Total Steps × Step Size)`
- `downTrigger = basePrice − (Total Steps × Step Size)`
- If LTP reaches `upTrigger` first → fire whatever action is set in
  **Upward Action**.
- If LTP reaches `downTrigger` first → fire whatever action is set in
  **Downward Action**. This allows "buy the dip" (setting Downward Action to
  Execute Buy) as well as the more cautious default of cancelling on a move
  against the expected direction.
- If Timeout elapses before either trigger is hit, cancel and show a toast —
  no order is placed.
- **Known limitation to design around, not ignore:** if price gaps past a
  trigger in one tick (e.g. jumps straight from 9 steps to 12 steps in a
  single update because of a fast candle), the resulting Market order can
  fill at a materially worse price than the trigger level. If this matters
  for the user's instruments, a **Stop-Limit** order (rather than Market) at
  the trigger fire should be considered as a config option — flagged here as
  a design decision, not built by default in v1.

#### 5.10.2 Tick Analytics (Time-Windowed Momentum Read)

Instead of watching for a price *distance*, this records a fixed time window
of tick-by-tick activity and makes a Buy/Cancel decision from the aggregate
shape of that window.

**Settings:**

| Field | Example | Notes |
|---|---|---|
| Analysis Window | 60s | Recommended range: 15s–60s for fast-moving instruments |

**Data captured per tick during the window:** every WebSocket price update is
appended to an in-memory array (not sent anywhere; pure client-side
capture) until the window elapses. At window-end, compute:

- `upTicks` / `downTicks` — count of ticks that moved price up vs. down.
- `avgJump` — average size of the up-moves.
- `avgDrop` — average size of the down-moves.
- `netChange` — final LTP at window-end minus `basePrice` at window-start.

**Decision at window end:**
- **Execute Buy if:** `upTicks > downTicks` AND `avgJump > avgDrop` AND
  `netChange > 0`.
- **Cancel if:** `avgDrop > avgJump` (reads as a sharp adverse move outweighing
  the gradual up-move — the settings example discussed was gradual +10 paise
  steps followed by a sudden ₹2 drop) OR `netChange <= 0` (net flat/down —
  no real direction over the window, e.g. price oscillating without going
  anywhere).
- If the window elapses without a clear Buy signal, the default is Cancel —
  this engine does not have a separate timeout distinct from the Analysis
  Window itself, since the window's end *is* the decision point.

**Known limitation to design around:** the tick array only reflects
*this* window; if the user re-arms the engine immediately after a Cancel,
it starts a fresh window with no memory of the previous one. If comparing
across multiple consecutive windows becomes useful, that would be a v2
extension (a rolling log across windows), not part of this v1 spec.

#### 5.10.3 Trailing Buy (Dip-Catch with FOMO Ceiling)

Chases a falling price down and buys on the first bounce, rather than
buying at the price the button was tapped at — with a ceiling that forces
entry if price runs up without ever dipping.

**Settings:**

| Field | Example | Notes |
|---|---|---|
| Trailing Reversal | ₹2.00 | Bounce-back amount from the lowest recorded price that triggers Buy |
| Max FOMO Price | ₹205 | Upper bound — if hit before any dip/bounce, force a Buy here instead of continuing to wait |

**Logic:**
- On tap at `basePrice` (e.g. ₹200), start tracking. Maintain a running
  `lowestPrice` variable, initialized to `basePrice`, that only ever moves
  downward as new lower ticks arrive.
- **Execute Buy if:** current LTP ≥ `lowestPrice + Trailing Reversal` (price
  found a floor and bounced back by the configured amount).
- **Execute FOMO Buy if:** current LTP ≥ `Max FOMO Price` (price never
  dipped and is running away upward — enter here rather than missing the
  move entirely).
- Manual **Cancel Tracker** button available at all times while hunting for
  the dip, per the shared behavior above.
- **Known limitation to design around:** in a instrument that only ever
  grinds sideways without a clean dip *or* a clean breakout, this engine can
  sit armed for its full Timeout without either condition firing — which is
  the intended, safe outcome (no forced entry into a directionless market),
  but the user should not read a Timeout-cancel here as an error state.

### 5.11 Bot Dashboard — Automated Strategy Monitor (Read-Only)

**Problem this closes:** the user separately runs an automated trading bot
(CROWN-v12, built on Freqtrade, currently deployed on **Bybit Futures
Testnet** — not Binance) that trades independently under its own strategy
logic. Today that bot's activity is only visible through a bare-bones
monitoring page (`dashboard.html`) with plain HTML tables and no chart. This
section gives it a dedicated, professional tab inside Crypto TradePro,
matching the visual quality of 5.1–5.10's Binance manual-trading screens —
in the style of a top-tier broker app (Groww / Angel One): live-updating
running positions up top, closed-trade history below, and a tap-through
detail view with a full chart.

**Important scope boundary — read this before building:** this is
primarily a **monitoring/observability feature, not an order-execution
feature** — with one deliberate, narrow exception. The bot decides and
places its own entry/exit orders directly against Bybit via Freqtrade's
own internals; this dashboard tab never sends a buy/sell instruction and
never picks trades for the bot. The one thing it *can* do, specified
explicitly in 5.11.5 (Emergency Bot Controls) later in this section, is
pause/stop the bot or force-exit its current position — safety overrides,
not trading decisions. Everything else in 5.11 is pure display. This
keeps 5.11 consistent with the rest of the PRD's non-goal ("Explicit
non-goals," Section 1): Crypto TradePro does not auto-place trades on the
user's behalf, and does not select what the bot trades — the Bybit bot is
a separate system with its own separate risk posture, documented in its
own `RISK_AND_LIMITATIONS.md`. This tab must not blur that line by
implying Crypto TradePro is directing the bot's trading — only that it
can, when the user deliberately chooses to, tell it to stop.

**Two exchanges, explicitly:** 5.4's Binance order-execution logic and this
section's Bybit bot-monitoring logic are unrelated integrations that happen
to live in the same app. Do not merge their code paths, their API-key
config, or their currency-conversion assumptions (the bot's `dry_run_wallet`
and stake amounts are denominated in **USDT**, not USD, and must go through
the same INR conversion as Section 3 before display).

**Data source — not a webhook the user's bot sends signals to.** The bot
already exposes a **Freqtrade REST API** (`api_server` block in its
`config.json`: JWT login at `/api/v1/token/login`, then Bearer-token GET
requests) and, separately, a **native WebSocket** (`/api/v1/message/ws`,
meant to be gated by a `ws_token`). The REST API is confirmed working and
is what `dashboard.html` actually uses today (JWT login, then GET
`/api/v1/status` / `/api/v1/trades` / `/api/v1/balance` / `/api/v1/profit`
every 5 seconds) — build the dashboard tab against this first. The
WebSocket is real (Freqtrade always exposes it once `api_server.enabled`
is true) but is **not currently usable as shipped**: `start.sh`'s
`WS_TOKEN` substitution is missing (5.11.0 item 6), so treat it as a
future upgrade once that's fixed, not a day-one dependency. Either way, do
not design a new inbound webhook endpoint for "the bot to POST signals to
us" — that inverts the actual architecture; this app is a *client* of the
bot's API, not a *receiver* the bot pushes to.

| Data needed | Freqtrade endpoint | Notes |
|---|---|---|
| Auth | `POST /api/v1/token/login` (Basic auth: `api_server.username`/`password` from the bot's config) | Returns a short-lived JWT; re-login on 401 exactly like `dashboard.html` already does |
| Running position(s) | `GET /api/v1/status` | Array of open trades — this bot runs `max_open_trades: 1`, so expect at most one row, not a list UI built for many. **Verified in `config.json`: `pair_whitelist` has 30 pairs (BTC, ETH, SOL, DOGE, etc. — not Bitcoin-only), so that one position can be any of them.** `dashboard.html`'s own header text ("Bitcoin futures") is stale/inaccurate against this — don't carry that BTC-only assumption into this dashboard's copy or design. |
| Closed trade history | `GET /api/v1/trades?limit=N` | Filter client-side on `is_open === false` |
| Wallet/balance | `GET /api/v1/balance` | Use `total_bot` (bot-managed funds), fall back to `total` — `total_bot` may not exist on older Freqtrade versions |
| Aggregate P&L / win rate | `GET /api/v1/profit` | Field names have shifted across Freqtrade versions (e.g. `profit_closed_coin` vs `profit_all_coin`) — read defensively with a fallback list, not a single hardcoded key, exactly as `dashboard.html`'s `firstDefined()` helper already does |
| Live tick/candle price for the chart | Same Bybit public market-data feed already available to this app for any Bybit-listed pair, OR the bot's own OHLCV if exposed — do **not** trust a price value embedded in an old poll response for the live chart; fetch current candles for the chart independently |
| Strategy-specific fields (regime, adaptive stop-loss, checkpoint data, options-overlay Delta/IV readings) | The bot's own `DASHBOARD_WEBHOOK_URL` push, **only if the bot operator has explicitly enabled `DASHBOARD_WEBHOOK_ENABLED`** in `v12_Strategy.py` | This is the *one* case where the bot pushes outward rather than being polled — it is off by default and sends `event: "entry" \| "checkpoint" \| "exit"` payloads with fields like `entry_adaptive_sl`, `regime`, `checkpoint_vol_ratio`, `final_checkpoint_sl`, `iv_move_at_checkpoint`, `premium_sl_pts`. Treat every field here as optional — if this push was never enabled, the detail view (5.11.2) must still render cleanly using only the REST-derived fields above. |

#### 5.11.0 Will This Actually Connect? — Pre-flight Checklist

Before any UI work starts here, walk this list against the real deployed
bot. Each item is a documented failure point in the bot's own
`DEPLOY_GUIDE.md`/`config.json` — **connection is not guaranteed by
default**, and most of these fail *silently* (a generic "connection error"
with no further detail), so the dashboard tab's own error states (5.11.3)
must be built to name the specific cause, not just show "failed."

| # | Condition to verify | What happens if it's wrong | Silent or explicit failure? |
|---|---|---|---|
| 1 | `api_server.enabled: true` in the bot's `config.json` | No API exists to connect to at all | Explicit — connection refused |
| 2 | `CORS_origins` includes this dashboard's exact origin URL | Every request blocked by the browser | **Verified in the actual shipped `config.json`: this is currently `["*"]` (wide open), not the empty `[]` its own comment block describes** — the comment is stale, the real value already allows any origin. So on the *current* build, CORS will not block this dashboard. Flagging this anyway because `["*"]` is a security choice to revisit before going live with real funds (any site can call the bot's API), and because the comment/value mismatch itself is worth fixing in the bot's config so it doesn't mislead the next person who reads it. |
| 3 | `API_USERNAME` / `API_PASSWORD` env vars were actually set on Render (not left as config placeholders) | Login (`/api/v1/token/login`) returns 401/403 | Explicit — login fails, but the dashboard must surface *"check bot's API_USERNAME/PASSWORD"*, not a bare HTTP error code |
| 4 | `JWT_SECRET` is ≥32 characters | The bot itself fails to start (`ConfigurationError`) — nothing to connect to | Explicit at the bot's own boot, invisible to this dashboard — it just sees "can't reach host" |
| 5 | Render service is awake | Free-tier Render sleeps after inactivity; first request after sleep can take ~a minute and may time out or error before the container wakes | Looks identical to a real connection failure unless the dashboard specifically handles "still waking up, retry" as its own state |
| 6 | `ws_token` actually reaches the running config | **Verified real gap in `start.sh`: the script's own header comment documents a `WS_TOKEN` env var and says it substitutes into `config.json`'s `ws_token` placeholder — but the substitution `sed` line for it is missing from the script body** (every other secret — `DB_URL`, `API_USERNAME`, `API_PASSWORD`, `JWT_SECRET`, `PORT` — has one; `WS_TOKEN` does not). Setting `WS_TOKEN` on Render currently does nothing; `ws_token` stays the literal placeholder string forever unless `config.json` is hand-edited. Since a placeholder token is a *known* value, the WebSocket endpoint is effectively unauthenticated until this is fixed. | Silent — Render will accept the `WS_TOKEN` env var with no error; it's just never used |
| 7 | `DASHBOARD_WEBHOOK_URL` / the `dashboard-receiver` service it points to | **Verified: `v12_Strategy.py`'s comments and `config.json`'s webhook URL (`http://dashboard-receiver:5001/api/webhook`) both reference a `docker-compose.yml` and a "dashboard-receiver" service as already built — neither file exists in this deployment package.** `DASHBOARD_WEBHOOK_ENABLED` defaults to `False` so this causes no failure today, but if it's ever turned on without first building that receiver (or pointing the URL at Crypto TradePro's own backend instead), the POST will simply fail — caught and logged, per the code's own fire-and-forget design, so trading is unaffected, but the dashboard silently never receives the Phase 3.5 strategy fields. | Silent — logged at WARNING on the bot side only; invisible from the dashboard unless bot logs are also being watched |
| 8 | `DB_URL` (Postgres) is configured | Bot falls back to local SQLite, which **is wiped on every Render restart/sleep** — closed-trade history the dashboard displays can vanish without warning, independent of anything the dashboard code does wrong | Silent — the dashboard will just show a suddenly-empty history and there is nothing in the API response that flags "this was reset" |
| 9 | Bot is on `dry_run: true` / `exchange.sandbox: true` (current state) vs, later, real Bybit credentials | Affects only whether balance/P&L numbers are simulated or real money — connectivity mechanics (items 1–8) are identical either way | N/A — a mode distinction, not a failure mode, but must be shown clearly in the UI (5.11.1) so the user never mistakes paper P&L for real P&L |

**What this actually means for connecting today:** on the exact files
reviewed, items 1, 3, 4, 8, 9 are configuration the user must still do
(set env vars, add Postgres) but are not code bugs. Item 2 (CORS) will
**not** block the connection as currently shipped — the earlier v2.5 draft
of this PRD said otherwise based on the config's stale comment rather than
its actual value; that has been corrected here. Items 6 and 7 are real
gaps in the shipped code itself (a documented-but-unwired env var, and a
webhook URL pointing at a service that was never actually created) — worth
fixing in the bot repo directly, independent of anything Crypto TradePro
builds.

**Practical implication for the build:** item 5 (Render sleep) is the
failure most likely to be hit on day one and needs its own named error
state in the UI. Item 8 (SQLite wipe) is
not a dashboard bug to fix in this app at all; it's a bot-deployment gap
that should be called out to the user once, on first connect, as a
one-time notice ("your bot isn't using a persistent database — closed
trade history may reset if it restarts") rather than silently producing
what looks like a dashboard data-loss bug later. Item 6 (`WS_TOKEN`) means
this dashboard tab should **not build its live-update path on the
WebSocket as a hard dependency** — since the token wiring is currently
broken at the bot's own `start.sh` level, plan for 5-second REST polling
(5.11.1) as the real day-one behavior, with the WebSocket as an upgrade
path once that script is fixed, not the other way around.
that should be called out to the user once, on first connect, as a
one-time notice ("your bot isn't using a persistent database — closed
trade history may reset if it restarts") rather than silently producing
what looks like a dashboard data-loss bug later.

**Connection setup, not hardcoded credentials:** the bot's API URL,
username, password, and (optionally) WebSocket token must be entered by the
user in a settings screen and stored server-side (same `.env` / server-side
storage rule as Section 6 — never in frontend code, never in an AI chat
message), not hardcoded, since the deployed URL and credentials will differ
between the user's Render deployment and any future environment. Until this
is configured, the tab shows an explicit **"Not connected — add your bot's
API details"** empty state, not a blank or broken screen (per Section
9.5's rule on explicit empty states).

**CORS is a real, documented failure mode for this exact integration** —
see item 2 in the pre-flight checklist above. The dashboard tab's error
state for a failed connection must name this specific possibility (e.g.
"Connection failed — if you're sure the URL and credentials are correct,
check the bot's `CORS_origins` config includes this site's URL") rather
than a bare "connection error," since a generic message sends the user
chasing the wrong fix.

#### 5.11.1 Tab Structure

- A new top-level tab, **Bot Signals** (or "Strategy Bot"), alongside the
  existing Home/Portfolio tabs — not nested inside the manual-trading
  Portfolio screen, since this is a separate account/system with its own
  balance.
- **Running Trades** section at the top: card(s) for currently open bot
  position(s) — pair, side (LONG/SHORT), entry price, live current price,
  unrealized P&L (INR-converted, colored green/red), time open, and current
  regime if the optional strategy webhook (above) is active. Given
  `max_open_trades: 1`, design this as a prominent single-position card
  first, with the layout able to extend to a short list if the bot's config
  ever changes.
- **Closed Trades** section below it: reverse-chronological list — pair,
  side, entry price, exit price, net P&L, exit reason (e.g. `stop_loss`,
  `roi`, `liquidation` — surface the raw Freqtrade `exit_reason` string,
  since it's meaningful to a user reviewing bot behavior), closed time.
- Both sections update on a **5-second REST poll**
  (`/api/v1/status`, `/api/v1/trades`, `/api/v1/balance`, `/api/v1/profit`)
  as the day-one behavior — matching `dashboard.html`'s existing interval,
  which is the *only* mechanism it actually uses today. **Correction from
  the previous draft of this PRD:** it previously said the bot's
  `/api/v1/message/ws` WebSocket was already "the same interface
  `dashboard.html` uses" — checked directly against `dashboard.html`'s own
  code, and that file never opens a WebSocket at all, REST polling only.
  Treat the WebSocket as a genuine upgrade to build *after* REST polling
  works, not a same-day requirement — and see 5.11.0 item 6: the bot's
  `ws_token` currently can't be set via Render env vars at all due to a
  missing substitution line in `start.sh`, so the WebSocket path is not
  usable as shipped regardless of what this app builds.

#### 5.11.2 Trade Detail View

Tapping any row (running or closed) opens a dedicated full-screen detail
view:

- **Live chart** for that pair using this app's existing TradingView
  Lightweight Charts integration (Section 7), showing the entry price (and
  exit price, if closed) as horizontal reference lines/markers on the
  chart.
- **Trade data panel:**

  | Field | Source |
  |---|---|
  | Pair, side (Long/Short) | `/api/v1/status` or `/api/v1/trades` |
  | Entry price, current/exit price | Same |
  | Day High / Day Low | Live market data for the pair, not the bot's API — Freqtrade doesn't track this |
  | Unrealized or net P&L | Same trade record, INR-converted |
  | Exit reason (closed trades only) | `exit_reason` field |
  | Regime, adaptive stop-loss, checkpoint volatility ratio, IV-crush step-2 status | Optional strategy webhook payload, if enabled — omit these rows entirely (not blank/zero) when that data was never pushed for this trade |
- If the optional strategy webhook was not enabled for a given trade, the
  detail view degrades gracefully to REST-only fields rather than showing
  empty rows for the strategy-specific data — this must be handled as a
  normal, expected case, not an error.

#### 5.11.3 Connection & Error States (Required, Not Optional)

Every failure mode from the pre-flight checklist (5.11.0) needs its own
named UI state — a single generic "connection error" is explicitly not
acceptable here, since most of these fail identically from the browser's
point of view but need different user action:

| State | Trigger | What the user sees |
|---|---|---|
| Not connected | No bot API details saved yet | "Add your bot's API details" with a link to the settings screen — never a blank tab |
| Waking up | First request after Render free-tier sleep (checklist #5) | "Bot is waking up (Render free tier) — retrying…" with automatic retry, not an immediate error |
| Blocked by CORS | Fetch fails with a browser-level CORS error specifically (distinguishable from a network timeout in the fetch error object) | "Blocked — check the bot's `CORS_origins` includes this site's URL" (checklist #2). Not expected to trigger on the current `["*"]` config, but the bot operator could tighten `CORS_origins` later (recommended before real funds are involved — see checklist #2's note) without remembering to update this dashboard, so this state still needs to exist and needs to name the real cause rather than showing a generic failure. |
| Auth failed | Login returns 401/403 | "Login failed — check the bot's API username/password" (checklist #3) — never silently retry with the same bad credentials in a loop |
| Unreachable | Timeout / DNS / connection refused, none of the above | "Can't reach the bot at this URL — confirm it's deployed and the URL is correct" |
| Connected, but history looks reset | Trade count/IDs dropped compared to last successful fetch, with no corresponding new deploy the user triggered | One-time notice per session: "Trade history may have reset — this bot isn't using a persistent database (see checklist #8)" — informational, not blocking |

Each state is independently testable and must not be collapsed into a
shared catch-all in the implementation, or the checklist above becomes
undebuggable in practice.

#### 5.11.4 Visual Style

- Match the dark, data-dense, monospace-numerals aesthetic already used
  elsewhere in this app for price displays (Section 4), extended with
  broker-app conventions: green/red for LONG/SHORT and profit/loss, a
  small live "pulse" indicator on the connection status (reusing the
  connected/error/disconnected states `dashboard.html` already defines),
  and card-based layout rather than the current bare HTML tables.
- This is a **rebuild** of `dashboard.html`'s functionality as a native
  screen inside this app's existing design system — not an embedded iframe
  of the old file.

#### 5.11.5 Emergency Bot Controls (Actionable, Not Read-Only)

**This is a real scope change from 5.11's original framing** — everything
above this point was deliberately read-only monitoring. This subsection
adds the one category of action that a monitoring-only dashboard
genuinely can't defer to the bot operator fast enough: stopping the bot in
an emergency. Verified against Freqtrade's own REST API (not assumed):

| Control | Endpoint | Verified behavior |
|---|---|---|
| Pause | `POST /api/v1/pause` | Gracefully handles open trades per their own exit rules, stops opening new ones — the safer of the two stop options, since it doesn't strand an open position |
| Stop | `POST /api/v1/stop` | Stops the trader outright; resume with `/api/v1/start` |
| Stop new entries only | `POST /api/v1/stopbuy` | Closes existing positions normally, just opens nothing new — a softer control than full Stop |
| Start | `POST /api/v1/start` | Resumes a paused/stopped bot |
| Force-exit one trade | `POST /api/v1/forceexit` | Confirmed this does **not** require `force_entry_enable` — that flag only gates `/forceenter` (force-entering a *new* trade), a different endpoint this PRD does not ask for. `forceexit` works on this bot's current config (`force_entry_enable: false`) as-is. |

**None of these require any config change on the bot** — they're always
available once `api_server.enabled` is true, which it already is. This
is the one part of 5.11 where the earlier "read-only, monitoring only"
framing (5.11, opening paragraphs) is superseded — update that framing to
say the tab is monitoring-first with a small, explicit set of emergency
controls, not that it never sends a command.

**Required safeguards, since these are real destructive actions:**
- Every control needs a confirmation step before firing — no single-tap
  Stop or Force Exit, mirroring the duplicate-submit protection Section
  9.3 already requires for manual orders.
- Show which control is appropriate for which situation directly in the
  UI copy (Pause ≠ Stop ≠ Stopbuy — a user reaching for "stop the bleeding
  but don't strand my open position" wants Pause or Stopbuy, not Stop).
- Log every control action taken from this dashboard (who, when, which
  action) — this is the one place this app can materially affect the
  bot's real trading, so it needs its own audit trail, separate from the
  bot's own Freqtrade logs.
- **Not included, on purpose:** editing the bot's strategy parameters
  (stop-loss %, thresholds, etc.) from this dashboard. Freqtrade's
  `/api/v1/reload_config` **restarts the bot process** (confirmed against
  Freqtrade's own FAQ: "the bot will stop, reload the configuration and
  strategy and will restart") — it is not a hot-reload. Worse, this
  bot's actual tunable values (`BASE_SL_TRENDING_PTS`, `IV_CRUSH_SPIKE_POINTS`,
  `KILL_SWITCH_CONSECUTIVE_SL`, etc. — see `v12_Strategy.py`) are
  **hardcoded Python class constants inside the strategy file**, not
  `config.json` fields — so a "settings page to edit strategy parameters"
  would mean generating and deploying a code change, not editing a
  config value, and doing that from a web form is a materially bigger and
  riskier feature than it sounds. If this is wanted later, scope it
  separately and explicitly as "edit + redeploy the strategy file," not
  folded into this section as a simple settings toggle.

#### 5.11.6 Visual Analytics — Equity Curve & Win/Loss Breakdown

Extends the `/api/v1/profit` data already being fetched (5.11.0) into two
charts on the main Bot Signals tab, using this app's existing charting
setup (Section 7):
- **Equity curve** — cumulative P&L over time, built client-side from
  `/api/v1/trades`' closed-trade records (each trade's `close_date` +
  running P&L total), not from a Freqtrade endpoint that returns this
  shape directly — Freqtrade does not have a single "equity curve"
  endpoint, so this is computed in the frontend from data already being
  polled.
- **Win/loss donut** — count of profitable vs. unprofitable closed trades
  from the same `/api/v1/trades` data, not a separate call.
- Both charts share the same 5-second poll as the rest of 5.11.1 — no new
  polling loop, since the underlying data is already being fetched.
- Advanced quant metrics beyond these two (Sharpe, Sortino, Calmar ratios)
  are **not** in this section's scope — they need a return-series
  methodology decision (which risk-free rate, which period) this PRD
  doesn't make silently; treat as a future addition once that's decided
  explicitly, not bundled in here.

#### 5.11.7 Push Notifications on Trade Events

When the 5-second poll (5.11.1) detects a new open trade or a newly
closed trade (by diffing trade IDs against the previous poll, not by a
Freqtrade push mechanism — there isn't one for this over plain REST),
fire a browser/PWA push notification ("Bot opened LONG ETH/USDT" /
"Trade closed: +₹2,840"). Since this piggybacks on the existing poll
rather than adding a new connection, it has no extra connectivity
requirements beyond 5.11.0's checklist — but note it inherits that
checklist's failure modes too: if the tab is in an "Unreachable" or
"Waking up" state (5.11.3), there's nothing to diff and no notification
fires, which is correct behavior, not a bug to fix separately.

#### 5.11.8 Chart Overlay — Adaptive Stop-Loss Line

**Depends entirely on the optional strategy webhook already described in
5.11.0's data table** (`DASHBOARD_WEBHOOK_ENABLED`) — the adaptive/trailing
stop-loss values (`entry_adaptive_sl`, `checkpoint_sl`,
`final_checkpoint_sl`) exist **only** in that payload; they are not present
in any Freqtrade REST endpoint, since they're this strategy's own
in-memory state. This means:
- If that webhook is never enabled, this overlay simply cannot be built
  for a given trade — the detail view falls back to the static entry/exit
  lines already specified in 5.11.2, which is the expected degraded case,
  not an error.
- If it is enabled, plot the SL value as a horizontal line that steps
  (not smoothly interpolates) at the entry and checkpoint timestamps,
  since the strategy only recomputes it at those two discrete points
  (Phase 2.5 entry, Phase 3.5 checkpoint ~60s later) — it does not move
  continuously, and a smoothed line would misrepresent how the strategy
  actually works.
- **And 5.11.0 item 7 still applies**: the webhook's configured receiver
  (`dashboard-receiver` / `docker-compose.yml`) doesn't exist in the
  current deployment — enabling `DASHBOARD_WEBHOOK_ENABLED` only makes
  sense once this app's own backend is set as `DASHBOARD_WEBHOOK_URL`,
  which is new wiring this section should specify explicitly rather than
  assume.

#### 5.11.9 Explicitly Deferred (Not in This PRD)

Reviewed against the bot's actual codebase and deliberately left out of
5.11, with the reason:
- **AI Post-Trade Autopsy** — a reasonable idea, but belongs as an
  extension of Section 5.6 (AI Advisor), not 5.11, since it's an AI
  feature applied to bot trade data rather than a dashboard-display
  feature; scope it there if wanted.
- **Social "Flex" Cards / PnL sharing** — pure frontend feature, no
  bot-data dependency, doesn't need verification against Freqtrade — fine
  to build, but it's cosmetic and independent of everything else in 5.11,
  so it shouldn't block or reorder the build sequence in Section 8.
- **Live Order Book / Market Depth (DOM)** — technically fine (Bybit's
  public WebSocket exposes order-book depth independent of the Freqtrade
  bot entirely), but it's a manual-trading feature in spirit — it belongs
  alongside 5.1's option chain / Binance integration, not bolted onto the
  bot-monitoring tab, since the bot itself never reads or acts on order-book
  depth (confirmed: `check_depth_of_market.enabled: false` in
  `config.json`).
- **Multi-Bot / Fleet Management** — reasonable future direction, but
  there is exactly one bot today; designing a multi-instance credential
  array now is speculative scope for a system that doesn't exist yet.
  Revisit when a second bot is actually being deployed.
- **Telegram/Discord alerts** — verified: this bot has zero existing
  Telegram/Discord configuration anywhere in `config.json` or
  `v12_Strategy.py`. This would be a net-new integration on the bot side,
  not something Crypto TradePro's dashboard can add by itself — out of
  scope for this PRD.
- **Live Terminal Logs / System Health page** — `/api/v1/logs` is a real,
  verified endpoint (returns recent log lines), so a simple pollable log
  viewer is feasible; but "live scrolling console" and a multi-service
  health/latency dashboard are bigger builds than this section's other
  items and should be scoped separately if wanted, not folded in here.
- **Auto-wake ping service** — would reduce how often 5.11.3's "Waking
  up" state is hit, but pinging a service specifically to defeat its
  free-tier sleep behavior is a hosting/billing decision for the user to
  make deliberately (Render's paid tier exists for exactly this), not
  something this PRD should silently design around.
- Multi-timeframe split screens, order-block heatmaps, drag-to-edit
  chart orders, hotkeys, voice commands, and the remaining items from the
  20-feature list are manual-trading UX ideas (5.1–5.10's domain, not
  5.11's) or speculative enough (voice-command trade execution) to need
  their own dedicated scoping conversation rather than a bulk add here.

---

## 6. Security

- API Key and Secret are **never** entered in the frontend and never pasted
  into any AI chat. They live only in a server-side `.env` file, read by the
  backend order service.
- Withdrawal permission must **never** be enabled on the Binance API key used
  by this app — Reading + Trading only.
- All signed requests to Binance happen server-side; the frontend only ever
  talks to this app's own backend.
- **Section 5.11's bot credentials are a separate secret set**, stored
  server-side the same way: the Freqtrade `api_server` username/password
  and `ws_token` for the Bybit bot must never reach the frontend bundle or
  an AI chat, and must not be reused as or confused with the Binance keys
  above — they authenticate to a different service entirely.
- **Section 5.11.5's Emergency Bot Controls send real state-changing
  commands** (`/api/v1/stop`, `/pause`, `/stopbuy`, `/start`,
  `/forceexit`) to the bot, unlike the rest of 5.11 which only reads. These
  requests must be proxied through this app's own backend using the
  server-side-stored bot credentials above — never called directly from
  the frontend with credentials exposed client-side — and every call must
  be logged server-side (who triggered it, when, which action) per
  5.11.5's audit-trail requirement.

---

## 7. Technical Architecture

- **Frontend:** Next.js (React), TypeScript, Tailwind CSS, Zustand for wallet/mode state.
- **Backend:** Node.js via Next.js API routes.
- **Exchange integration (manual trading, 5.1–5.10):** `ccxt` (Binance Spot + Futures).
- **Bot integration (monitoring only, 5.11):** Freqtrade REST API client (JWT
  login + Bearer-token GET requests against the user's own Bybit-bot
  deployment) plus its native `/api/v1/message/ws` WebSocket. This is a
  distinct integration from the Binance `ccxt` layer above — different
  exchange, different auth model, read-only.
- **Real-time data:** WebSocket subscriptions for chain prices and chart candles; user-data stream for order/fill events (see 5.4); separately, the Freqtrade WebSocket for 5.11's bot data.
- **Charts:** TradingView Lightweight Charts (shared by both the manual option-chain charts and 5.11's bot trade-detail chart).

---

## 8. Instructions for the Developer / Coding Assistant

1. Acknowledge this PRD and ask about anything that's ambiguous before writing code.
2. Propose the folder structure first (frontend routes/components, backend
   API routes, order-execution service module, currency-conversion utility,
   and a **fee/tax config module** per Section 5.3 — this should be a single
   source of truth both Live and Paper read from, per the parity requirement
   in 5.5, not duplicated logic in two places).
3. List the terminal commands to install all dependencies (`ccxt`, `lightweight-charts`, `zustand`, etc.).
4. Build in this order: (a) currency-conversion hook, (b) Home screen UI on
   mock/static data — the Crypto List (Level 1) and the expand-in-place
   Option Chain (Level 2) from 5.1 as one connected component, including
   list virtualization for the strike rows from the start (Section 9.7),
   since retrofitting virtualization onto an already-built unvirtualized
   list is significantly more rework than building it in from day one,
   (c) Bracket Order sheet UI including the fee/tax
   breakdown rows from 5.3, (d) backend order-execution service with the
   Spot/Futures logic in Section 5.4 and the live fee-rate fetch + configurable
   tax-rate logic from 5.3, (e) Paper Trading engine reusing the identical
   bracket-order math **and** the identical fee/tax module, (f) WebSocket
   wiring for live prices, (g) AI Advisor panel, (h) Portfolio screen with
   the gross-while-open / net-once-closed P&L distinction from 5.7, (i) the
   portfolio-summary/today's-P&L header from 5.8, (j) the trade-history list
   and detail view from 5.9, including the persisted-at-close data model it
   depends on, (k) the three Conditional Entry engines from 5.10 (Step Entry,
   Tick Analytics, Trailing Buy) as a selectable mode on the Bracket Order
   sheet from (c) — build this after (j), not before, since evaluating
   whether an engine is worth trusting depends on being able to review its
   fired trades in Trade History, and build it together with Section 9.6's
   hardening requirements (overlapping-tracker guard, background-tab
   timeout handling, survival across navigation/reconnect, the Tick
   Analytics divide-by-zero case, fired-vs-filled state) rather than as a
   separate pass afterward, since these are failure modes in the same code
   path, not add-ons to it.
   (l) the Bot Dashboard tab from 5.11 as its own module, isolated from
   the Binance order-execution code from (d) — build a small Freqtrade-API
   client service (login, token refresh-on-401, the five GET endpoints
   listed in 5.11) first, wire it to a settings screen for entering the
   bot's URL/credentials, then the Running/Closed trade cards, then the
   trade-detail view with chart. Build this after (j) (Trade History),
   since the closed-trades card layout and detail-view pattern from 5.9
   should be reused/adapted here rather than designed twice. (m) 5.11.6's
   equity-curve/win-loss charts, since they're computed client-side from
   data (l) already fetches — no new backend work. (n) 5.11.5's Emergency
   Bot Controls last within this section, deliberately after everything
   read-only is working and tested — these are the first *actionable*
   (state-changing) calls this dashboard tab makes, and should not ship
   until the monitoring path they depend on for context (knowing what
   you're pausing/force-exiting) is solid. (o) 5.11.7 (push notifications)
   and 5.11.8 (adaptive-SL chart overlay) as small independent additions
   once (l)-(n) are stable — neither blocks the other, and 5.11.8 further
   depends on the bot operator actually enabling `DASHBOARD_WEBHOOK_ENABLED`
   and pointing it at this app's backend (5.11.0 item 7), which is
   deployment work outside this app's own build sequence.
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
rate limits, stale data, and (per 9.6) the specific ways the 5.10 Conditional
Entry engines can misbehave — because a trading app that only works on the
happy path is not safe to use with real money. Each item below is a
**required** behavior, not a stretch goal.

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

### 9.6 Conditional Entry Engine Hardening

Section 5.10's three engines (Step Entry, Tick Analytics, Trailing Buy) are
new client-side state machines that watch the market and can fire a real
order on their own timeline, not on a direct user tap — that makes them a
different risk shape from the rest of the app, where every order traces back
to one Confirm press. Each item below is a specific way one of these
trackers can misbehave, and the required fix, so the failure is designed out
before the engines are built rather than discovered after a Live-money
mistake.

- **One armed tracker per instrument at a time.** Arming a second engine
  (or the same engine again) on a strike that already has a tracker running
  must not silently start a second, overlapping tracker — the UI must either
  block the second arm with a message ("Tracker already running on this
  strike — cancel it first") or explicitly replace the old one only after
  the user confirms the replacement. Two trackers racing on the same
  instrument, both able to fire independently, is the one condition most
  likely to produce a duplicate or contradictory order, and it is exactly
  the kind of thing that's easy to miss in v1 since it only shows up when
  the user is a little too fast on the UI.
- **Background/backgrounded-tab behavior is explicit, not accidental.**
  Mobile browsers throttle or fully suspend JS timers when the app is
  backgrounded or the screen locks — a `setTimeout`-based Timeout (5.10.1,
  5.10.3) or window-end check (5.10.2) can fire late, fire immediately in a
  batch on resume, or not fire at all, depending on the browser. The
  required behavior: on resume from background (`visibilitychange` /
  `pageshow`), the app must re-evaluate each armed tracker's actual
  elapsed-time-vs-timeout using a wall-clock timestamp captured at arm-time
  (not an interval counter that assumes it kept ticking), and immediately
  apply whichever outcome that comparison implies (fire, cancel-on-timeout,
  or keep waiting) — the tracker's fate must never depend on whether the
  tab happened to be visible when the deadline technically passed.
- **A tracker survives its own screen going away.** If the user navigates
  off the Option Chain or Bracket Order sheet while an engine is armed, the
  tracker must keep running (state lives above the component, e.g. in the
  Zustand store from Section 7, not inside a component that unmounts) —
  otherwise navigating away is an accidental, undocumented way to cancel a
  tracker the user still wanted running. Conversely, if the user explicitly
  cancels it, that must actually stop the WebSocket listener the tracker
  was using, not just hide its UI — an invisible tracker still evaluating
  ticks in the background is a silent-order risk of the same kind Section
  9.5 already treats as unacceptable for network calls.
- **A tracker's data does not survive a WebSocket drop unexamined.** If the
  price WebSocket disconnects while a tracker is armed (Section 9.1 already
  requires reconnect-with-resync for the app generally), the tracker's
  in-memory state built from ticks during the gap is now built on incomplete
  data — Tick Analytics' `upTicks`/`downTicks`/`avgJump`/`avgDrop` window
  and Trailing Buy's `lowestPrice` cannot be trusted to reflect what the
  market actually did while disconnected. On reconnect, each engine must
  either restart its window/tracking fresh from the reconnect point (safer
  default) or clearly flag to the user that its read spans a gap — it must
  not silently present a decision made from data with a hole in it as
  equivalent to one made from a complete window.
- **Empty or single-tick windows do not produce undefined math.** Tick
  Analytics (5.10.2) computes averages (`avgJump`, `avgDrop`) that are
  undefined by ordinary division if a window closes with zero up-ticks or
  zero down-ticks (a real possibility on an illiquid strike, or a very short
  Analysis Window) — this must be handled as an explicit case (e.g. treat a
  zero-count side as `0`, not as `NaN` propagating into the Buy/Cancel
  comparison), since a `NaN` reaching a `>` comparison in JavaScript
  silently evaluates to `false` and would make the engine behave as if a
  condition failed when it was actually just undefined — a decision made on
  bad math must never look identical to a normal Cancel outcome.
- **A fired engine is not the same thing as a filled order.** When any
  engine's condition is met, "fire" means it hands off to the exact same
  Bracket Order path as an Instant order (per 5.10's shared behavior) — and
  that handoff can itself fail for any of the ordinary reasons Section 9
  already covers: insufficient balance (5.2), a Binance rate limit (9.2), a
  network error (9.5), or a stale rate needing refresh first (9.4). The
  tracker's UI state must distinguish **"fired, order confirmed"** from
  **"fired, order attempt failed"** — a user glancing at the screen after a
  tracker fires must not be able to mistake "the engine decided to buy" for
  "the buy actually went through." On a fired-but-failed handoff, the
  engine's state should surface the same explicit failure messaging 9.5
  requires elsewhere, not revert silently to idle as if nothing happened.
- **Switching Paper/Live mid-arm is not allowed.** If the global Paper/Live
  toggle (5.5) is switched while a tracker is armed, the tracker must cancel
  itself rather than fire later against a different mode than the one the
  user was looking at when they armed it — firing a Paper-intended tracker
  into a real Live order (or vice versa) because the toggle changed
  underneath it is a mode-confusion risk distinct from, but as serious as,
  the Paper/Live visual-labeling requirement in 5.5.

### 9.7 Home Screen Scale — Unfiltered Strike Lists and Multi-Crypto Feeds

5.1 requires showing every crypto Binance lists options for, and every
strike within an expanded chain with no filtering. Both of those are
correct product requirements, but neither is safe to implement naively on a
phone — this section is the required engineering response to that scale,
not a suggestion to filter the data back down.

- **Strike list virtualization is required, not optional.** An expanded
  option chain can legitimately contain hundreds of strike rows (5.1). The
  chain must be rendered with a windowing/virtualization approach (only the
  rows currently scrolled into view — plus a small buffer — exist in the
  DOM at once) rather than mounting every strike row unconditionally. This
  applies independently of how many strikes the exchange happens to return
  for a given expiry — the UI must stay smooth whether that number is 40 or
  400, since 5.1 explicitly rules out capping the list to make this easier.
- **Level-1 Crypto List subscriptions are bounded by what's on screen, not
  by how many cryptos exist.** The Crypto List (5.1) needs a live spot
  price per row, but only rows actually visible in the viewport need an
  active WebSocket subscription at any moment — as the user scrolls the
  list, subscribe to newly-visible rows and unsubscribe rows that scroll
  out, mirroring the same subscribe/unsubscribe discipline 5.1 already
  requires when a chain is collapsed. This keeps the number of live feeds
  proportional to what's on screen even as the number of supported cryptos
  grows.
- **A slow or hung strike-level subscription must not freeze the whole
  chain.** If one strike's feed stalls (exchange-side issue, or the strike
  is simply illiquid and ticks rarely) while the chain is otherwise live,
  that row should show its own stale-data indicator (consistent with
  Section 4's connection-status treatment) rather than the entire expanded
  chain appearing frozen or the UI blocking on it — one bad feed among
  hundreds of subscribed strikes must degrade to a single row, not the
  whole screen.
- **Expanding a very large chain must not block the main thread.** Parsing
  and initial-rendering a large strike list (per the virtualization point
  above, this affects only first paint / scroll setup, not steady-state
  scrolling) should not visibly freeze the tap-to-expand interaction — if
  the underlying data fetch or initial layout takes a moment, the expanding
  row should show a loading state (per Section 9.5's empty/loading-state
  distinction) rather than the UI appearing unresponsive to the tap that
  triggered it.
