import React, { useState } from 'react';
import { BotClosedTrade } from './bot-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

interface BotClosedTradesProps {
  trades: BotClosedTrade[];
  currencyRate: number;
  onSelectTrade: (trade: BotClosedTrade) => void;
}

type FilterType = 'all' | 'win' | 'loss';

export function BotClosedTrades({
  trades,
  currencyRate,
  onSelectTrade,
}: BotClosedTradesProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [displayCount, setDisplayCount] = useState(15);

  const rate = currencyRate > 0 ? currencyRate : 86.5;

  const filteredTrades = trades
    .filter((trade) => {
      const isWin = (trade.close_profit ?? trade.profit_ratio ?? 0) >= 0;
      if (filter === 'win') return isWin;
      if (filter === 'loss') return !isWin;
      return true;
    })
    .sort((a, b) => {
      const timeA = a.close_timestamp || (a.close_date ? new Date(a.close_date).getTime() : 0);
      const timeB = b.close_timestamp || (b.close_date ? new Date(b.close_date).getTime() : 0);
      return sortAsc ? timeA - timeB : timeB - timeA;
    });

  const visibleTrades = filteredTrades.slice(0, displayCount);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center backdrop-blur-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No Closed Trades Yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          When the CROWN-v12 bot exits positions via Stop-Loss or Target, full trade records and exit reasons will appear here.
        </p>
      </div>
    );
  }

  const getExitReasonBadgeColor = (reason?: string) => {
    if (!reason) return 'border-border/60 bg-muted/40 text-muted-foreground';
    const lower = reason.toLowerCase();
    if (lower.includes('roi') || lower.includes('take_profit')) {
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500';
    }
    if (lower.includes('stop') || lower.includes('loss') || lower.includes('liquid')) {
      return 'border-rose-500/30 bg-rose-500/10 text-rose-500';
    }
    if (lower.includes('force') || lower.includes('emergency')) {
      return 'border-amber-500/30 bg-amber-500/10 text-amber-500';
    }
    return 'border-border/60 bg-muted/40 text-muted-foreground';
  };

  return (
    <div className="space-y-3">
      {/* Header & Filter Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Closed Trades History
          </h2>
          <span className="text-xs text-muted-foreground">
            Showing {visibleTrades.length} of {trades.length} recorded closed positions
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setFilter('win')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'win'
                  ? 'bg-emerald-500/20 text-emerald-500 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Wins
            </button>
            <button
              onClick={() => setFilter('loss')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === 'loss'
                  ? 'bg-rose-500/20 text-rose-500 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Losses
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 border-border/60 px-2 text-xs"
            onClick={() => setSortAsc(!sortAsc)}
            title="Sort direction"
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            {sortAsc ? 'Oldest' : 'Newest'}
          </Button>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-2">
        {visibleTrades.map((trade) => {
          const isLong = trade.side === 'LONG';
          const profitRatio = trade.close_profit ?? trade.profit_ratio ?? 0;
          const profitPct = (profitRatio * 100).toFixed(2);
          const profitAbsUSDT = trade.close_profit_abs ?? trade.profit_abs ?? 0;
          const profitAbsINR = profitAbsUSDT * rate;
          const isWin = profitAbsUSDT >= 0;

          const openPriceUSDT = trade.open_rate ?? 0;
          const exitPriceUSDT = trade.close_rate ?? trade.open_rate ?? 0;
          const openPriceINR = openPriceUSDT * rate;
          const exitPriceINR = exitPriceUSDT * rate;

          const openDate = trade.open_date ? new Date(trade.open_date) : null;
          const closeDate = trade.close_date ? new Date(trade.close_date) : null;

          let durationStr = '--';
          if (openDate && closeDate) {
            const diffMin = Math.max(0, Math.floor((closeDate.getTime() - openDate.getTime()) / 60000));
            const hours = Math.floor(diffMin / 60);
            const mins = diffMin % 60;
            durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          }

          return (
            <div
              key={trade.trade_id}
              onClick={() => onSelectTrade(trade)}
              className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3.5 sm:p-4 text-left shadow-xs transition hover:border-border hover:bg-card/80 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
            >
              {/* Left col: Side, Pair, Exit Reason & Date */}
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isWin ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {isWin ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0 text-[10px] font-bold uppercase ${
                        isLong
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {trade.side}
                    </Badge>
                    <span className="font-mono text-sm font-bold text-foreground">
                      {trade.pair}
                    </span>
                    {trade.exit_reason && (
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] capitalize ${getExitReasonBadgeColor(
                          trade.exit_reason
                        )}`}
                      >
                        {trade.exit_reason.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {durationStr}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {closeDate ? closeDate.toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle col: Prices */}
              <div className="flex items-center justify-between border-t border-border/30 pt-2 sm:border-0 sm:pt-0 sm:gap-6">
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground block">
                    Entry → Exit
                  </span>
                  <div className="font-mono text-xs text-foreground">
                    ₹{openPriceINR.toLocaleString('en-IN', { maximumFractionDigits: 1 })} → ₹
                    {exitPriceINR.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    ${openPriceUSDT.toLocaleString('en-US', { maximumFractionDigits: 3 })} → $
                    {exitPriceUSDT.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                  </div>
                </div>

                {/* Right col: Net P&L & Arrow */}
                <div className="text-right flex items-center gap-2">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground block">
                      Net P&L (INR)
                    </span>
                    <div
                      className={`font-mono text-sm font-bold ${
                        isWin ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isWin ? '+' : ''}₹{profitAbsINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`font-mono text-[11px] font-medium ${
                        isWin ? 'text-emerald-500/80' : 'text-rose-500/80'
                      }`}
                    >
                      {isWin ? '+' : ''}{profitPct}% ({isWin ? '+' : ''}${profitAbsUSDT.toFixed(2)})
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors hidden sm:block ml-1" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination / Load More */}
      {visibleTrades.length < filteredTrades.length && (
        <div className="pt-2 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDisplayCount((prev) => prev + 15)}
            className="border-border/60 text-xs"
          >
            Load More Trades ({filteredTrades.length - visibleTrades.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
