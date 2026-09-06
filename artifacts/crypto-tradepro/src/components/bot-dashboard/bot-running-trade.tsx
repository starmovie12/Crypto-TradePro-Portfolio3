import React, { useState } from 'react';
import { BotRunningTrade as BotRunningTradeType, StrategyWebhookData } from './bot-types';
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
  ChevronRight,
} from 'lucide-react';

interface BotRunningTradeProps {
  trade: BotRunningTradeType | null;
  currencyRate: number;
  strategyData?: StrategyWebhookData;
  onSelectTrade: (trade: BotRunningTradeType) => void;
  onForceExit: (tradeId: number | string, pair: string) => void;
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
  const [confirmExit, setConfirmExit] = useState(false);

  if (!trade) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mx-auto mb-3 text-muted-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No Active Bot Position</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          CROWN-v12 bot (Bybit Futures Testnet) is scanning the 30-pair whitelist. Max open trades is set to 1.
        </p>
      </div>
    );
  }

  const isLong = trade.side === 'LONG';
  const currentRate = currencyRate > 0 ? currencyRate : 86.5;

  const entryPriceUSDT = trade.open_rate ?? 0;
  const currentPriceUSDT = trade.current_rate ?? entryPriceUSDT;
  const entryPriceINR = entryPriceUSDT * currentRate;
  const currentPriceINR = currentPriceUSDT * currentRate;

  // Profit calculation
  const profitRatio = trade.profit_ratio ?? 0;
  const profitPct = (profitRatio * 100).toFixed(2);
  const profitAbsUSDT =
    trade.profit_abs ??
    (currentPriceUSDT - entryPriceUSDT) * (trade.amount ?? 0) * (isLong ? 1 : -1);
  const profitAbsINR = profitAbsUSDT * currentRate;
  const isProfit = profitAbsUSDT >= 0;

  // Duration
  const openTime = trade.open_timestamp || (trade.open_date ? new Date(trade.open_date).getTime() : Date.now());
  const now = Date.now();
  const minutesOpen = Math.max(0, Math.floor((now - openTime) / (1000 * 60)));
  const hoursOpen = Math.floor(minutesOpen / 60);
  const remMinutes = minutesOpen % 60;
  const durationStr = hoursOpen > 0 ? `${hoursOpen}h ${remMinutes}m` : `${remMinutes}m`;

  const regime = strategyData?.regime;
  const adaptiveSl =
    strategyData?.final_checkpoint_sl ??
    strategyData?.checkpoint_sl ??
    strategyData?.entry_adaptive_sl;

  return (
    <div
      onClick={() => onSelectTrade(trade)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-primary/30 bg-card p-4 sm:p-5 shadow-sm transition hover:border-primary/60 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge
            variant="outline"
            className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              isLong
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-500'
            }`}
          >
            {isLong ? <TrendingUp className="mr-1 h-3 w-3 inline" /> : <TrendingDown className="mr-1 h-3 w-3 inline" />}
            {trade.side}
          </Badge>
          <span className="font-mono text-base font-bold text-foreground">{trade.pair}</span>
          <Badge variant="secondary" className="font-mono text-[10px] text-muted-foreground uppercase">
            Bybit Futures
          </Badge>
          {regime && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] font-mono">
              Regime: {regime}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Clock className="h-3.5 w-3.5" />
          <span>{durationStr}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors ml-1" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Entry Price</span>
          <span className="font-mono text-sm font-semibold text-foreground block">
            ₹{entryPriceINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block">
            ${entryPriceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Current Price</span>
          <span className="font-mono text-sm font-semibold text-foreground block">
            ₹{currentPriceINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block">
            ${currentPriceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Unrealized P&L</span>
          <span
            className={`font-mono text-sm font-bold flex items-center gap-1 ${
              isProfit ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {isProfit ? '+' : ''}₹{profitAbsINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            <span className="text-xs">({isProfit ? '+' : ''}{profitPct}%)</span>
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block">
            {isProfit ? '+' : ''}${profitAbsUSDT.toFixed(2)} USDT
          </span>
        </div>

        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Stake Amount</span>
          <span className="font-mono text-sm font-semibold text-foreground block">
            ₹{((trade.stake_amount ?? 0) * currentRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block">
            ${(trade.stake_amount ?? 0).toFixed(2)} USDT
          </span>
        </div>
      </div>

      {adaptiveSl !== undefined && (
        <div className="mt-3.5 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          <span>Adaptive Stop-Loss Trigger:</span>
          <span className="font-mono font-semibold text-foreground">
            ${adaptiveSl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (₹
            {(adaptiveSl * currentRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })})
          </span>
        </div>
      )}

      <div
        className="mt-4 flex items-center justify-between border-t border-border/40 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] text-muted-foreground">
          Trade #{trade.trade_id} • Max Open Trades: 1
        </span>

        {confirmExit ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-rose-500">Confirm Force Exit?</span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-3 text-xs"
              disabled={isActionLoading}
              onClick={() => {
                onForceExit(trade.trade_id, trade.pair);
                setConfirmExit(false);
              }}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmExit(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 text-xs gap-1.5"
            onClick={() => setConfirmExit(true)}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Force Exit Position
          </Button>
        )}
      </div>
    </div>
  );
}
