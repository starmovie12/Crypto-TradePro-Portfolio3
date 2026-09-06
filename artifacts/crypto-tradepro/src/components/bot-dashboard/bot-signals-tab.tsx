import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BotTrade,
  BotRunningTrade as BotRunningTradeType,
  BotClosedTrade,
  BotBalance,
  BotProfit,
  BotConnectionState,
  StrategyWebhookData,
  BotEmergencyAction,
} from './bot-types';
import { BotRunningTrade } from './bot-running-trade';
import { BotClosedTrades } from './bot-closed-trades';
import { BotEmergencyControls } from './bot-emergency-controls';
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

  // Notification tracking ref (Section 5.11.7)
  const prevRunningTradeIdRef = useRef<number | string | null>(null);
  const prevClosedTradesCountRef = useRef<number | null>(null);
  const prevClosedTradesFirstIdRef = useRef<number | string | null>(null);
  const prevTotalTradesCountRef = useRef<number | null>(null);

  const rate = currencyRate > 0 ? currencyRate : 86.5;

  // Check initial credentials config
  useEffect(() => {
    const savedUrl = localStorage.getItem('freqtrade_api_url') || process.env.NEXT_PUBLIC_FREQTRADE_API_URL;
    if (!savedUrl) {
      setConnectionState('not_configured');
    } else {
      fetchBotData();
    }
  }, []);

  // Request browser notification permissions on mount
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
          setRetryCountdown(15);
          return;
        }

        setConnectionState('unreachable');
        setErrorMessage(errorJson.message || "Can't reach the bot at this URL — confirm it's deployed and running.");
        return;
      }

      const data = await res.json();

      // Successful response
      setConnectionState('connected');
      setErrorMessage(null);