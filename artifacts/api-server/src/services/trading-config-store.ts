import { loadTradeProConfig } from "../config/tradepro-config";

type CurrencySource = "live" | "fallback";

type TradingConfigSnapshot = {
  currencyRate: number;
  currencyFetchedAt: string;
  currencySource: CurrencySource;
  feeRate: number;
  feeFetchedAt: string;
  feeSource: "exchange" | "fallback";
  vdaTaxRate: number;
  tdsRate: number;
  taxUpdatedAt: string;
  taxSource: string;
};

const config = loadTradeProConfig();
let snapshot: TradingConfigSnapshot = {
  currencyRate: config.currency.fallbackUsdInrRate ?? 83.42,
  currencyFetchedAt: new Date().toISOString(),
  currencySource: "fallback",
  feeRate: config.feeRate?.rate ?? 0.001,
  feeFetchedAt: config.feeRate?.fetchedAt ?? new Date().toISOString(),
  feeSource: config.feeRate?.source ?? "fallback",
  vdaTaxRate: config.taxConfig?.vdaTaxRate ?? 0.3,
  tdsRate: config.taxConfig?.tdsRate ?? 0.01,
  taxUpdatedAt: config.taxConfig?.updatedAt ?? new Date().toISOString(),
  taxSource: config.taxConfig?.source ?? "configured estimate",
};

let currencyRefreshPromise: Promise<void> | undefined;
const currencyTtlMs = config.currency.maxAgeMs;
const feeTtlMs = config.feeRate?.staleAfterMs ?? 5 * 60 * 1000;

export async function refreshCurrencyRate(force = false) {
  const age = Date.now() - new Date(snapshot.currencyFetchedAt).getTime();
  if (!force && age <= currencyTtlMs) return snapshot;
  if (currencyRefreshPromise) {
    await currencyRefreshPromise;
    return snapshot;
  }
  currencyRefreshPromise = (async () => {
    try {
      const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error(`FX provider returned ${response.status}`);
      const data = (await response.json()) as { rates?: { INR?: number } };
      const rate = data.rates?.INR;
      if (!rate || !Number.isFinite(rate) || rate <= 0) throw new Error("FX provider returned an invalid INR rate");
      snapshot = { ...snapshot, currencyRate: rate, currencyFetchedAt: new Date().toISOString(), currencySource: "live" };
    } catch {
      const fallback = config.currency.fallbackUsdInrRate;
      if (fallback) {
        snapshot = { ...snapshot, currencyRate: fallback, currencyFetchedAt: new Date().toISOString(), currencySource: "fallback" };
      }
    } finally {
      currencyRefreshPromise = undefined;
    }
  })();
  await currencyRefreshPromise;
  return snapshot;
}

export function refreshFeeRate(force = false) {
  const age = Date.now() - new Date(snapshot.feeFetchedAt).getTime();
  if (force || age > feeTtlMs) {
    snapshot = { ...snapshot, feeFetchedAt: new Date().toISOString(), feeSource: "fallback" };
  }
  return snapshot;
}

export function getTradingConfig() {
  return snapshot;
}

export function updateTaxConfig(input: { vdaTaxRate: number; tdsRate: number }) {
  if (!Number.isFinite(input.vdaTaxRate) || input.vdaTaxRate < 0 || input.vdaTaxRate > 1) {
    throw new Error("VDA tax rate must be between 0 and 1");
  }
  if (!Number.isFinite(input.tdsRate) || input.tdsRate < 0 || input.tdsRate > 1) {
    throw new Error("TDS rate must be between 0 and 1");
  }
  snapshot = {
    ...snapshot,
    vdaTaxRate: input.vdaTaxRate,
    tdsRate: input.tdsRate,
    taxUpdatedAt: new Date().toISOString(),
    taxSource: "user-configured estimate",
  };
  return snapshot;
}