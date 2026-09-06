import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BotTrade,
  BotRunningTrade as BotRunningTradeType,
  BotClosedTrade,
  BotBalance,
  BotProfit,
  BotConnectionState,
  StrategyWebhookData,
  EmergencyActionType,
} from './bot-types';
import { BotRunningTrade } from './bot-running-trade';
import { BotClosedTrades } from './bot-closed-trades';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  PieChart,
  Shield,
  Clock,
  ExternalLink,
  Sliders,
  DollarSign,
  AlertOctagon,
  Layers,
  X,
  Radio,
  CheckCircle2,
  Lock,
  Server,
  Zap,
  Play,
  Pause,
  Square,
  Ban,
} from 'lucide-react';

interface BotSignalsTabProps {
  currencyRate: number;
  onOpenSettings?: () => void;
}

export function BotSignalsTab({
  currencyRate,
  onOpenSettings,
}: BotSignalsTabProps) {
  // Connection state & credentials
  const [connectionState, setConnectionState] = useState<BotConnectionState>('not_configured');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dbResetWarning, setDbResetWarning] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Bot live data
  const [runningTrade, setRunningTrade] = useState<BotRunningTradeType | null>(null);
  const [closedTrades, setClosedTrades] = useState<BotClosedTrade[]>([]);
  const [balance, setBalance] = useState<BotBalance | null>(null);
  const [profit, setProfit] = useState<BotProfit | null>(null);
  const [strategyData, setStrategyData] = useState<StrategyWebhookData | undefined>(undefined);
  const [botState, setBotState] = useState<string>('running');

  // Selected trade for detail modal (Section 5.11.2)
  const [selectedTrade, setSelectedTrade] = useState<BotTrade | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModal, setActionModal] = useState<EmergencyActionType | null>(null);

  // Notification tracking ref (Section 5.11.7)
  const prevRunningTradeIdRef = useRef<number | string | null>(null);
  const prevClosedTradesCountRef = useRef<number | null>(null);
  const prevTotalTradesCountRef = useRef<number | null>(null);

  const rate = currencyRate > 0 ? currencyRate : 86.5;

  // Check initial credentials config
  useEffect(() => {
    const savedUrl = localStorage.getItem('freqtrade_api_url');
    if (!savedUrl) {
      setConnectionState('not_configured');
    } else {
      fetchBotData();
    }
  }, []);

  // Request browser notification permissions on mount (Section 5.11.7)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  const sendBrowserNotification = (title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (err) {
        console.warn('Notification error:', err);
      }
    }
  };

  // Primary 5-second polling loop per Section 5.11.1
  useEffect(() => {
    if (connectionState === 'not_configured') return;

    const interval = setInterval(() => {
      fetchBotData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Countdown timer for waking-up state (Render free tier)
  useEffect(() => {
    if (retryCountdown === null) return;
    if (retryCountdown <= 0) {
      setRetryCountdown(null);
      fetchBotData();
      return;
    }

    const timer = setTimeout(() => {
      setRetryCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [retryCountdown]);

  const fetchBotData = async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);

    try {
      const res = await fetch('/api/bot/status');

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const status = res.status;
        const errType = errorJson.error_type;

        if (status === 401 || status === 403 || errType === 'auth_failed') {
          setConnectionState('auth_failed');
          setErrorMessage(errorJson.message || 'Login failed — check the bot API username/password.');
          return;
        }

        if (errType === 'cors_blocked' || status === 403) {
          setConnectionState('cors_blocked');
          setErrorMessage(errorJson.message || "Blocked by CORS — check the bot's CORS_origins configuration.");
          return;
        }

        if (status === 503 || status === 504 || errType === 'waking_up') {
          setConnectionState('waking_up');
          setErrorMessage(errorJson.message || 'Bot is waking up (Render free tier) — retrying automatically...');
          if (retryCountdown === null) setRetryCountdown(15);
          return;
        }

        setConnectionState('unreachable');
        setErrorMessage(errorJson.message || "Can't reach the bot at this URL — confirm it's deployed and running.");
        return;
      }

      const data = await res.json();

      setConnectionState('connected');
      setErrorMessage(null);
      setRetryCountdown(null);

      // Extract running trade (max_open_trades: 1)
      const currentRunning = data.running_trades && data.running_trades.length > 0 ? data.running_trades[0] : null;
      setRunningTrade(currentRunning);

      // Section 5.11.7: Diff running trade ID for push notification
      if (currentRunning && currentRunning.trade_id !== prevRunningTradeIdRef.current) {
        if (prevRunningTradeIdRef.current !== null) {
          sendBrowserNotification(
            `Bot Opened ${currentRunning.side} ${currentRunning.pair}`,
            `Entry: ₹${((currentRunning.open_rate ?? 0) * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ($${currentRunning.open_rate})`
          );
        }
        prevRunningTradeIdRef.current = currentRunning.trade_id;
      } else if (!currentRunning) {
        prevRunningTradeIdRef.current = null;
      }

      // Closed trades
      const fetchedClosed: BotClosedTrade[] = data.closed_trades || [];
      setClosedTrades(fetchedClosed);

      // Section 5.11.7: Diff closed trades count
      if (
        prevClosedTradesCountRef.current !== null &&
        fetchedClosed.length > prevClosedTradesCountRef.current &&
        fetchedClosed.length > 0
      ) {
        const latestClosed = fetchedClosed[0];
        const pnlAbsUSDT = latestClosed.close_profit_abs ?? latestClosed.profit_abs ?? 0;
        const pnlAbsINR = pnlAbsUSDT * rate;
        const sign = pnlAbsINR >= 0 ? '+' : '';
        sendBrowserNotification(
          `Bot Trade Closed: ${latestClosed.pair}`,
          `Net P&L: ${sign}₹${pnlAbsINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${latestClosed.exit_reason || 'exit'})`
        );
      }
      prevClosedTradesCountRef.current = fetchedClosed.length;

      // Section 5.11.3: DB Reset detection check
      const totalTradesCount = data.profit?.closed_trade_count ?? fetchedClosed.length;
      if (
        prevTotalTradesCountRef.current !== null &&
        totalTradesCount < prevTotalTradesCountRef.current &&
        totalTradesCount === 0
      ) {
        setDbResetWarning(true);
      }
      prevTotalTradesCountRef.current = totalTradesCount;

      if (data.balance) setBalance(data.balance);
      if (data.profit) setProfit(data.profit);
      if (data.strategy_webhook) setStrategyData(data.strategy_webhook);
      if (data.state) setBotState(data.state);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.toLowerCase().includes('failed to fetch') || errMsg.toLowerCase().includes('networkerror')) {
        setConnectionState('unreachable');
        setErrorMessage("Can't reach the bot at this URL — confirm it's deployed and the URL is correct.");
      } else {
        setConnectionState('unreachable');
        setErrorMessage(errMsg);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Section 5.11.5: Emergency controls dispatcher
  const handleEmergencyAction = async (action: EmergencyActionType, tradeId?: number | string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/bot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, trade_id: tradeId }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Action failed: ${json.message || 'Server error'}`);
      } else {
        setActionModal(null);
        await fetchBotData();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Action error: ${errMsg}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Section 5.11.6: Client-side Visual Analytics calculations
  const analyticsData = useMemo(() => {
    if (closedTrades.length === 0) {
      return {
        wins: 0,
        losses: 0,
        winRate: 0,
        equityPoints: [] as { date: string; cumulativePnl: number }[],
      };
    }

    let wins = 0;
    let losses = 0;

    // Chronological order for equity curve
    const sortedChronological = [...closedTrades].sort((a, b) => {
      const tA = a.close_timestamp || (a.close_date ? new Date(a.close_date).getTime() : 0);
      const tB = b.close_timestamp || (b.close_date ? new Date(b.close_date).getTime() : 0);
      return tA - tB;
    });

    let runningSum = 0;
    const equityPoints: { date: string; cumulativePnl: number }[] = [];

    // Starting baseline point
    equityPoints.push({ date: 'Start', cumulativePnl: 0 });

    sortedChronological.forEach((t) => {
      const pnlUSDT = t.close_profit_abs ?? t.profit_abs ?? 0;
      const pnlINR = pnlUSDT * rate;
      if (pnlUSDT >= 0) wins++;
      else losses++;

      runningSum += pnlINR;
      const dateStr = t.close_date ? new Date(t.close_date).toLocaleDateString('en-IN', { month: 'numeric', day: 'numeric' }) : '';
      equityPoints.push({
        date: dateStr,
        cumulativePnl: runningSum,
      });
    });

    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    return { wins, losses, winRate, equityPoints };
  }, [closedTrades, rate]);

  // Render Section 5.11.3 Error / Not Connected Screens
  if (connectionState === 'not_configured') {
    return (
      <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/30 p-8 text-center backdrop-blur-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
          <Server className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Bot Not Connected</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Connect your automated Freqtrade bot (CROWN-v12 on Bybit Futures Testnet) to monitor live positions, closed
          trades, and performance metrics.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button
            onClick={onOpenSettings}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 px-4"
          >
            <Sliders className="h-3.5 w-3.5" />
            Configure Bot API Credentials
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchBotData()}
            className="text-xs h-9 px-4 border-border/60"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (connectionState === 'waking_up') {
    return (
      <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 animate-pulse">
          <Clock className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-foreground">Bot is Waking Up</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Render free-tier instances sleep after inactivity. The first request takes approximately 45–60 seconds to
          spin up the container.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-amber-500/30 bg-background/80 px-4 py-1.5 font-mono text-xs text-amber-500">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Retrying automatically in {retryCountdown ?? 15}s...
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchBotData()}
          className="mt-6 text-xs border-border/60"
        >
          Wake Up Now
        </Button>
      </div>
    );
  }

  if (connectionState === 'auth_failed') {
    return (
      <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-foreground">Authentication Failed</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Login failed (HTTP 401/403). Please verify the <code className="rounded bg-muted px-1.5 py-0.5 font-mono">API_USERNAME</code> and{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">API_PASSWORD</code> set on your bot deployment.
        </p>
        <Button
          onClick={onOpenSettings}
          className="mt-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 px-4"
        >
          <Sliders className="h-3.5 w-3.5" />
          Update Bot Credentials
        </Button>
      </div>
    );
  }

  if (connectionState === 'cors_blocked') {
    return (
      <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
          <Shield className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-foreground">Blocked by CORS Policy</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          Browser cross-origin request was blocked. Ensure your bot&apos;s <code className="rounded bg-muted px-1.5 py-0.5 font-mono">config.json</code> has{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">CORS_origins: [&quot;*&quot;]</code> or includes this site&apos;s origin.
        </p>
        <Button
          variant="outline"
          onClick={() => fetchBotData()}
          className="mt-6 text-xs h-9 px-4 border-border/60"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  if (connectionState === 'unreachable') {
    return (
      <div className="flex min-h-[440px] flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
          <AlertOctagon className="h-7 w-7" />
        </div>
        <h2 className="text-base font-bold text-foreground">Bot Unreachable</h2>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
          {errorMessage || "Can't reach the bot at this URL. Confirm the bot service is deployed and running on Bybit Futures Testnet."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchBotData()}
            className="text-xs h-9 px-4 border-border/60"
          >
            Retry Connection
          </Button>
          <Button
            onClick={onOpenSettings}
            className="text-xs h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Edit URL
          </Button>
        </div>
      </div>
    );
  }

  // Derived Balance / Profit Figures
  const botWalletUSDT = balance?.total_bot ?? balance?.total ?? 0;
  const botWalletINR = botWalletUSDT * rate;

  const totalClosedProfitUSDT = profit?.profit_closed_coin ?? profit?.profit_all_coin ?? 0;
  const totalClosedProfitINR = totalClosedProfitUSDT * rate;
  const isOverallProfit = totalClosedProfitUSDT >= 0;

  return (
    <div className="space-y-6">
      {/* Section 5.11.3: SQLite DB Reset Warning Notice */}
      {dbResetWarning && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-500">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Notice:</strong> Trade history appears to have reset. If your bot is using SQLite on Render, trade
              history wipes on restarts unless configured with a persistent Postgres <code className="font-mono">DB_URL</code> (Checklist #8).
            </span>
          </div>
          <button
            onClick={() => setDbResetWarning(false)}
            className="text-amber-500 hover:text-amber-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header bar: Status Pulse, Pair whitelisting, Refresh */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-3 w-3 items-center justify-center">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground">CROWN-v12 Bot</h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500 uppercase font-mono">
                {botState}
              </Badge>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Bybit Futures Testnet
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              30-Pair Whitelist • max_open_trades: 1 • 5s REST polling
            </span>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Emergency Controls triggers per Section 5.11.5 */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
              onClick={() => setActionModal('pause')}
              title="Pause: handles open trades per exit rules, stops new entries"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-sky-500 hover:bg-sky-500/10 hover:text-sky-600"
              onClick={() => setActionModal('stopbuy')}
              title="Stopbuy: closes existing normally, stops new entries"
            >
              <Ban className="h-3 w-3 mr-1" />
              Stopbuy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              onClick={() => setActionModal('stop')}
              title="Stop: stops trader outright"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
              onClick={() => handleEmergencyAction('start')}
              disabled={actionLoading}
              title="Start / Resume bot"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchBotData()}
            disabled={isRefreshing}
            className="h-8 border-border/60 px-2.5 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {onOpenSettings && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenSettings}
              className="h-8 border-border/60 px-2.5 text-xs"
              title="Bot Settings"
            >
              <Sliders className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground block">Bot Balance</span>
          <div className="font-mono text-base font-bold text-foreground mt-1">
            ₹{botWalletINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground block">
            ${botWalletUSDT.toFixed(2)} USDT
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground block">Realized Net P&L</span>
          <div
            className={`font-mono text-base font-bold mt-1 ${
              isOverallProfit ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {isOverallProfit ? '+' : ''}₹{totalClosedProfitINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground block">
            {isOverallProfit ? '+' : ''}${totalClosedProfitUSDT.toFixed(2)} USDT
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground block">Win Rate</span>
          <div className="font-mono text-base font-bold text-foreground mt-1">
            {analyticsData.winRate.toFixed(1)}%
          </div>
          <span className="text-[11px] text-muted-foreground block">
            {analyticsData.wins} Wins / {analyticsData.losses} Losses
          </span>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground block">Closed Trades</span>
          <div className="font-mono text-base font-bold text-foreground mt-1">
            {profit?.closed_trade_count ?? closedTrades.length}
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Avg: {profit?.avg_duration || '--'}
          </span>
        </div>
      </div>

      {/* Section 5.11.1 Running Trade Component */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Running Position
          </h2>
          <span className="text-xs text-muted-foreground font-mono">max_open_trades: 1</span>
        </div>
        <BotRunningTrade
          trade={runningTrade}
          currencyRate={rate}
          strategyData={strategyData}
          onSelectTrade={(t) => setSelectedTrade(t)}
          onForceExit={(tId) => handleEmergencyAction('forceexit', tId)}
          isActionLoading={actionLoading}
        />
      </div>

      {/* Section 5.11.6 Visual Analytics: Cumulative Equity Curve & Win/Loss Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Equity Curve SVG Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Cumulative Equity Curve</h3>
              <span className="text-[11px] text-muted-foreground">Realized net cumulative P&L over closed trades (₹)</span>
            </div>
            <div className="font-mono text-xs font-bold text-emerald-500">
              {analyticsData.equityPoints.length > 1
                ? `${analyticsData.equityPoints[analyticsData.equityPoints.length - 1].cumulativePnl >= 0 ? '+' : ''}₹${analyticsData.equityPoints[analyticsData.equityPoints.length - 1].cumulativePnl.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
                : '₹0.00'}
            </div>
          </div>

          {analyticsData.equityPoints.length <= 1 ? (
            <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
              Not enough closed trades to plot equity curve yet
            </div>
          ) : (
            <div className="relative h-44 w-full">
              {(() => {
                const pts = analyticsData.equityPoints;
                const minVal = Math.min(...pts.map((p) => p.cumulativePnl), 0);
                const maxVal = Math.max(...pts.map((p) => p.cumulativePnl), 100);
                const range = maxVal - minVal || 1;

                const width = 500;
                const height = 150;
                const padding = 20;

                const pointsCoord = pts.map((p, idx) => {
                  const x = padding + (idx / (pts.length - 1)) * (width - padding * 2);
                  const y = height - padding - ((p.cumulativePnl - minVal) / range) * (height - padding * 2);
                  return `${x},${y}`;
                });

                const zeroY = height - padding - ((0 - minVal) / range) * (height - padding * 2);

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
                    {/* Zero baseline */}
                    <line
                      x1={padding}
                      y1={zeroY}
                      x2={width - padding}
                      y2={zeroY}
                      stroke="currentColor"
                      strokeDasharray="4 4"
                      className="text-border"
                    />

                    {/* Polyline */}
                    <polyline
                      fill="none"
                      stroke={runningSumSign(pts) ? '#10b981' : '#f43f5e'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsCoord.join(' ')}
                    />

                    {/* Data dots */}
                    {pts.map((p, idx) => {
                      const x = padding + (idx / (pts.length - 1)) * (width - padding * 2);
                      const y = height - padding - ((p.cumulativePnl - minVal) / range) * (height - padding * 2);
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="3"
                          className={p.cumulativePnl >= 0 ? 'fill-emerald-500' : 'fill-rose-500'}
                        />
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          )}
        </div>

        {/* Win/Loss Donut Chart */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-foreground">Win / Loss Ratio</h3>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex flex-col items-center justify-center my-auto py-2">
            {analyticsData.wins + analyticsData.losses === 0 ? (
              <span className="text-xs text-muted-foreground">No trades recorded</span>
            ) : (
              <div className="relative flex items-center justify-center">
                {/* Visual SVG Donut */}
                <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 36 36">
                  {/* Background circle */}
                  <path
                    className="text-muted/30"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Win slice */}
                  <path
                    className="text-emerald-500"
                    strokeDasharray={`${analyticsData.winRate}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="font-mono text-lg font-bold text-foreground">
                    {analyticsData.winRate.toFixed(0)}%
                  </span>
                  <span className="block text-[10px] text-muted-foreground font-medium uppercase">Win Rate</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3 text-center">
            <div className="rounded-lg bg-emerald-500/10 py-1.5 text-emerald-500">
              <span className="font-mono text-sm font-bold block">{analyticsData.wins}</span>
              <span className="text-[10px] font-medium uppercase">Winning</span>
            </div>
            <div className="rounded-lg bg-rose-500/10 py-1.5 text-rose-500">
              <span className="font-mono text-sm font-bold block">{analyticsData.losses}</span>
              <span className="text-[10px] font-medium uppercase">Losing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5.11.1 Closed Trades History Component */}
      <BotClosedTrades
        trades={closedTrades}
        currencyRate={rate}
        onSelectTrade={(t) => setSelectedTrade(t)}
      />

      {/* Section 5.11.2 & 5.11.8: Trade Detail Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    selectedTrade.side === 'LONG' || selectedTrade.is_short === false
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-bold'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-500 font-bold'
                  }
                >
                  {selectedTrade.side || (selectedTrade.is_short ? 'SHORT' : 'LONG')}
                </Badge>
                <h3 className="font-mono text-base font-bold text-foreground">
                  {selectedTrade.pair} (Trade #{selectedTrade.trade_id})
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSelectedTrade(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground font-sans">Open Date / Timestamp:</span>
                <span className="text-foreground">{selectedTrade.open_date || '--'}</span>
              </div>
              {selectedTrade.close_date && (
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-muted-foreground font-sans">Close Date:</span>
                  <span className="text-foreground">{selectedTrade.close_date}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground font-sans">Entry Price:</span>
                <span className="text-foreground">
                  ${selectedTrade.open_rate} (₹
                  {((selectedTrade.open_rate ?? 0) * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })})
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground font-sans">Exit / Current Price:</span>
                <span className="text-foreground">
                  ${selectedTrade.close_rate ?? selectedTrade.current_rate ?? selectedTrade.open_rate} (₹
                  {(((selectedTrade.close_rate ?? selectedTrade.current_rate ?? selectedTrade.open_rate) ?? 0) * rate).toLocaleString('en-IN', {
                    maximumFractionDigits: 2,
                  })}
                  )
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground font-sans">Stake Amount:</span>
                <span className="text-foreground">
                  ${selectedTrade.stake_amount ?? 0} USDT (₹
                  {((selectedTrade.stake_amount ?? 0) * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })})
                </span>
              </div>

              {selectedTrade.exit_reason && (
                <div className="flex justify-between border-b border-border/30 pb-2">
                  <span className="text-muted-foreground font-sans">Exit Reason:</span>
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {selectedTrade.exit_reason}
                  </Badge>
                </div>
              )}

              {/* Section 5.11.8 Strategy Webhook fields if present */}
              {strategyData && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 font-sans text-xs space-y-2">
                  <div className="font-bold text-primary flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> Strategy Webhook Attributes
                  </div>
                  {strategyData.regime && (
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Market Regime:</span>
                      <span className="text-foreground">{strategyData.regime}</span>
                    </div>
                  )}
                  {strategyData.entry_adaptive_sl !== undefined && (
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Entry Adaptive SL:</span>
                      <span className="text-foreground">${strategyData.entry_adaptive_sl}</span>
                    </div>
                  )}
                  {strategyData.final_checkpoint_sl !== undefined && (
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Final Checkpoint SL:</span>
                      <span className="text-foreground">${strategyData.final_checkpoint_sl}</span>
                    </div>
                  )}
                  {strategyData.checkpoint_vol_ratio !== undefined && (
                    <div className="flex justify-between font-mono">
                      <span className="text-muted-foreground">Checkpoint Vol Ratio:</span>
                      <span className="text-foreground">{strategyData.checkpoint_vol_ratio}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTrade(null)}
                className="text-xs border-border/60"
              >
                Close Detail
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Section 5.11.5 Emergency Action Confirmation Dialog */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <AlertOctagon className="h-6 w-6" />
              <h3 className="text-base font-bold capitalize">Confirm Bot Action: {actionModal}</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground mb-4">
              {actionModal === 'pause' &&
                'Pause gracefully handles open trades per their own exit rules, but stops opening new ones. This is the recommended safe option.'}
              {actionModal === 'stop' &&
                'Stop immediately terminates the bot trader. Open positions will remain unattended on Bybit Futures until restarted.'}
              {actionModal === 'stopbuy' &&
                'Stopbuy lets existing open positions run and exit normally, but prevents any new entry signals from firing.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActionModal(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleEmergencyAction(actionModal)}
                className="text-xs"
              >
                {actionLoading ? 'Executing...' : `Confirm ${actionModal.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function runningSumSign(pts: { cumulativePnl: number }[]): boolean {
  if (pts.length === 0) return true;
  return pts[pts.length - 1].cumulativePnl >= 0;
}
