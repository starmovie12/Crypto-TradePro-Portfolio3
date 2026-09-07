import type { MarketOverview, OptionChainRow } from "@workspace/api-zod";

const startedAt = Date.now();
const strikes = [-2000, -1000, 0, 1000, 2000, 3000];

function marketPhase() {
  return (Date.now() - startedAt) / 1000;
}

export function getMarketOverview(currencyRate: number, connectionState: MarketOverview["connectionState"] = "connected") {
  const phase = marketPhase();
  const spotPrice = 8_142_360 + Math.sin(phase / 18) * 8_500 + Math.sin(phase / 4.5) * 1_250;
  return {
    spotPrice: Number(spotPrice.toFixed(2)),
    change24h: Number((2.84 + Math.sin(phase / 20) * 0.36).toFixed(2)),
    volume24h: 1_840_000_000,
    fundingRate: Number((0.0112 + Math.sin(phase / 16) * 0.0015).toFixed(4)),
    currencyRate: Number(currencyRate.toFixed(4)),
    lastUpdated: new Date().toISOString(),
    connectionState,
  };
}

/**
 * Section 5.1 requires "every underlying Binance lists options for," fetched
 * from `ccxt`'s options-market listing rather than hardcoded. There is no
 * `ccxt` connection in this backend yet (see the PRD-vs-codebase gap
 * analysis, item 1.1), so this remains a simulated chain — but until that
 * connection exists, a `symbol` this function receives should at least
 * produce a genuinely different chain, not the same BTC numbers relabeled.
 * `symbolProfile` is the seam a real ccxt-backed per-symbol fetch replaces
 * later; the shape below is not meant to be realistic per-crypto pricing,
 * only distinguishable mock data so a multi-crypto Home Screen has
 * something real to render against while 1.1 is unbuilt.
 */
const symbolProfiles: Record<string, { baseStrike: number; scale: number }> = {
  BTCUSDT: { baseStrike: 96_000, scale: 1 },
  ETHUSDT: { baseStrike: 3_400, scale: 0.045 },
  SOLUSDT: { baseStrike: 145, scale: 0.0022 },
  BNBUSDT: { baseStrike: 560, scale: 0.008 },
};

function profileFor(symbol: string) {
  return symbolProfiles[symbol.toUpperCase()] ?? symbolProfiles.BTCUSDT;
}

export function getOptionChain(symbol = "BTCUSDT"): OptionChainRow[] {
  const phase = marketPhase();
  const premiumPulse = Math.sin(phase / 2.4) * 1.8;
  const { baseStrike, scale } = profileFor(symbol);
  return strikes.map((offset, index) => {
    const strike = Math.round(baseStrike + offset * scale);
    const distance = Math.abs(offset) / 1000;
    return {
      id: `${symbol}-${strike}`,
      strike,
      callLtp: Number(Math.max(0.01, (455 - distance * 48 + index * 2.5 + premiumPulse * (1 - distance / 4)) * scale).toFixed(2)),
      callChange: Number((2.9 - distance * 1.15 + Math.sin(phase / 3 + index) * 0.35).toFixed(2)),
      callVolume: Math.round(1280 - distance * 130 + index * 38 + Math.abs(Math.sin(phase / 3)) * 70),
      putLtp: Number(Math.max(0.01, (205 + distance * 38 - index * 1.8 + Math.cos(phase / 2.8 + index) * 1.4) * scale).toFixed(2)),
      putChange: Number((5.4 - distance * 1.1 + Math.cos(phase / 4 + index) * 0.35).toFixed(2)),
      putVolume: Math.round(960 - distance * 80 + index * 28 + Math.abs(Math.cos(phase / 3)) * 55),
      isAtm: offset === 0,
    };
  });
}

/**
 * Section 5.1's Crypto List (Level 1) needs every underlying Binance lists
 * options for. This is the mock stand-in for that listing until `ccxt`'s
 * options-market listing replaces it — a fixed array here is the same kind
 * of hardcoding Section 5.1 explicitly warns against long-term, but it's
 * what lets a Crypto List component exist at all before 1.1 is built.
 */
export function getSupportedSymbols(): string[] {
  return Object.keys(symbolProfiles);
}
