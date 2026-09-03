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

export function getOptionChain(symbol = "BTCUSDT"): OptionChainRow[] {
  const phase = marketPhase();
  const premiumPulse = Math.sin(phase / 2.4) * 1.8;
  return strikes.map((offset, index) => {
    const strike = 96_000 + offset;
    const distance = Math.abs(offset) / 1000;
    return {
      id: `${symbol}-${strike}`,
      strike,
      callLtp: Number(Math.max(0.01, 455 - distance * 48 + index * 2.5 + premiumPulse * (1 - distance / 4)).toFixed(2)),
      callChange: Number((2.9 - distance * 1.15 + Math.sin(phase / 3 + index) * 0.35).toFixed(2)),
      callVolume: Math.round(1280 - distance * 130 + index * 38 + Math.abs(Math.sin(phase / 3)) * 70),
      putLtp: Number(Math.max(0.01, 205 + distance * 38 - index * 1.8 + Math.cos(phase / 2.8 + index) * 1.4).toFixed(2)),
      putChange: Number((5.4 - distance * 1.1 + Math.cos(phase / 4 + index) * 0.35).toFixed(2)),
      putVolume: Math.round(960 - distance * 80 + index * 28 + Math.abs(Math.cos(phase / 3)) * 55),
      isAtm: offset === 0,
    };
  });
}