import { useMemo } from "react";
import type { MarketOverview, OptionChainRow } from "@workspace/api-client-react";

/**
 * Section 3 — Currency Handling: "A single `useCurrencyConverter` hook
 * multiplies incoming WebSocket/REST data by this rate before it reaches
 * any component. Components never see raw USD."
 *
 * Current state: `market-feed.ts` on the backend already generates its mock
 * spot price, option-chain premiums, and volumes directly in INR scale (not
 * real USD Binance data converted at request time — see the PRD-vs-codebase
 * gap analysis, item 1.1). So today this hook is a deliberate no-op pass
 * through: multiplying by 1, not by `currencyRate`, because the numbers
 * arriving are already the INR values the UI should show.
 *
 * This hook exists anyway, now, as the single seam Section 3 requires. Once
 * a real `ccxt`/Binance USD feed replaces the simulated market-feed service
 * (gap analysis 1.1), only `convertMarketOverview` and `convertOptionChain`
 * below need to change to actually multiply by `market.currencyRate` — no
 * component that calls this hook needs to change, and no component should
 * ever multiply by a currency rate itself.
 */

export type CurrencyConvertedMarket = MarketOverview;
export type CurrencyConvertedChainRow = OptionChainRow;

function convertMarketOverview(market: MarketOverview): CurrencyConvertedMarket {
  // No-op today (see file header). When the upstream feed starts returning
  // raw USD, this becomes:
  //   spotPrice: market.spotPrice * market.currencyRate,
  // and any other USD-denominated field on MarketOverview.
  return market;
}

function convertOptionChain(chain: OptionChainRow[]): CurrencyConvertedChainRow[] {
  // No-op today (see file header). When the upstream feed starts returning
  // raw USD, each per-strike price field (callLtp, putLtp — not volumes,
  // which are unit counts, not currency) gets multiplied by the same rate
  // used in convertMarketOverview, so a single rate is never applied twice
  // or applied inconsistently across strikes.
  return chain;
}

/**
 * Converts a market snapshot and option chain to the currency the UI should
 * render, exactly once, in this one place. Every component that displays a
 * price — the chain table, the bracket order sheet, the portfolio P&L —
 * should consume the output of this hook rather than the raw query/WebSocket
 * data directly.
 */
export function useCurrencyConverter(
  market: MarketOverview,
  chain: OptionChainRow[],
): { market: CurrencyConvertedMarket; chain: CurrencyConvertedChainRow[] } {
  const convertedMarket = useMemo(() => convertMarketOverview(market), [market]);
  const convertedChain = useMemo(() => convertOptionChain(chain), [chain]);
  return { market: convertedMarket, chain: convertedChain };
}
