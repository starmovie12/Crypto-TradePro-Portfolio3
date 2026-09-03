import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type PersistedClosedTrade = {
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

const historyPath = resolve(
  process.env.TRADEPRO_HISTORY_FILE?.trim() || "data/trade-history.json",
);

function isPersistedClosedTrade(value: unknown): value is PersistedClosedTrade {
  if (!value || typeof value !== "object") return false;
  const trade = value as Partial<PersistedClosedTrade>;
  return typeof trade.id === "string"
    && typeof trade.instrument === "string"
    && (trade.side === "CE" || trade.side === "PE")
    && typeof trade.entryPrice === "number"
    && typeof trade.exitPrice === "number"
    && typeof trade.quantity === "number"
    && typeof trade.entryFee === "number"
    && typeof trade.exitFee === "number"
    && typeof trade.taxWithheld === "number"
    && typeof trade.netPnl === "number"
    && typeof trade.estimatedTakeHome === "number"
    && typeof trade.closedAt === "string"
    && (trade.exitReason === "manual" || trade.exitReason === "target-hit" || trade.exitReason === "stop-hit");
}

export function loadTradeHistory(): PersistedClosedTrade[] {
  try {
    const raw = readFileSync(historyPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPersistedClosedTrade) : [];
  } catch {
    return [];
  }
}

export function saveTradeHistory(history: PersistedClosedTrade[]) {
  try {
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");
  } catch {
    // A close is still valid for this process if the optional local store is
    // unavailable; the API continues to return the recorded in-memory entry.
  }
}