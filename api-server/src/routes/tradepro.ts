import { Router, type IRouter } from "express";
import {
  AddFundsBody,
  AddFundsResponse,
  CloseAllPositionsResponse,
  ClosePositionParams,
  ClosePositionResponse,
  CreatePaperOrderBody,
  CreatePaperOrderResponse,
  GetAdvisorRecommendationsResponse,
  GetMarketOverviewResponse,
  GetOptionChainQueryParams,
  GetOptionChainResponse,
  GetPortfolioResponse,
} from "@workspace/api-zod";
import { getMarketOverview, getOptionChain } from "../services/market-feed";
import { getTradingConfig, refreshCurrencyRate, refreshFeeRate } from "../services/trading-config-store";
import { calculateTradeCosts } from "../services/fee-tax-config";
import { loadTradeHistory, saveTradeHistory } from "../services/trade-history-store";

type Position = {
  id: string;
  instrument: string;
  side: "CE" | "PE";
  entryPrice: number;
  livePrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  targetPrice: number;
  stopPrice: number;
  status: "open" | "target-hit" | "stop-hit" | "closed";
};

type Activity = {
  id: string;
  type: string;
  instrument: string;
  price: number;
  quantity: number;
  timestamp: string;
};

type ClosedTrade = {
  id: string;
  instrument: string;
  side: "CE" | "PE";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryFee: number;
  exitFee: number;
  taxWithheld: number;
  netPnl: number;
  estimatedTakeHome: number;
  closedAt: string;
  exitReason: "manual" | "target-hit" | "stop-hit";
};

const router: IRouter = Router();
// wallet.balance = settled paper funds (deposits + realized P&L from closed
// trades), not yet reduced by capital locked in open positions.
// wallet.marginUsed = capital currently committed to open positions
// (entryPrice * quantity * 100 per position, summed).
// availableBalance shown to the UI is always wallet.balance - wallet.marginUsed.
const wallet = {
  balance: 250_000,
  marginUsed: 205 * 0.02 * 100 * 1.001, // entry notional plus the configured entry fee
};

const positions: Position[] = [
  {
    id: "pos-btc-pe-01",
    instrument: "BTC 96,000 PE",
    side: "PE",
    entryPrice: 205,
    livePrice: 219.4,
    quantity: 0.02,
    pnl: 28.8,
    pnlPercent: 7.02,
    targetPrice: 215.25,
    stopPrice: 164,
    status: "open",
  },
];

const activity: Activity[] = [
  {
    id: "act-1",
    type: "Paper buy",
    instrument: "BTC 96,000 PE",
    price: 205,
    quantity: 0.02,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "act-2",
    type: "Mock funds added",
    instrument: "INR wallet",
    price: 250000,
    quantity: 1,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

const history: ClosedTrade[] = loadTradeHistory();
const idempotentOrders = new Map<string, Position>();
let realizedPnl = 0;

function availableBalance() {
  return Math.max(0, wallet.balance - wallet.marginUsed);
}

function openPositions() {
  return positions.filter((position) => position.status === "open");
}

function settlePosition(position: Position, status: "closed" | "target-hit" | "stop-hit" = "closed") {
  const marginForPosition = position.entryPrice * position.quantity * 100;
  const config = getTradingConfig();
  const costs = calculateTradeCosts({
    entryPrice: position.entryPrice,
    exitPrice: position.livePrice,
    quantity: position.quantity,
    contractMultiplier: 100,
    feeRate: {
      rate: config.feeRate,
      source: config.feeSource,
      fetchedAt: config.feeFetchedAt,
      staleAfterMs: 5 * 60 * 1000,
    },
    taxConfig: {
      vdaTaxRate: config.vdaTaxRate,
      tdsRate: config.tdsRate,
      updatedAt: config.taxUpdatedAt,
      source: config.taxSource,
    },
  });
  // Open P&L becomes settled balance only after an exit is confirmed.
  // The realized balance is net of both exchange legs; tax remains an
  // informational estimate and is not treated as an exchange deduction.
  realizedPnl += costs.netPnlBeforeTax;
  wallet.balance += costs.netPnlBeforeTax;
  wallet.marginUsed = Math.max(0, wallet.marginUsed - marginForPosition - costs.entryFee);
  position.status = status;
  history.unshift({
    id: `history-${position.id}-${Date.now()}`,
    instrument: position.instrument,
    side: position.side,
    entryPrice: costs.entryNotional / (position.quantity * 100),
    exitPrice: costs.exitNotional / (position.quantity * 100),
    quantity: position.quantity,
    entryFee: costs.entryFee,
    exitFee: costs.exitFee,
    taxWithheld: Number((costs.estimatedVdaTax + costs.estimatedTds).toFixed(2)),
    netPnl: costs.netPnlBeforeTax,
    estimatedTakeHome: costs.estimatedTakeHome,
    closedAt: new Date().toISOString(),
    exitReason: status === "closed" ? "manual" : status,
  });
  saveTradeHistory(history);
}

function portfolioSnapshot(closeFailures: Array<{ id: string; instrument: string; reason: string }> = []) {
  const currentPositions = openPositions();
  const marketValue = currentPositions.reduce(
    (sum, position) => sum + position.livePrice * position.quantity * 100,
    0,
  );
  return {
    walletBalance: Number(wallet.balance.toFixed(2)),
    availableBalance: Number(availableBalance().toFixed(2)),
    totalPnl: Number(currentPositions.reduce((sum, position) => sum + position.pnl, 0).toFixed(2)),
    totalPortfolioValue: Number((availableBalance() + marketValue).toFixed(2)),
    realizedPnl: Number(realizedPnl.toFixed(2)),
    positions: currentPositions,
    activity,
    history,
    ...(closeFailures.length > 0 ? { closeFailures } : {}),
  };
}

export function refreshPaperQuotes(chain = getOptionChain()) {
  // This runs on every WebSocket tick (see trading-websocket.ts), not just on
  // an HTTP request, so it cannot rely on a route handler having refreshed
  // the fee rate first. Without this, a bracket firing after >5 minutes of
  // no API traffic hits calculateTradeCosts' stale-rate guard and throws
  // inside a bare setInterval callback, which crashes the whole process.
  refreshFeeRate();
  const settledPositions: Position[] = [];
  positions.forEach((position) => {
    if (position.status !== "open") return;
    const row = chain.find((item) => item.strike === Number(position.instrument.match(/[\d,]+/)?.[0]?.replaceAll(",", "")));
    const livePrice = row ? (position.side === "CE" ? row.callLtp : row.putLtp) : position.livePrice;
    position.livePrice = Number(Math.max(0.01, livePrice).toFixed(2));
    position.pnl = Number(((position.livePrice - position.entryPrice) * position.quantity * 100).toFixed(2));
    position.pnlPercent = Number(
      (((position.livePrice - position.entryPrice) / position.entryPrice) * 100).toFixed(2),
    );
    const hitTarget = position.livePrice >= position.targetPrice;
    const hitStop = position.livePrice <= position.stopPrice;
    if (hitTarget || hitStop) {
      const status = hitTarget ? "target-hit" : "stop-hit";
      try {
        // Isolated per position: one bad settlement (e.g. a config edge case)
        // must not abort the loop and silently skip marking every other open
        // position for this tick, and must not throw back into the shared
        // setInterval in trading-websocket.ts and take the process down.
        settlePosition(position, status);
        activity.unshift({
          id: `${status}-${position.id}-${Date.now()}`,
          type: hitTarget ? "Paper target filled" : "Paper stop filled",
          instrument: position.instrument,
          price: position.livePrice,
          quantity: position.quantity,
          timestamp: new Date().toISOString(),
        });
        settledPositions.push({ ...position });
      } catch {
        // Left open; the same target/stop condition is re-evaluated (and
        // settlement retried) on the next tick 350ms later.
      }
    }
  });
  return settledPositions;
}

router.get("/market/overview", async (_req, res) => {
  await refreshCurrencyRate();
  refreshFeeRate();
  const config = getTradingConfig();
  res.json(
    GetMarketOverviewResponse.parse(getMarketOverview(config.currencyRate)),
  );
});

router.get("/market/option-chain", (req, res) => {
  const params = GetOptionChainQueryParams.parse(req.query);
  res.json(GetOptionChainResponse.parse(getOptionChain(params.symbol ?? "BTCUSDT")));
});

router.get("/portfolio", (_req, res) => {
  refreshFeeRate();
  refreshPaperQuotes();
  res.json(GetPortfolioResponse.parse(portfolioSnapshot()));
});

router.post("/portfolio/positions/:id/close", (req, res) => {
  refreshPaperQuotes();
  refreshFeeRate();
  const { id } = ClosePositionParams.parse(req.params);
  const position = positions.find((item) => item.id === id);
  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  if (position.status !== "open") {
    res.status(409).json({ error: "Position already closed" });
    return;
  }
  // Realize this position's P&L into the settled balance and release its margin.
  settlePosition(position);
  const closed = {
    id: `close-${Date.now()}`,
    type: "Paper close",
    instrument: position.instrument,
    price: position.livePrice,
    quantity: position.quantity,
    timestamp: new Date().toISOString(),
  };
  activity.unshift(closed);
  res.json(
    ClosePositionResponse.parse({
      ...closed,
    }),
  );
});

router.post("/portfolio/close-all", (_req, res) => {
  refreshPaperQuotes();
  refreshFeeRate();
  const now = new Date().toISOString();
  const closeFailures: Array<{ id: string; instrument: string; reason: string }> = [];
  positions.forEach((position) => {
    if (position.status === "open") {
      try {
        // Realize each position's P&L into the settled balance and release its margin.
        settlePosition(position);
        activity.unshift({
          id: `close-${position.id}`,
          type: "Paper close all",
          instrument: position.instrument,
          price: position.livePrice,
          quantity: position.quantity,
          timestamp: now,
        });
      } catch (error) {
        closeFailures.push({
          id: position.id,
          instrument: position.instrument,
          reason: error instanceof Error ? error.message : "Unknown settlement error",
        });
      }
    }
  });
  res.json(CloseAllPositionsResponse.parse(portfolioSnapshot(closeFailures)));
});

router.post("/portfolio/add-funds", (req, res) => {
  const body = AddFundsBody.parse(req.body);
  if (openPositions().length > 0) {
    res.status(409).json({ error: "Close all open paper positions before editing the mock balance" });
    return;
  }
  wallet.balance = body.amount;
  activity.unshift({
    id: `funds-${Date.now()}`,
    type: "Mock balance set",
    instrument: "INR wallet",
    price: wallet.balance,
    quantity: 1,
    timestamp: new Date().toISOString(),
  });
  res.json(
    AddFundsResponse.parse({
      walletBalance: wallet.balance,
      availableBalance: availableBalance(),
    }),
  );
});

router.get("/advisor/recommendations", (_req, res) => {
  res.json(
    GetAdvisorRecommendationsResponse.parse([
      {
        id: "idea-1",
        title: "Momentum setup detected",
        body: "BTC 96,000 PE is holding above its intraday VWAP with rising volume. A 5% target has a favorable risk profile while spot stays above ₹8.10L.",
        instrument: "BTC 96,000 PE",
        strike: 96000,
        direction: "bullish",
        confidence: 82,
        createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
      },
      {
        id: "idea-2",
        title: "Watch the call wall",
        body: "Open interest is building around BTC 98,000 CE. Wait for a clean breakout and avoid chasing if volume fades below the first hour average.",
        instrument: "BTC 98,000 CE",
        strike: 98000,
        direction: "neutral",
        confidence: 68,
        createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
      },
    ]),
  );
});

router.post("/orders/paper", (req, res) => {
  const body = CreatePaperOrderBody.parse(req.body);
  const clientOrderId = req.get("Idempotency-Key") ?? body.clientOrderId;
  if (clientOrderId) {
    const priorOrder = idempotentOrders.get(clientOrderId);
    if (priorOrder) {
      res.status(200).json(CreatePaperOrderResponse.parse(priorOrder));
      return;
    }
  }
  if (body.entryPrice <= 0 || body.quantity <= 0 || body.targetPercent <= 0 || body.stopPercent <= 0) {
    res.status(400).json({ error: "Entry, quantity, target, and stop must be positive values" });
    return;
  }
  refreshFeeRate();
  const config = getTradingConfig();
  const orderCost = body.entryPrice * body.quantity * 100;
  const entryFee = orderCost * config.feeRate;
  const available = wallet.balance - wallet.marginUsed;
  if (orderCost + entryFee > available) {
    res.status(422).json({ error: "Insufficient available balance for this order" });
    return;
  }
  wallet.marginUsed += orderCost + entryFee;
  const targetPrice = Number((body.entryPrice * (1 + body.targetPercent / 100)).toFixed(2));
  const stopPrice = Number((body.entryPrice * (1 - body.stopPercent / 100)).toFixed(2));
  const position = {
    id: `pos-${Date.now()}`,
    instrument: body.instrument,
    side: body.side,
    entryPrice: body.entryPrice,
    livePrice: body.entryPrice,
    quantity: body.quantity,
    pnl: 0,
    pnlPercent: 0,
    targetPrice,
    stopPrice,
    status: "open" as const,
  };
  positions.unshift(position);
  if (clientOrderId) idempotentOrders.set(clientOrderId, position);
  activity.unshift({
    id: `act-${Date.now()}`,
    type: "Paper buy",
    instrument: body.instrument,
    price: body.entryPrice,
    quantity: body.quantity,
    timestamp: new Date().toISOString(),
  });
  res.status(201).json(CreatePaperOrderResponse.parse(position));
});

export default router;
