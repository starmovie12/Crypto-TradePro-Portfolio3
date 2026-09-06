import React from 'react';
import { BotTrade, StrategyWebhookData } from './bot-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  ShieldAlert,
  ArrowRightLeft,
  Activity,
  AlertOctagon,
} from 'lucide-react';

interface BotRunningTradeProps {
  trade: BotTrade | null;
  currencyRate: number;
  strategyData?: StrategyWebhookData;
  onSelectTrade: (trade: BotTrade) => void;
  onForceExit: (tradeId: number, pair: string) => void;
  isActionLoading?: boolean;
}

export function BotRunningTrade({
  trade,
  currencyRate,
  strategyData,
  onSelectTrade,
  onForceExit,
  isActionLoading = false,
}: BotRunningTradeProps) {
  if (!trade) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 mx-auto mb-3 text-muted-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No Active Bot Position</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          CROWN-v12 bot (Bybit Futures Testnet) is scanning the 30-pair whitelist. Max open trades is set to 1.
        </p>
      </div>
    );
  }

  const isLong = trade.is_short === false;
  const currentRate = currencyRate > 0 ? currencyRate : 86.5;

  const entryPriceUSDT = trade.open_rate ?? 0;
  const currentPriceUSDT = trade.current_rate ?? entryPriceUSDT;
  const entryPriceINR = entryPriceUSDT * currentRate;
  const currentPriceINR = currentPriceUSDT * currentRate;

  // Profit calculation
  const profitRatio = trade.profit_ratio ?? 0;
  const profitPct = (profitRatio * 100).toFixed(2);
  const profitAbsUSDT = trade.profit_abs ?? (currentPriceUSDT - entryPriceUSDT) * (trade.amount ?? 0) * (isLong ? 1 : -1);
  const profitAbsINR = profitAbsUSDT * currentRate;
  const isProfit = profitAbsUSDT >= 0;

  // Duration
  const openTime = new Date(trade.open_date).getTime();
  const now = Date.now();
  const minutesOpen = Math.max(0, Math.floor((now - openTime) / (1000 * 60)));
  const hoursOpen = Math.floor(minutesOpen / 60);
  const remMinutes = minutesOpen % 60;
  const durationStr = hoursOpen > 0 ? `${hoursOpen}h ${remMinutes}m` : `${remMinutes}m`;

  const regime = strategyData?.regime;
  const adaptiveSl = strategyData?.final_checkpoint_sl ?? strategyData?.checkpoint_sl ?? strategyData?.entry_adaptive_sl;

  return (
    <div
      onClick={() => onSelectTrade(trade)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-primary/30 bg-card p-4 sm:p-5 shadow-sm transition hover:border-primary/60 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <Badge
            variant="outline"
            className={`px-2.5 py-0